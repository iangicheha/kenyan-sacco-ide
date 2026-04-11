"""Planner: LLaMA 3 (via router) JSON plan with rule validation; deterministic fallback."""

from __future__ import annotations

import json
import logging
import os
from typing import Any

from models.model_router import parse_json_response

logger = logging.getLogger("meridian.planner")

KNOWN_STEP_TYPES = frozenset(
    {
        "filter",
        "ensure_datetime",
        "derive_period",
        "group",
        "aggregate",
        "compute_growth",
        "describe",
        "passthrough",
    }
)


def _filter_steps(filters: list[dict[str, Any]]) -> list[dict[str, Any]]:
    steps = []
    for i, f in enumerate(filters):
        col = f.get("column")
        op = f.get("op")
        val = f.get("value")
        steps.append(
            {
                "step": "filter",
                "details": json.dumps({"index": i, "column": col, "op": op, "value": val}),
                "payload": {"column": col, "op": op, "value": val},
            }
        )
    return steps


def _create_plan_deterministic(intent: dict[str, Any], schema: dict[str, Any]) -> list[dict[str, Any]]:
    task = intent.get("task") or "unknown"
    metric = intent.get("metric")
    group_by = intent.get("group_by")
    filters = list(intent.get("filters") or [])
    operation = (intent.get("operation") or "").lower()
    cols = schema.get("columns", {})

    plan: list[dict[str, Any]] = []

    plan.extend(_filter_steps(filters))

    if task == "describe" or task == "unknown":
        plan.append({"step": "describe", "details": "summary_stats", "payload": {"columns": list(cols.keys())}})
        logger.info("plan_created %s", json.dumps([s["step"] for s in plan]))
        return plan

    if group_by and cols.get(group_by) == "datetime":
        plan.append(
            {
                "step": "derive_period",
                "details": f"month_bucket:{group_by}",
                "payload": {"column": group_by, "freq": "M", "alias": f"{group_by}__month"},
            }
        )
        gb = f"{group_by}__month"
    elif group_by:
        gb = group_by
    else:
        gb = None

    if task == "aggregation" and metric and gb:
        agg_op = "sum" if "sum" in operation or not operation else operation
        if agg_op not in ("sum", "mean", "count", "min", "max"):
            agg_op = "sum"
        plan.append(
            {
                "step": "aggregate",
                "details": json.dumps({"metric": metric, "by": gb, "agg": agg_op}),
                "payload": {"metric": metric, "by": gb, "agg": agg_op},
            }
        )
    elif task == "aggregation" and metric and not gb:
        agg_op = "sum" if "sum" in operation or not operation else operation
        if agg_op not in ("sum", "mean", "count", "min", "max"):
            agg_op = "sum"
        plan.append(
            {
                "step": "aggregate",
                "details": json.dumps({"metric": metric, "by": None, "agg": agg_op}),
                "payload": {"metric": metric, "by": None, "agg": agg_op},
            }
        )
    elif task == "growth_rate" and metric and gb:
        plan.append(
            {
                "step": "aggregate",
                "details": json.dumps({"metric": metric, "by": gb, "agg": "sum"}),
                "payload": {"metric": metric, "by": gb, "agg": "sum"},
            }
        )
        plan.append(
            {
                "step": "compute_growth",
                "details": json.dumps({"value_column": metric, "period_column": gb}),
                "payload": {"value_column": metric, "period_column": gb},
            }
        )
    elif task == "filter":
        if metric and gb:
            plan.append(
                {
                    "step": "aggregate",
                    "details": json.dumps({"metric": metric, "by": gb, "agg": "sum"}),
                    "payload": {"metric": metric, "by": gb, "agg": "sum"},
                }
            )
        else:
            plan.append({"step": "passthrough", "details": "filters_only", "payload": {}})
    elif task == "transform":
        plan.append({"step": "passthrough", "details": "transform_placeholder", "payload": intent})

    has_agg = any(s["step"] == "aggregate" for s in plan)
    has_growth = any(s["step"] == "compute_growth" for s in plan)
    if task in ("aggregation", "growth_rate") and metric and not has_agg and not has_growth:
        plan.append(
            {
                "step": "describe",
                "details": "fallback_insufficient_grouping",
                "payload": {"columns": list(cols.keys())},
            }
        )

    for s in plan:
        if s["step"] not in KNOWN_STEP_TYPES:
            raise ValueError(f"unknown internal step {s['step']}")

    logger.info("plan_created %s", json.dumps([s["step"] for s in plan]))
    return plan


