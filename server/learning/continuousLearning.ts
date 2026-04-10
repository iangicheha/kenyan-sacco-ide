import type { AiExecutionPlan, RetrievedContext } from "../types";

interface PlanSuccessRecord {
  key: string;
  intent: string;
  tableName: string;
  successCount: number;
  lastUsedAt: string;
  plan: AiExecutionPlan;
}

interface FailedPlanRecord {
  timestamp: string;
  query: string;
  reason: string;
  tableNameHint?: string;
}

const successfulPlans = new Map<string, PlanSuccessRecord>();
const failedPlans: FailedPlanRecord[] = [];
const retrievalFeedback = new Map<string, number>();

function normalizeQueryKey(query: string): string {
  return query.trim().toLowerCase().replace(/\s+/g, " ").slice(0, 200);
}

export function cacheSuccessfulPlan(query: string, plan: AiExecutionPlan): void {
  const key = normalizeQueryKey(query);
  const prev = successfulPlans.get(key);
  successfulPlans.set(key, {
    key,
    intent: plan.intent,
    tableName: plan.tableName,
    plan,
    successCount: (prev?.successCount ?? 0) + 1,
    lastUsedAt: new Date().toISOString(),
  });
}

export function getCachedSuccessfulPlan(query: string): AiExecutionPlan | undefined {
  return successfulPlans.get(normalizeQueryKey(query))?.plan;
}

export function logFailedPlan(query: string, reason: string, tableNameHint?: string): void {
  failedPlans.push({
    timestamp: new Date().toISOString(),
    query,
    reason,
    tableNameHint,
  });
  if (failedPlans.length > 500) {
    failedPlans.splice(0, failedPlans.length - 500);
  }
}

export function improveRetrievalRanking(context?: RetrievedContext): void {
  if (!context) return;
  for (const table of context.relevantTables) {
    const key = `table:${table.name}`;
    retrievalFeedback.set(key, (retrievalFeedback.get(key) ?? 0) + table.score);
  }
  for (const col of context.relevantColumns) {
    const key = `col:${col.tableName}.${col.column}`;
    retrievalFeedback.set(key, (retrievalFeedback.get(key) ?? 0) + col.score);
  }
}

export function getLearningSnapshot(): {
  successfulPlanCount: number;
  failedPlanCount: number;
  retrievalFeedbackCount: number;
} {
  return {
    successfulPlanCount: successfulPlans.size,
    failedPlanCount: failedPlans.length,
    retrievalFeedbackCount: retrievalFeedback.size,
  };
}
