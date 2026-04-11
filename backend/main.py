"""Meridian Python API — FastAPI entrypoint for the agentic spreadsheet pipeline."""

from __future__ import annotations

import logging
import os
import sys
from typing import Any

import pandas as pd
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

# Ensure `backend/` is importable when launched as `uvicorn main:app` from repo root
_BACKEND_ROOT = os.path.dirname(os.path.abspath(__file__))
if _BACKEND_ROOT not in sys.path:
    sys.path.insert(0, _BACKEND_ROOT)

from orchestrator.agent_loop import run_agent

logging.basicConfig(
    level=os.environ.get("MERIDIAN_LOG_LEVEL", "INFO"),
    format="%(asctime)s %(levelname)s %(name)s %(message)s",
)
logger = logging.getLogger("meridian.api")

app = FastAPI(title="Meridian Spreadsheet AI", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=os.environ.get("MERIDIAN_CORS_ORIGINS", "*").split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class QueryRequest(BaseModel):
    query: str = Field(..., min_length=1)
    records: list[dict[str, Any]] | None = Field(
        default=None,
        description="Tabular rows as list of objects; required for execution.",
    )


@app.post("/ai/query")
def ai_query(body: QueryRequest) -> dict[str, Any]:
    if not body.records:
        raise HTTPException(
            status_code=422,
            detail="Field `records` is required (array of row objects matching spreadsheet columns).",
        )
    try:
        df = pd.DataFrame(body.records)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid records: {e}") from e
    if df.empty:
        raise HTTPException(status_code=422, detail="records must not be empty")
    try:
        result = run_agent(body.query.strip(), df)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except RuntimeError as e:
        logger.warning("agent_failed %s", e)
        raise HTTPException(status_code=500, detail=str(e)) from e
    return {"data": result["data"], "insight": result["insight"]}


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "service": "meridian-python"}