def _normalize_llm_step(raw: dict[str, Any]) -> dict[str, Any]:
    details = raw.get("details", "")
    if not isinstance(details, str):
        details = json.dumps(details)
    payload = raw.get("payload")
    if payload is None:
        payload = {}
    if not isinstance(payload, dict):
        payload = {}
    return {
        "step": raw["step"],
        "details": details,
        "payload": payload,
    }


def _validate_llm_steps(steps: Any, schema: dict[str, Any]) -> tuple[bool, str]:
    if not isinstance(steps, list) or len(steps) == 0:
        return False, "steps must be a non-empty JSON array"
    col_keys = set(schema.get("columns", {}).keys())
    for i, raw in enumerate(steps):
        if not isinstance(raw, dict):
            return False, f"step {i} must be an object"
        st = raw.get("step")
        if st not in KNOWN_STEP_TYPES:
            return False, f"step {i} has invalid step type: {st}"
        if st == "filter":
            pl = raw.get("payload") or {}
            c = pl.get("column")
            if c not in col_keys:
                return False, f"filter step {i} unknown column {c}"
            if pl.get("op") not in ("==", "!=", ">", "<", ">=", "<="):
                return False, f"filter step {i} invalid op"
        if st == "derive_period":
            pl = raw.get("payload") or {}
            if pl.get("column") not in col_keys:
                return False, "derive_period unknown column"
            if not pl.get("alias"):
                return False, "derive_period missing alias"
        if st == "aggregate":
            pl = raw.get("payload") or {}
            if pl.get("metric") not in col_keys:
                return False, "aggregate unknown metric"
            by = pl.get("by")
            if by is not None and by not in col_keys and not str(by).endswith("__month"):
                return False, "aggregate unknown group column"
        if st == "compute_growth":
            pl = raw.get("payload") or {}
            vc, pc = pl.get("value_column"), pl.get("period_column")
            if not vc or not pc:
                return False, "compute_growth missing value_column or period_column"
            if vc not in col_keys:
                return False, "compute_growth unknown value_column"
            if pc not in col_keys and not (isinstance(pc, str) and pc.endswith("__month")):
                return False, "compute_growth unknown period_column"
    return True, ""


def _llm_plan(intent: dict[str, Any], schema: dict[str, Any]) -> list[dict[str, Any]]:
    system = f"""You are a spreadsheet analytics planner. Reply with ONE JSON object only (no markdown).
Shape: {{"steps": [{{"step": "<kind>", "details": "<short log label>", "payload": {{...}}}}]}}
Allowed step kinds: {json.dumps(sorted(KNOWN_STEP_TYPES))}
Rules:
- Include only executable steps; every step MUST have keys "step", "details", "payload".
- "details" MUST be a string (not free prose — a short label or JSON string for logs).
- Use ONLY column names that appear as keys in schema.columns.
- Respect the intent JSON: preserve filters as filter steps when the intent lists filters.
- Prefer the minimal number of steps."""
    user = json.dumps({"intent": intent, "schema": schema}, default=str)
    data = parse_json_response("planner", system, user, max_retries=3)
    steps = data.get("steps")
    ok, err = _validate_llm_steps(steps, schema)
    if not ok:
        raise ValueError(f"invalid planner output: {err}")
    out = [_normalize_llm_step(s) for s in steps]
    for s in out:
        if s["step"] not in KNOWN_STEP_TYPES:
            raise ValueError(f"unknown step {s['step']}")
    logger.info("plan_llm_ok %s", json.dumps([s["step"] for s in out]))
    return out


def create_plan(intent: dict[str, Any], schema: dict[str, Any]) -> list[dict[str, Any]]:
    """
    Primary: LLaMA 3 JSON plan (strict) via model router. Fallback: deterministic planner.
    """
    has_key = bool(os.environ.get("OPENAI_API_KEY") or os.environ.get("AI_MODEL_KEY"))
    if (
        has_key
        and os.environ.get("MERIDIAN_FORCE_DETERMINISTIC_PLANNER") != "1"
        and os.environ.get("MERIDIAN_FORCE_HEURISTIC_INTENT") != "1"
    ):
        try:
            return _llm_plan(intent, schema)
        except Exception as e:
            logger.warning("planner_llm_failed; using deterministic plan: %s", e)
    return _create_plan_deterministic(intent, schema)
