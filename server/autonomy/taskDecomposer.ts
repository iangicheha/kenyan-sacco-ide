import type { StructuredObjective, TaskDecomposition } from "../types";

const TASKS_BY_OBJECTIVE: Record<string, string[]> = {
  minimize_default_rate: [
    "analyze historical defaults",
    "identify risk segments",
    "simulate interventions",
    "forecast outcomes",
  ],
  maximize_revenue: [
    "analyze revenue trends",
    "identify growth segments",
    "simulate pricing scenarios",
    "forecast revenue",
  ],
  minimize_cost: [
    "analyze cost drivers",
    "identify savings levers",
    "simulate efficiency measures",
    "forecast cost trajectory",
  ],
  minimize_portfolio_risk: [
    "analyze concentration risk",
    "identify vulnerable segments",
    "simulate hedging or policy shifts",
    "forecast risk metrics",
  ],
  forecast_key_metrics: [
    "align metrics with available data",
    "select forecasting approach",
    "simulate alternative assumptions",
    "forecast outcomes",
  ],
  optimize_portfolio: [
    "analyze portfolio composition",
    "identify improvement areas",
    "simulate policy options",
    "forecast outcomes",
  ],
  unspecified: ["clarify goal with stakeholders", "map goal to measurable metrics", "simulate scenarios", "forecast outcomes"],
};

/**
 * Deterministic decomposition — no LLM; no numeric outputs.
 */
export function decomposeTasks(objective: StructuredObjective): TaskDecomposition {
  const tasks = TASKS_BY_OBJECTIVE[objective.objective] ?? TASKS_BY_OBJECTIVE.optimize_portfolio;
  return { tasks: [...tasks] };
}
