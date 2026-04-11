"""Schema memory: inferred dtypes and semantic column aliases."""

from __future__ import annotations

import json
import os
import warnings
from typing import Any

import pandas as pd

_STORE: dict[str, Any] | None = None


class SchemaStore:
    """Optional OO wrapper around schema memory helpers."""

    def infer_schema(self, df: pd.DataFrame) -> dict[str, Any]:
        return infer_schema(df)

    def get_schema(self) -> dict[str, Any]:
        return get_schema()

    def map_semantic_names(self, term: str, available_columns: list[str]) -> str | None:
        return map_semantic_names(term, available_columns)


_SEMANTIC_ALIASES: dict[str, list[str]] = {
    "revenue": ["rev", "sales", "amount", "income", "turnover"],
    "date": ["dt", "txn_date", "transaction_date", "period"],
    "type": ["category", "txn_type", "kind"],
    "amount": ["value", "amt", "total", "sum"],
}


def _normalize_dtype(series: pd.Series) -> str:
    if pd.api.types.is_datetime64_any_dtype(series):
        return "datetime"
    if pd.api.types.is_numeric_dtype(series):
        return "numeric"
    if pd.api.types.is_bool_dtype(series):
        return "boolean"
    return "category"


def _merge_mixtral_schema(base: dict[str, Any], df: pd.DataFrame) -> dict[str, Any]:
    """Optional Mixtral 8x7B refinement; falls back silently on error."""
    if os.environ.get("MERIDIAN_SCHEMA_USE_MIXTRAL") != "1":
        return base
    if not (os.environ.get("OPENAI_API_KEY") or os.environ.get("AI_MODEL_KEY")):
        return base
    from models.model_router import parse_json_response

    try:
        sample = df.head(25).to_dict(orient="list")
        system = (
            "You refine spreadsheet column types. Reply with ONE JSON object only: "
            '{"columns": {"<existing_column_name>": "numeric|datetime|category|boolean"}}. '
            "Only include keys that exist in the provided base.columns. JSON only."
        )
        user = json.dumps({"base": base, "sample": sample}, default=str)
        data = parse_json_response("schema", system, user, max_retries=2)
        patch = data.get("columns")
        if not isinstance(patch, dict):
            return base
        inner = dict(base.get("columns", {}))
        allowed = {"numeric", "datetime", "category", "boolean"}
        for k, v in patch.items():
            if k in df.columns and isinstance(v, str) and v in allowed:
                inner[k] = v
        return {"columns": inner}
    except Exception:
        return base


def infer_schema(df: pd.DataFrame) -> dict[str, Any]:
    """Infer column dtypes into a stable schema dict."""
    columns: dict[str, str] = {}
    for col in df.columns:
        s = df[col]
        if s.dtype == object:
            sample = s.dropna().head(50)
            with warnings.catch_warnings():
                warnings.simplefilter("ignore", category=UserWarning)
                parsed = pd.to_datetime(sample, errors="coerce")
            if parsed.notna().mean() > 0.85:
                columns[str(col)] = "datetime"
                continue
        columns[str(col)] = _normalize_dtype(s)
    global _STORE
    _STORE = {"columns": columns}
    _STORE = _merge_mixtral_schema(_STORE, df)
    return _STORE


def get_schema() -> dict[str, Any]:
    if _STORE is None:
        return {"columns": {}}
    return _STORE


def map_semantic_names(term: str, available_columns: list[str]) -> str | None:
    """
    Map a loose semantic token (e.g. 'rev') to an actual column if unambiguous.
    Returns None if no confident match.
    """
    t = term.strip().lower()
    if t in [c.lower() for c in available_columns]:
        for c in available_columns:
            if c.lower() == t:
                return c
    for canonical, aliases in _SEMANTIC_ALIASES.items():
        pool = [canonical] + aliases
        if t in pool:
            for c in available_columns:
                cl = c.lower().replace(" ", "_")
                if cl == canonical or cl in aliases or canonical in cl:
                    return c
                for a in aliases:
                    if a in cl or cl in a:
                        return c
    for c in available_columns:
        if t in c.lower() or c.lower() in t:
            return c
    return None


def coerce_datetime_columns(df: pd.DataFrame, schema: dict[str, Any]) -> pd.DataFrame:
    out = df.copy()
    cols = schema.get("columns", {})
    for name, kind in cols.items():
        if kind == "datetime" and name in out.columns:
            out[name] = pd.to_datetime(out[name], errors="coerce")
    return out


def schema_hints_for_prompt(schema: dict[str, Any]) -> str:
    parts = []
    for col, kind in schema.get("columns", {}).items():
        parts.append(f'"{col}": "{kind}"')
    return "{" + ", ".join(parts) + "}"
