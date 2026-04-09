import { buildSchemaSummary, interpretIntent } from "../ai/interpreter";
import { buildPlan } from "../ai/planner";
import type { PlanningAgentOutput, RetrievedContext } from "../types";
import { TtlCache } from "./cache";
import { createHash } from "node:crypto";

const planCache = new TtlCache<PlanningAgentOutput>();

function planCacheKey(
  query: string,
  tableName: string | undefined,
  ctx: RetrievedContext,
  retryHint: string | undefined
): string {
  const schemaFingerprint = [
    ...ctx.relevantTables.map((t) => `${t.name}@${t.schemaVersion ?? 0}`),
    ...ctx.relevantColumns.map((c) => `${c.tableName}.${c.column}`),
  ]
    .sort()
    .join("|");
  const raw = `${query.trim()}::${tableName ?? ""}::${schemaFingerprint}::${retryHint ?? ""}`;
  return createHash("sha256").update(raw).digest("hex");
}

export interface CreatePlanOptions {
  tableNameHint?: string;
  retryHint?: string;
  skipCache?: boolean;
}

/**
 * Produces a structured multi-step plan from intent + schema.
 * Numeric results are never computed here — only the execution engine runs models.
 */
export async function createPlan(
  query: string,
  retrievedContext: RetrievedContext,
  options?: CreatePlanOptions
): Promise<PlanningAgentOutput> {
  const started = Date.now();
  const key = planCacheKey(query, options?.tableNameHint, retrievedContext, options?.retryHint);
  if (!options?.skipCache) {
    const hit = planCache.get(key);
    if (hit) {
      return { ...hit, latencyMs: Date.now() - started, cacheHit: true };
    }
  }

  const schemaSummary = buildSchemaSummary(options?.tableNameHint);
  const hadKey = Boolean(process.env.AI_MODEL_KEY ?? process.env.OPENAI_API_KEY);
  const interpretation = await interpretIntent(query, {
    retrievedContext,
    schemaSummary,
    retryHint: options?.retryHint,
  });
  const plan = buildPlan(interpretation, options?.tableNameHint);
  const out: PlanningAgentOutput = {
    plan,
    intentSummary: `${interpretation.intent}${interpretation.targetColumn ? ` on ${interpretation.targetColumn}` : ""}`,
    latencyMs: Date.now() - started,
    cacheHit: false,
    source: hadKey ? "llm_intent" : "heuristic",
  };
  if (!options?.skipCache) {
    planCache.set(key, out);
  }
  return out;
}

export function _clearPlanningAgentCacheForTests(): void {
  planCache.clear();
}
