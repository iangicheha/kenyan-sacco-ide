import { createHash } from "node:crypto";
import type { AiExecutionPlan, ExecutionResult, RowRecord, ScenarioRun } from "../types";
import { executePlanOnRows } from "../engine/executionEngine";
import { getTable } from "../data/tableStore";

export interface ScenarioDefinition {
  id: string;
  label: string;
  apply: (rows: RowRecord[]) => RowRecord[];
}

function cloneRows(rows: RowRecord[]): RowRecord[] {
  return rows.map((r) => ({ ...r }));
}

function findColumn(rows: RowRecord[], re: RegExp): string | undefined {
  if (rows.length === 0) return undefined;
  const keys = Object.keys(rows[0]);
  return keys.find((k) => re.test(k));
}

function hashRows(rows: RowRecord[]): string {
  return createHash("sha256").update(JSON.stringify(rows)).digest("hex");
}

function hashSeed(parts: string[]): string {
  return createHash("sha256").update(parts.join("|")).digest("hex");
}

/** Bump numeric rate-like fields (does not invent columns). */
function increaseInterestRate(rows: RowRecord[]): RowRecord[] {
  if (rows.length === 0) return [];
  const keys = Object.keys(rows[0]);
  const col = keys.find(
    (k) =>
      /interest|coupon|lending_rate|loan_rate/i.test(k) && !/default/i.test(k)
  );
  if (!col) return cloneRows(rows);
  return rows.map((r) => {
    const n = Number(r[col]);
    if (!Number.isFinite(n)) return { ...r };
    return { ...r, [col]: n * 1.05 };
  });
}

/** Keep lower-risk slice when a risk column exists (deterministic percentile). */
function tightenApproval(rows: RowRecord[]): RowRecord[] {
  const col = findColumn(rows, /risk_score|risk|pd|score/i);
  if (!col) return cloneRows(rows);
  const nums = rows
    .map((r) => Number(r[col]))
    .filter((n) => Number.isFinite(n))
    .slice()
    .sort((a, b) => a - b);
  if (nums.length === 0) return cloneRows(rows);
  const cut = nums[Math.floor(nums.length * 0.75)];
  return rows.filter((r) => {
    const n = Number(r[col]);
    return Number.isFinite(n) && n <= cut;
  });
}

/** Focus on a single deterministic segment bucket when a segment column exists. */
function segmentCustomers(rows: RowRecord[]): RowRecord[] {
  const col = findColumn(rows, /segment|region|tier|band/i);
  if (!col) return cloneRows(rows);
  const distinct = [
    ...new Set(rows.map((r) => String(r[col] ?? "").trim()).filter(Boolean)),
  ].sort();
  if (distinct.length === 0) return cloneRows(rows);
  const pick = distinct[0];
  return rows.filter((r) => String(r[col] ?? "").trim() === pick);
}

const ALL_SCENARIOS: ScenarioDefinition[] = [
  { id: "baseline", label: "Baseline (no intervention)", apply: cloneRows },
  {
    id: "increase_interest_rate",
    label: "Increase interest / pricing rate",
    apply: increaseInterestRate,
  },
  {
    id: "tighten_approval_criteria",
    label: "Tighten approval criteria (lower-risk slice)",
    apply: tightenApproval,
  },
  {
    id: "segment_customers",
    label: "Single-segment focus",
    apply: segmentCustomers,
  },
];

export interface ScenarioEngineOptions {
  /** Cap scenarios (default from GOAL_MAX_SCENARIOS or 4). */
  maxScenarios?: number;
  /** Disable LRU-style cache (tests). */
  disableCache?: boolean;
}

const simCache = new Map<string, ScenarioRun>();

export function _clearSimulationCacheForTests(): void {
  simCache.clear();
}

function cacheKey(plan: AiExecutionPlan, scenarioId: string, rowHash: string): string {
  const planKey = createHash("sha256")
    .update(JSON.stringify({ table: plan.tableName, v: plan.schemaVersion, steps: plan.steps }))
    .digest("hex");
  return `${scenarioId}:${planKey}:${rowHash}`;
}

/**
 * Runs deterministic scenario transforms and executes the plan via executionEngine only.
 */
export function runScenarios(
  plan: AiExecutionPlan,
  baseRows: RowRecord[],
  options?: ScenarioEngineOptions
): ScenarioRun[] {
  const max =
    options?.maxScenarios ?? Math.max(1, Number(process.env.GOAL_MAX_SCENARIOS ?? 4));
  const disableCache = options?.disableCache ?? process.env.GOAL_SIM_CACHE === "false";
  const defs = ALL_SCENARIOS.slice(0, max);
  const out: ScenarioRun[] = [];

  for (const def of defs) {
    const transformed = def.apply(baseRows);
    const rowSnapshotHash = hashRows(transformed);
    const seed = hashSeed([def.id, plan.tableName, String(plan.schemaVersion), rowSnapshotHash]);
    const key = cacheKey(plan, def.id, rowSnapshotHash);

    if (!disableCache) {
      const hit = simCache.get(key);
      if (hit) {
        out.push({ ...hit, cacheHit: true });
        continue;
      }
    }

    const started = Date.now();
    const execution = executePlanOnRows(plan, transformed);
    const executionMs = Date.now() - started;
    const rec: ScenarioRun = {
      id: def.id,
      label: def.label,
      seed,
      execution,
      rowSnapshotHash,
      cacheHit: false,
      executionMs,
    };
    if (!disableCache) {
      simCache.set(key, rec);
    }
    out.push(rec);
  }
  return out;
}

/** Base rows for simulation — current table snapshot (caller may clone before transforms). */
export function getSimulationBaseRows(tableName: string): RowRecord[] {
  const t = getTable(tableName);
  if (!t) throw new Error(`Table "${tableName}" not found`);
  return t.rows.map((r) => ({ ...r }));
}
