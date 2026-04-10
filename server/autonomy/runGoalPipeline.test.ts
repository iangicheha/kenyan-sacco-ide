import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { clearTablesForTests, upsertTable } from "../data/tableStore";
import { _clearDataAgentCacheForTests } from "../agents/dataAgent";
import { _clearPlanningAgentCacheForTests } from "../agents/planningAgent";
import { _clearSimulationCacheForTests } from "../simulation/scenarioEngine";
import { runGoalPipeline } from "./runGoalPipeline";

describe("runGoalPipeline", () => {
  beforeEach(() => {
    vi.stubEnv("OPENAI_API_KEY", "");
    vi.stubEnv("AI_MODEL_KEY", "");
    clearTablesForTests();
    _clearDataAgentCacheForTests();
    _clearPlanningAgentCacheForTests();
    _clearSimulationCacheForTests();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("runs end-to-end with deterministic scenario outputs", async () => {
    upsertTable("goal::D", [{ revenue: 100 }, { revenue: 200 }, { revenue: 300 }]);
    const a = await runGoalPipeline({
      goal: "forecast revenue trends",
      tableNameHint: "goal::D",
      skipCaches: true,
    });
    const b = await runGoalPipeline({
      goal: "forecast revenue trends",
      tableNameHint: "goal::D",
      skipCaches: true,
    });
    expect(a.report.scenarios.map((s) => s.result)).toEqual(b.report.scenarios.map((s) => s.result));
    expect(a.tasks.length).toBeGreaterThan(0);
    expect(a.strategies.length).toBeGreaterThan(0);
    expect(a.scenarios.length).toBeGreaterThan(0);
  });
});
