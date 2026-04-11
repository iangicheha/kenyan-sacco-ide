"""Per-agent model routing and OpenAI-compatible inference (temperature=0)."""

from __future__ import annotations

import json
import logging
import os
import re
from typing import Any

from openai import OpenAI

logger = logging.getLogger("meridian.models")

# Logical model slugs (assignments). Override API ids via env vars.
_SLUG_ENV: dict[str, str] = {
    "nous-hermes-2": "MERIDIAN_API_MODEL_NOUS_HERMES_2",
    "llama-3": "MERIDIAN_API_MODEL_LLAMA_3",
    "deepseek-coder": "MERIDIAN_API_MODEL_DEEPSEEK_CODER",
    "mixtral-8x7b": "MERIDIAN_API_MODEL_MIXTRAL_8X7B",
}

_DEFAULT_MAX_TOKENS = int(os.environ.get("MERIDIAN_MAX_TOKENS", "2048"))
_CODE_MAX_TOKENS = int(os.environ.get("MERIDIAN_CODE_MAX_TOKENS", "1024"))
_INSIGHT_MAX_TOKENS = int(os.environ.get("MERIDIAN_INSIGHT_MAX_TOKENS", "512"))
_VALIDATION_MAX_TOKENS = int(os.environ.get("MERIDIAN_VALIDATION_MAX_TOKENS", "256"))


def _resolve_api_model(slug: str) -> str:
    env_key = _SLUG_ENV.get(slug)
    if env_key:
        override = os.environ.get(env_key)
        if override:
            return override.strip()
    return slug


def _client() -> OpenAI:
    api_key = os.environ.get("OPENAI_API_KEY") or os.environ.get("AI_MODEL_KEY")
    if not api_key:
        raise RuntimeError("OPENAI_API_KEY or AI_MODEL_KEY is required for model inference")
    base = (os.environ.get("MERIDIAN_INFERENCE_BASE_URL") or os.environ.get("OPENAI_BASE_URL") or "").strip()
    return OpenAI(api_key=api_key, base_url=base or None)


def _parse_chat_messages(prompt: str) -> list[dict[str, str]]:
    """Split optional <|system|> / <|user|> blocks; otherwise single user message."""
    if "<|system|>" in prompt and "<|user|>" in prompt:
        _, rest = prompt.split("<|system|>", 1)
        system, user = rest.split("<|user|>", 1)
        return [
            {"role": "system", "content": system.strip()},
            {"role": "user", "content": user.strip()},
        ]
    return [{"role": "user", "content": prompt.strip()}]


def _strip_json_fences(text: str) -> str:
    t = text.strip()
    if t.startswith("```"):
        t = re.sub(r"^```(?:json)?\s*", "", t, flags=re.IGNORECASE)
        t = re.sub(r"\s*```$", "", t)
    return t.strip()


def run_inference(
    model: str,
    prompt: str,
    *,
    max_tokens: int | None = None,
    temperature: float = 0.0,
    response_format: dict[str, str] | None = None,
) -> str:
    """
    Run a single chat completion. `model` is a logical slug resolved via env.
    Use prompt with <|system|>...<|user|>... to supply system instructions.
    """
    client = _client()
    api_model = _resolve_api_model(model)
    messages = _parse_chat_messages(prompt)
    mt = max_tokens if max_tokens is not None else _DEFAULT_MAX_TOKENS
    kwargs: dict[str, Any] = {
        "model": api_model,
        "messages": messages,
        "temperature": temperature,
        "max_tokens": mt,
    }
    if response_format is not None:
        kwargs["response_format"] = response_format
    try:
        resp = client.chat.completions.create(**kwargs)
    except Exception as e:
        if response_format is not None:
            logger.warning("Inference with json mode failed (%s); retrying without response_format", e)
            kwargs.pop("response_format", None)
            resp = client.chat.completions.create(**kwargs)
        else:
            raise
    text = (resp.choices[0].message.content or "").strip()
    logger.debug("run_inference model_slug=%s api_model=%s chars=%s", model, api_model, len(text))
    return text


def call_model(agent_type: str, prompt: str) -> str:
    """
    Route `agent_type` to its assigned model (strict). Returns raw assistant text.
    """
    if agent_type == "intent":
        model = "nous-hermes-2"
        return run_inference(
            model,
            prompt,
            temperature=0.0,
            response_format={"type": "json_object"},
        )
    if agent_type == "planner":
        model = "llama-3"
        return run_inference(
            model,
            prompt,
            temperature=0.0,
            response_format={"type": "json_object"},
        )
    if agent_type == "code":
        model = "deepseek-coder"
        return run_inference(
            model,
            prompt,
            temperature=0.0,
            max_tokens=_CODE_MAX_TOKENS,
        )
    if agent_type == "insight":
        model = "llama-3"
        return run_inference(
            model,
            prompt,
            temperature=0.0,
            max_tokens=_INSIGHT_MAX_TOKENS,
        )
    if agent_type == "validation":
        model = "llama-3"
        return run_inference(
            model,
            prompt,
            temperature=0.0,
            max_tokens=_VALIDATION_MAX_TOKENS,
        )
    if agent_type == "schema":
        model = "mixtral-8x7b"
        return run_inference(
            model,
            prompt,
            temperature=0.0,
            response_format={"type": "json_object"},
        )
    model = "llama-3"
    return run_inference(model, prompt, temperature=0.0)


def parse_json_response(
    agent_type: str,
    system: str,
    user: str,
    *,
    max_retries: int = 3,
) -> dict[str, Any]:
    """Call routed model with system+user, parse JSON; retry on invalid output."""
    last: Exception | None = None
    u = user
    for attempt in range(max_retries):
        prompt = f"<|system|>\n{system.strip()}\n<|user|>\n{u.strip()}"
        raw = call_model(agent_type, prompt)
        try:
            return json.loads(_strip_json_fences(raw))
        except json.JSONDecodeError as e:
            last = e
            logger.warning("json_parse_retry agent=%s attempt=%s err=%s", agent_type, attempt + 1, e)
            u = (
                user.strip()
                + "\n\nRespond with a single JSON object only. Parser error: "
                + str(e)
            )
    raise ValueError(f"invalid JSON from {agent_type} after {max_retries} tries: {last}")
