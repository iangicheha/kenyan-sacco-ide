"""Intent agent: natural language → strict validated JSON (no free-text fields)."""

from __future__ import annotations

import json
import logging
import os
from typing import Any, Literal

from pydantic import BaseModel, Field, field_validator

from memory.schema_store import map_semantic_names, schema_hints_for_prompt
from models.model_router import parse_json_response

logger = logging.getLogger("meridian.intent")

ALLOWED_OPS = ("==", "!=", ">", "<", ">=", "<=")
ALLOWED_TASKS = (
    "aggregation",
    "filter",
    "growth_rate",
    "describe",
    "transform",
    "unknown",
)


class FilterSpec(BaseModel):
    column: str
    op: Literal["==", "!=", ">", "<", ">=", "<="]
    value: str | float | int | bool | None


class IntentSpec(BaseModel):
    task: Literal["aggregation", "filter", "growth_rate", "describe", "transform", "unknown"]
    metric: str | None = None
    group_by: str | None = None
    filters: list[FilterSpec] = Field(default_factory=list)
    operation: str | None = None

    @field_validator("metric", "group_by", "operation", mode="before")
    @classmethod
    def strip_empty(cls, v: Any) -> Any:
        if v is None:
            return None
        if isinstance(v, str) and not v.strip():
            return None
        return v


def _heuristic_intent(query: str, columns: list[str]) -> dict[str, Any]:
    q = query.lower()
    filters: list[dict[str, Any]] = []
    metric = map_semantic_names("amount", columns) or next(
        (c for c in columns if any(x in c.lower() for x in ("amount", "value", "rev", "total"))), columns[0] if columns else "amount"
    )
    group_col = map_semantic_names("date", columns) or next(
        (c for c in columns if "date" in c.lower() or "month" in c.lower()), None
    )
    type_col = map_semantic_names("type", columns) or next(
        (c for c in columns if c.lower() in ("type", "kind", "category")), None
    )

    if type_col and ("refund" in q or "exclude" in q):
        filters.append({"column": type_col, "op": "!=", "value": "refund"})

    if "growth" in q or "growth rate" in q or "mom" in q or "change" in q:
        task: str = "growth_rate"
        op = "growth_rate"
    elif "group" in q or "by month" in q or "per month" in q or "aggregate" in q or "sum" in q:
        task = "aggregation"
        op = "sum" if "sum" in q or "total" in q else "sum"
    elif "filter" in q or filters:
        task = "filter"
        op = "filter"
    else:
        task = "describe"
        op = "summary"

    return {
        "task": task,
        "metric": metric,
        "group_by": group_col,
        "filters": filters,
        "operation": op,
    }


def _resolve_columns_on_intent(data: dict[str, Any], columns: list[str]) -> dict[str, Any]:
    out = dict(data)
    colset = {c.lower(): c for c in columns}

    def resolve(name: str | None) -> str | None:
        if not name:
            return None
        if name in columns:
            return name
        if name.lower() in colset:
            return colset[name.lower()]
        m = map_semantic_names(name, columns)
        return m

    out["metric"] = resolve(out.get("metric"))
    out["group_by"] = resolve(out.get("group_by"))

    fixed_filters = []
    for f in out.get("filters") or []:
        if not isinstance(f, dict):
            continue
        col = f.get("column")
        rc = resolve(str(col)) if col else None
        if rc:
            nf = dict(f)
            nf["column"] = rc
            fixed_filters.append(nf)
    out["filters"] = fixed_filters
    return out


def _llm_parse_intent(query: str, schema: dict[str, Any]) -> dict[str, Any]:
    hints = schema_hints_for_prompt(schema)
    system = f"""You output ONLY a single JSON object for spreadsheet analytics intent (no markdown, no keys beyond the schema).
Allowed task values: {list(ALLOWED_TASKS)}.
filter.op must be one of {list(ALLOWED_OPS)}.
Use ONLY column names that exist in the schema keys.
Schema column hints: {hints}
JSON shape:
{{"task": str, "metric": str|null, "group_by": str|null, "filters": [{{"column": str, "op": str, "value": str|number|bool|null}}], "operation": str|null}}"""
    return parse_json_response("intent", system, query, max_retries=3)


def parse_intent(query: str, schema: dict[str, Any]) -> dict[str, Any]:
    """
    Parse user query into strict Intent JSON.
    Validates via Pydantic; raises ValueError on invalid shape/content.
    """
    columns = list(schema.get("columns", {}).keys())
    data: dict[str, Any]
    try:
        if os.environ.get("MERIDIAN_FORCE_HEURISTIC_INTENT") == "1":
            data = _heuristic_intent(query, columns)
        elif os.environ.get("OPENAI_API_KEY") or os.environ.get("AI_MODEL_KEY"):
            try:
                data = _llm_parse_intent(query, schema)
            except Exception as e:
                logger.warning("LLM intent failed (%s); using heuristic", e)
                data = _heuristic_intent(query, columns)
        else:
            data = _heuristic_intent(query, columns)
    except json.JSONDecodeError as e:
        raise ValueError(f"intent JSON invalid: {e}") from e

    data = _resolve_columns_on_intent(data, columns)
    for f in data.get("filters", []):
        if isinstance(f, dict) and f.get("column") and f["column"] not in columns:
            raise ValueError(f"unknown filter column: {f['column']}")
    if data.get("metric") and data["metric"] not in columns:
        raise ValueError(f"unknown metric column: {data['metric']}")
    if data.get("group_by") and data["group_by"] not in columns:
        raise ValueError(f"unknown group_by column: {data['group_by']}")

    validated = IntentSpec.model_validate(data)
    out = validated.model_dump()
    logger.info("intent_parsed %s", json.dumps(out, default=str))
    return out
