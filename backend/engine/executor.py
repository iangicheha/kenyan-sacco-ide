"""Restricted execution of generated pandas code."""

from __future__ import annotations

import ast
import logging
from typing import Any

import numpy as np
import pandas as pd

logger = logging.getLogger("meridian.executor")

_SAFE_BUILTINS: dict[str, Any] = {
    "len": len,
    "range": range,
    "min": min,
    "max": max,
    "int": int,
    "float": float,
    "str": str,
    "bool": bool,
    "abs": abs,
    "round": round,
    "sum": sum,
    "enumerate": enumerate,
    "zip": zip,
    "isinstance": isinstance,
    "True": True,
    "False": False,
    "None": None,
}

_DISALLOWED_CALL_ROOTS = frozenset(
    {
        "open",
        "exec",
        "eval",
        "compile",
        "__import__",
        "input",
        "breakpoint",
        "globals",
        "locals",
        "vars",
        "getattr",
        "setattr",
        "delattr",
    }
)


class UnsafeCodeError(ValueError):
    pass


def _call_root_name(node: ast.AST) -> str | None:
    if isinstance(node, ast.Name):
        return node.id
    if isinstance(node, ast.Attribute):
        parts: list[str] = []
        cur: ast.AST = node
        while isinstance(cur, ast.Attribute):
            parts.append(cur.attr)
            cur = cur.value
        if isinstance(cur, ast.Name):
            parts.append(cur.id)
            return ".".join(reversed(parts))
    return None


def _validate_ast(tree: ast.AST) -> None:
    for node in ast.walk(tree):
        if isinstance(node, (ast.Import, ast.ImportFrom)):
            raise UnsafeCodeError("imports are not allowed in generated code")
        if isinstance(
            node,
            (
                ast.FunctionDef,
                ast.AsyncFunctionDef,
                ast.ClassDef,
                ast.Lambda,
                ast.Yield,
                ast.YieldFrom,
                ast.Global,
                ast.Nonlocal,
            ),
        ):
            raise UnsafeCodeError("unsupported ast node")
        if isinstance(node, ast.Call):
            root = _call_root_name(node.func)
            if root:
                base = root.split(".")[0]
                if base in _DISALLOWED_CALL_ROOTS:
                    raise UnsafeCodeError(f"disallowed call: {base}")
        if isinstance(node, ast.Attribute):
            if isinstance(node.attr, str) and node.attr.startswith("__"):
                raise UnsafeCodeError("dunder attribute access not allowed")


def execute_code(code: str, df: pd.DataFrame) -> pd.DataFrame:
    """Execute snippet with df in scope; result must assign `df` or `result` (DataFrame)."""
    tree = ast.parse(code, mode="exec")
    _validate_ast(tree)
    compiled = compile(tree, "<meridian_executor>", "exec")
    env: dict[str, Any] = {"__builtins__": _SAFE_BUILTINS, "pd": pd, "np": np, "df": df.copy()}
    exec(compiled, env, env)
    if "df" in env and isinstance(env["df"], pd.DataFrame):
        out = env["df"]
        logger.debug("execute_code rows=%s cols=%s", len(out), list(out.columns))
        return out
    if "result" in env and isinstance(env["result"], pd.DataFrame):
        out = env["result"]
        logger.debug("execute_code result rows=%s", len(out))
        return out
    raise RuntimeError("executed code must assign a pandas DataFrame to `df` or `result`")
