import type { GoalReport, ScenarioRun, StrategyCandidate, StructuredObjective } from "../types";

function stableStringifyResult(result: unknown): string {
  try {
    return JSON.stringify(result);
  } catch {
    return String(result);
  }
}

/**
 * Builds an audit-friendly report from engine outputs only — no LLM, no invented numbers.
 */
export function buildGoalReport(input: {
  goalText: string;
  objective: StructuredObjective;
  strategies: StrategyCandidate[];
  scenarios: ScenarioRun[];
}): GoalReport {
  const { goalText, objective, strategies, scenarios } = input;
  const metrics = [...objective.metrics];
  const scenarioSummaries = scenarios.map((s) => ({
    id: s.id,
    label: s.label,
    result: s.execution.result,
    seed: s.seed,
  }));

  const ranked = scenarios
    .slice()
    .map((s) => ({
      id: s.id,
      label: s.label,
      key: stableStringifyResult(s.execution.result),
    }))
    .sort((a, b) => a.key.localeCompare(b.key));

  const recommendations: string[] = [];
  if (strategies.length > 0) {
    recommendations.push(
      `Primary execution strategy uses table "${strategies[0].plan.tableName}" with ${strategies[0].plan.steps.length} deterministic step(s).`
    );
  }
  if (scenarios.length > 1) {
    recommendations.push(
      `Compare scenario "${ranked[0]?.id}" vs "${ranked[ranked.length - 1]?.id}" using execution results (see scenarios[].result).`
    );
  }
  recommendations.push(
    "All figures above are produced by the deterministic execution engine; rerun with the same data and plan for identical outputs."
  );

  const summary = [
    `Goal: ${goalText.trim() || "(empty)"}`,
    `Objective: ${objective.label} (${objective.objective})`,
    `Strategies generated: ${strategies.length}. Scenarios executed: ${scenarios.length}.`,
  ].join(" ");

  return {
    summary,
    scenarios: scenarioSummaries,
    recommendations,
    metrics,
  };
}

export function reportToCsv(report: GoalReport): string {
  const header = "scenario_id,label,result_json,seed";
  const lines = report.scenarios.map(
    (s) =>
      `"${s.id.replaceAll(`"`, `""`)}","${s.label.replaceAll(`"`, `""`)}","${String(JSON.stringify(s.result)).replaceAll(`"`, `""`)}","${s.seed}"`
  );
  return [header, ...lines].join("\n");
}
