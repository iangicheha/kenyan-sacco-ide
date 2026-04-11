"""Post-execution validation with structured errors for retry."""

from __future__ import annotations

import json
import logging
import os
from dataclasses import dataclass
from typing import Any

import numpy as np
import pandas as pd

from models.model_router import call_model

logger = logging.getLogger("meridian.validation")


@dataclass
class ValidationResult:
    ok: bool
    code: str
    message: str
    details: dict[str, Any]


def validate(
    df: pd.DataFrame,
    *,
    schema: dict[str, Any],
    step: dict[str, Any],
    runtime_error: BaseException | None = None,
    prior_row_count: int | None = None,
) -> ValidationResult:
    """
    Validate dataframe after a step. Checks columns, emptiness, obvious type issues.
    """
    if runtime_error is not None:
        r = ValidationResult(
            ok=False,
            code="runtime_error",
            message=str(runtime_error),
            details={"step": step.get("step"), "error_type": type(runtime_error).__name__},
        )
        logger.warning("validation_fail %s", json.dumps(r.details | {"message": r.message}))
        return r

    if df is None or not isinstance(df, pd.DataFrame):
        return ValidationResult(False, "type_error", "output is not a DataFrame", {"step": step.get("step")})

    if df.empty:
        return ValidationResult(
            ok=False,
            code="empty_result",
            message="result has zero rows",
            details={"step": step.get("step"), "columns": list(df.columns)},
        )

    kind = step.get("step")
    if kind == "filter" and prior_row_count is not None and len(df) == prior_row_count:
        # not always wrong, but suspicious — treat as soft pass
        pass

    if kind == "compute_growth":
        gcol = "__growth_pct__"
        if gcol in df.columns:
            s = df[gcol].replace({np.inf: np.nan, -np.inf: np.nan})
            if s.notna().sum() == 0:
                return ValidationResult(
                    ok=False,
                    code="type_mismatch",
                    message="growth column is all null",
                    details={"step": kind},
                )

    logger.info("validation_ok step=%s rows=%s", kind, len(df))
    return ValidationResult(True, "ok", "", {"rows": len(df), "columns": list(df.columns)})


def llm_retry_hint(
    *,
    step: dict[str, Any],
    result: ValidationResult,
    df_columns: list[str],
) -> str | None:
    """
    LLaMA 3 (via router) fallback: one-line hint for code retry. Rule-based validation stays primary.
    """
    if os.environ.get("MERIDIAN_VALIDATION_LLM_HINT") != "1":
        return None
    if not (os.environ.get("OPENAI_API_KEY") or os.environ.get("AI_MODEL_KEY")):
        return None
    system = (
        "You help debug pandas pipeline steps. Reply with ONE short sentence: "
        "what likely went wrong and what to change in the next code attempt. No JSON."
    )
    user = json.dumps(
        {
            "step": step,
            "validation": {"ok": result.ok, "code": result.code, "message": result.message},
            "columns": df_columns,
        },
        default=str,
    )
    prompt = f"<|system|>\n{system}\n<|user|>\n{user}"
    try:
        return call_model("validation", prompt).strip()
    except Exception as e:
        logger.warning("validation_llm_hint_failed %s", e)
        return None
