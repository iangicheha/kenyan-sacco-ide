import { describe, it, expect } from "vitest";
import { buildGoalReport, reportToCsv } from "./reportGenerator";
import type { ScenarioRun, StrategyCandidate } from "../types";

describe("reportGenerator", () => {
  it("builds structured report without inventing metrics", () => {
    const strategies = [
      {
        id: "strategy_1",
        query: "q",
        plan: {
          intent: "forecast",
          tableName: "t",
          schemaVersion: 1,
          steps: [],
        },
        planning: {
          intentSummary: "s",
          latencyMs: 1,
          cacheHit: false,
          source: "heuristic" as const,
          plan: {
            intent: "forecast",
            tableName: "t",
            schemaVersion: 1,
            steps: [],
          },
        },
        validation: { valid: true, decisions: [], latencyMs: 0 },
      },
    ] satisfies StrategyCandidate[];

    const scenarios = [
      {
        id: "baseline",
        label: "b",
        seed: "abc",
        execution: { summary: "", result: 42, steps: [] },
        rowSnapshotHash: "h",
        cacheHit: false,
        executionMs: 2,
      },
    ] satisfies ScenarioRun[];

    const report = buildGoalReport({
      goalText: "test goal",
      objective: {
        objective: "minimize_default_rate",
        label: "Min defaults",
        constraints: [],
        metrics: ["default_rate"],
      },
      strategies,
      scenarios,
    });
    expect(report.summary).toContain("test goal");
    expect(report.scenarios[0].result).toBe(42);
    expect(report.recommendations.length).toBeGreaterThan(0);
    const csv = reportToCsv(report);
    expect(csv).toContain("baseline");
  });
});
