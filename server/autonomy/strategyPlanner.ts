import { createPlan } from "../agents/planningAgent";
import { validate } from "../agents/validationAgent";
import type {
  RetrievedContext,
  StrategyCandidate,
  StructuredObjective,
} from "../types";

export interface StrategyPlannerOptions {
  tableNameHint?: string;
  skipCache?: boolean;
  /** Max alternative strategies (default 3). */
  maxStrategies?: number;
}

function primaryMetricColumn(objective: StructuredObjective): string {
  const m = objective.metrics[0];
  if (m === "primary_metric") return "revenue";
  return m;
}

/**
 * Builds distinct planning queries so planningAgent produces multiple valid strategies.
 * Queries describe intent only — execution engine computes all numbers.
 */
export function buildStrategyQueries(goalText: string, objective: StructuredObjective): string[] {
  const col = primaryMetricColumn(objective);
  const g = goalText.trim();
  return [
    `forecast ${col} for ${g} using moving average`,
    `forecast ${col} for ${g} using linear regression`,
    `average ${col} for portfolio analysis: ${g}`,
  ];
}

/**
 * Uses planningAgent + validationAgent for each candidate query; returns validated strategies only.
 */
export async function planStrategies(
  goalText: string,
  objective: StructuredObjective,
  retrievedContext: RetrievedContext,
  options?: StrategyPlannerOptions
): Promise<StrategyCandidate[]> {
  const max = options?.maxStrategies ?? Number(process.env.GOAL_MAX_STRATEGIES ?? 3);
  const queries = buildStrategyQueries(goalText, objective).slice(0, max);
  const out: StrategyCandidate[] = [];
  let i = 0;
  for (const query of queries) {
    const planning = await createPlan(query, retrievedContext, {
      tableNameHint: options?.tableNameHint,
      skipCache: options?.skipCache,
    });
    const validation = validate(planning.plan);
    if (!validation.valid) {
      continue;
    }
    i += 1;
    out.push({
      id: `strategy_${i}`,
      query,
      plan: planning.plan,
      planning,
      validation,
    });
  }
  if (out.length === 0) {
    const fallbacks = [
      `forecast ${primaryMetricColumn(objective)}`,
      `average ${primaryMetricColumn(objective)}`,
      `sum ${primaryMetricColumn(objective)}`,
    ];
    for (const query of fallbacks) {
      const planning = await createPlan(query, retrievedContext, {
        tableNameHint: options?.tableNameHint,
        skipCache: options?.skipCache,
      });
      const validation = validate(planning.plan);
      if (!validation.valid) continue;
      i += 1;
      out.push({
        id: `strategy_${i}`,
        query,
        plan: planning.plan,
        planning,
        validation,
      });
      if (out.length >= 1) break;
    }
  }
  return out;
}
