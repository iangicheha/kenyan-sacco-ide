"""Code agent: plan step + schema → executable pandas code (existing columns only)."""

from __future__ import annotations

import json
import logging
from typing import Any

from models.model_router import call_model

logger = logging.getLogger("meridian.code")


def _quote_filter_value(val: Any) -> str:
    if val is None:
        return "None"
    if isinstance(val, bool):
        return "True" if val else "False"
    if isinstance(val, (int, float)) and not isinstance(val, bool):
        return repr(val)
    return repr(str(val))


def _template_for_step(
    step: dict[str, Any],
    schema: dict[str, Any],
    df_columns: list[str],
) -> str | None:
    kind = step.get("step")
    payload = step.get("payload") or {}
    cols = set(schema.get("columns", {}).keys())
    live = set(df_columns)

    if kind == "filter":
        col = payload.get("column")
        op = payload.get("op")
        val = payload.get("value")
        if col not in cols or op not in ("==", "!=", ">", "<", ">=", "<="):
            return None
        rhs = _quote_filter_value(val)
        return f'df = df[df[{json.dumps(col)}] {op} {rhs}]'

    if kind == "derive_period":
        col = payload.get("column")
        alias = payload.get("alias")
        if not col or col not in cols or not alias:
            return None
        return (
            f"_s = pd.to_datetime(df[{json.dumps(col)}], errors=\"coerce\")\n"
            f"df = df.assign(**{{{json.dumps(alias)}: _s.dt.to_period(\"M\").astype(str)}})"
        )

    if kind == "aggregate":
        metric = payload.get("metric")
        by = payload.get("by")
        agg = payload.get("agg") or "sum"
        if not metric or metric not in live:
            return None
        if agg not in ("sum", "mean", "count", "min", "max"):
            agg = "sum"
        if by:
            if by not in live:
                return None
            return (
                f"df = (df.groupby({json.dumps(by)}, dropna=False, as_index=False)[{json.dumps(metric)}]"
                f".{agg}())"
            )
        m = json.dumps(metric)
        return f"df = pd.DataFrame({{{m}: [df[{m}].{agg}()]}})"

    if kind == "compute_growth":
        vc = payload.get("value_column")
        pc = payload.get("period_column")
        if not vc or not pc or vc not in live or pc not in live:
            return None
        gcol = "__growth_pct__"
        return (
            f"_o = df.sort_values({json.dumps(pc)}).copy()\n"
            f"_o[{json.dumps(gcol)}] = _o[{json.dumps(vc)}].pct_change()\n"
            f"df = _o"
        )

    if kind == "describe":
        return "df = df.describe(include=\"all\").transpose().reset_index().rename(columns={\"index\": \"stat\"})"

    if kind == "passthrough":
        return "df = df.copy()"

    return None


def _llm_generate_code(
    step: dict[str, Any],
    schema: dict[str, Any],
    df_columns: list[str],
    last_error: str | None = None,
) -> str:
    col_list = ", ".join(json.dumps(c) for c in df_columns)
    system = f"""You write a short pandas code snippet for ONE pipeline step.
Rules:
- Only use columns from this list: [{col_list}]
- Assign the working DataFrame to `df` (overwrite df). Do not import modules.
- Use variables: df, pd, np only. No file I/O, no exec/eval, no system.
- Output ONLY the Python code, no markdown fences."""
    user = f"Step: {json.dumps(step)}\nSchema: {json.dumps(schema)}"
    if last_error:
        user += f"\nPrevious attempt failed: {last_error}"
    prompt = f"<|system|>\n{system}\n<|user|>\n{user}"
    text = call_model("code", prompt).strip()
    if text.startswith("```"):
        text = text.strip("`")
        if text.lower().startswith("python"):
            text = text[6:].lstrip()
    return text


def generate_code(
    step: dict[str, Any],
    schema: dict[str, Any],
    df_columns: list[str],
    last_error: str | None = None,
) -> str:
    code = _template_for_step(step, schema, df_columns)
    if code and not last_error:
        logger.info("code_generated template step=%s", step.get("step"))
        return code
    if code and last_error:
        logger.info("code_retry_llm step=%s", step.get("step"))
        return _llm_generate_code(step, schema, df_columns, last_error)
    logger.info("code_generated llm step=%s", step.get("step"))
    return _llm_generate_code(step, schema, df_columns, last_error)
