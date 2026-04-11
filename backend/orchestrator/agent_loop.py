"""Meridian agent loop: Intent → Plan → Execute → Validate → Insight."""

from __future__ import annotations

import json
import logging
from typing import Any

import numpy as np
import pandas as pd

from agents.code_agent import generate_code
from agents.insight_agent import generate_insight
from agents.intent_agent import parse_intent
from agents.planner_agent import create_plan
from agents.validation_agent import ValidationResult, llm_retry_hint, validate
from engine.executor import execute_code
from memory.schema_store import coerce_datetime_columns, infer_schema

logger = logging.getLogger("meridian.loop")

MAX_ATTEMPTS = 3


def _log_step(kind: str, payload: dict[str, Any], log: list[dict[str, Any]]) -> None:
    entry = {"kind": kind, **payload}
    log.append(entry)
    logger.info("pipeline %s", json.dumps(entry, default=str))


def run_agent(query: str, df: pd.DataFrame) -> dict[str, Any]:
    """
    Run full pipeline. Returns dict with keys: data (records), insight (str), pipeline (audit log).
    """
    log: list[dict[str, Any]] = []
    if df is None or df.empty:
        raise ValueError("df must be a non-empty DataFrame")

    working = df.copy()
    schema = infer_schema(working)
    _log_step("schema", {"columns": list(schema.get("columns", {}).keys())}, log)

    working = coerce_datetime_columns(working, schema)

    intent = parse_intent(query, schema)
    _log_step("intent", {"intent": intent}, log)

    plan = create_plan(intent, schema)
    _log_step("plan", {"steps": [s.get("step") for s in plan], "plan": plan}, log)

    initial_schema = schema

    for step in plan:
        last_error: str | None = None
        prior_rows = len(working)
        for attempt in range(MAX_ATTEMPTS):
            code = generate_code(step, initial_schema, list(working.columns), last_error)
            _log_step(
                "code",
                {"step": step.get("step"), "attempt": attempt + 1, "code": code},
                log,
            )
            try:
                new_df = execute_code(code, working)
            except Exception as e:
                last_error = repr(e)
                _log_step("execute_error", {"step": step.get("step"), "error": last_error}, log)
                vr = validate(
                    working,
                    schema=initial_schema,
                    step=step,
                    runtime_error=e,
                    prior_row_count=prior_rows,
                )
                if attempt == MAX_ATTEMPTS - 1:
                    raise RuntimeError(
                        json.dumps(
                            {
                                "message": "execute_failed",
                                "step": step,
                                "validation": vr.__dict__,
                                "last_error": last_error,
                            }
                        )
                    ) from e
                continue

            vr = validate(
                new_df,
                schema=initial_schema,
                step=step,
                runtime_error=None,
                prior_row_count=prior_rows,
            )
            _log_step(
                "validate",
                {
                    "step": step.get("step"),
                    "ok": vr.ok,
                    "code": vr.code,
                    "message": vr.message,
                },
                log,
            )
            if vr.ok:
                working = new_df
                break
            last_error = f"{vr.code}: {vr.message}"
            hint = llm_retry_hint(step=step, result=vr, df_columns=list(working.columns))
            if hint:
                last_error = f"{last_error} | llm_hint: {hint}"
            if attempt == MAX_ATTEMPTS - 1:
                raise RuntimeError(
                    json.dumps(
                        {
                            "message": "validation_failed",
                            "step": step,
                            "validation": vr.__dict__,
                        }
                    )
                )

    insight = generate_insight(working, intent, plan)
    _log_step("insight", {"text": insight}, log)

    out_df = working.replace([np.inf, -np.inf], np.nan)
    for c in out_df.select_dtypes(include=["datetimetz", "datetime64[ns]"]).columns:
        out_df[c] = out_df[c].astype(str)
    records = json.loads(
        out_df.where(pd.notnull(out_df), None).to_json(orient="records", date_format="iso")
    )

    return {"data": records, "insight": insight, "pipeline": log, "intent": intent}
