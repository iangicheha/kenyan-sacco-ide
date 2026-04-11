"""Insight agent: final DataFrame → narrative (trends, anomalies, comparisons)."""

from __future__ import annotations

import json
import logging
import os
from typing import Any

import numpy as np
import pandas as pd

from models.model_router import call_model

logger = logging.getLogger("meridian.insight")


def _numeric_profile(df: pd.DataFrame) -> dict[str, Any]:
    num = df.select_dtypes(include=[np.number])
    if num.empty:
        return {"numeric_columns": [], "summary": {}}
    desc = num.describe().to_dict()
    profile: dict[str, Any] = {"numeric_columns": list(num.columns), "summary": {}}
    for col in num.columns:
        s = num[col].dropna()
        if s.empty:
            continue
        profile["summary"][col] = {
            "mean": float(s.mean()),
            "std": float(s.std()) if len(s) > 1 else 0.0,
            "min": float(s.min()),
            "max": float(s.max()),
        }
    if "__growth_pct__" in df.columns:
        g = df["__growth_pct__"].replace([np.inf, -np.inf], np.nan).dropna()
        if not g.empty:
            profile["growth"] = {
                "max_increase": float(g.max()),
                "max_decrease": float(g.min()),
                "latest": float(g.iloc[-1]) if len(g) else None,
            }
    return profile


def _heuristic_insight(df: pd.DataFrame, intent: dict[str, Any]) -> str:
    parts: list[str] = []
    prof = _numeric_profile(df)
    if prof.get("growth"):
        g = prof["growth"]
        if g["max_decrease"] is not None and g["max_decrease"] < -0.05:
            parts.append(
                f"The largest period-over-period drop is about {g['max_decrease']*100:.1f}%."
            )
        if g.get("latest") is not None and not pd.isna(g["latest"]):
            parts.append(f"The most recent growth rate is about {g['latest']*100:.1f}%.")
    if prof["summary"]:
        col = next(iter(prof["summary"]))
        s = prof["summary"][col]
        parts.append(
            f"For `{col}`, values range from {s['min']:.2f} to {s['max']:.2f} (mean {s['mean']:.2f})."
        )
    if not parts:
        parts.append(f"Result has {len(df)} rows and columns: {', '.join(map(str, df.columns))}.")
    task = intent.get("task", "analysis")
    return f"({task}) " + " ".join(parts)


def _llm_insight(df: pd.DataFrame, intent: dict[str, Any], plan: list[dict[str, Any]]) -> str:
    if not (os.environ.get("OPENAI_API_KEY") or os.environ.get("AI_MODEL_KEY")):
        return _heuristic_insight(df, intent)
    sample = df.head(50)
    try:
        preview = sample.replace({np.nan: None}).to_dict(orient="records")
    except Exception:
        preview = []
    stats = _numeric_profile(df)
    system = """You are a financial spreadsheet analyst. Write 2-4 concise sentences:
- trends (direction of change)
- anomalies (outliers or sharp moves) if visible
- comparisons across periods or categories when applicable
Use only evidence from the provided preview and statistics. If uncertain, say what is missing."""
    user = json.dumps({"intent": intent, "plan_steps": [s.get("step") for s in plan], "stats": stats, "preview": preview})
    prompt = f"<|system|>\n{system}\n<|user|>\n{user}"
    text = call_model("insight", prompt).strip()
    logger.info("insight_llm_ok chars=%s", len(text))
    return text


def generate_insight(df: pd.DataFrame, intent: dict[str, Any], plan: list[dict[str, Any]]) -> str:
    if df.empty:
        return "No rows remain after processing; check filters or grouping."
    text = _llm_insight(df, intent, plan)
    return text
