import type { StructuredObjective } from "../types";

const OBJECTIVE_PATTERNS: Array<{
  match: (s: string) => boolean;
  objective: StructuredObjective;
}> = [
  {
    match: (s) =>
      /default|delinq|npl|non[-\s]?perform|arrears|write[-\s]?off/.test(s) &&
      /reduce|lower|cut|minimi[sz]e|decrease/.test(s),
    objective: {
      objective: "minimize_default_rate",
      label: "Minimize loan default rate",
      constraints: [],
      metrics: ["default_rate"],
    },
  },
  {
    match: (s) =>
      /default|delinq|npl/.test(s) && /forecast|predict|trend|future/.test(s),
    objective: {
      objective: "minimize_default_rate",
      label: "Minimize loan default rate",
      constraints: [],
      metrics: ["default_rate"],
    },
  },
  {
    match: (s) => /revenue|income|turnover|sales/.test(s) && /grow|maximi[sz]e|increase|boost/.test(s),
    objective: {
      objective: "maximize_revenue",
      label: "Maximize revenue",
      constraints: [],
      metrics: ["revenue"],
    },
  },
  {
    match: (s) => /cost|expense|opex/.test(s) && /reduce|minimi[sz]e|cut|lower/.test(s),
    objective: {
      objective: "minimize_cost",
      label: "Minimize operating cost",
      constraints: [],
      metrics: ["cost"],
    },
  },
  {
    match: (s) => /risk|exposure/.test(s) && /reduce|lower|minimi[sz]e/.test(s),
    objective: {
      objective: "minimize_portfolio_risk",
      label: "Minimize portfolio risk",
      constraints: [],
      metrics: ["risk_score"],
    },
  },
  {
    match: (s) => /forecast|predict|project/.test(s),
    objective: {
      objective: "forecast_key_metrics",
      label: "Forecast key metrics",
      constraints: [],
      metrics: ["primary_metric"],
    },
  },
];

/**
 * Maps a high-level user goal to a structured objective.
 * Heuristic only — no LLM numeric output; safe for audit.
 */
export function parseGoal(goalText: string): StructuredObjective {
  const normalized = goalText.trim().toLowerCase();
  if (!normalized) {
    return {
      objective: "unspecified",
      label: "Unspecified goal",
      constraints: [],
      metrics: ["primary_metric"],
    };
  }
  for (const p of OBJECTIVE_PATTERNS) {
    if (p.match(normalized)) {
      return { ...p.objective, constraints: [...p.objective.constraints] };
    }
  }
  return {
    objective: "optimize_portfolio",
    label: "Optimize portfolio outcomes",
    constraints: [],
    metrics: ["primary_metric"],
  };
}
