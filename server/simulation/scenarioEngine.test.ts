import { describe, it, expect, beforeEach } from "vitest";
import { clearTablesForTests, upsertTable } from "../data/tableStore";
import {
  _clearSimulationCacheForTests,
  getSimulationBaseRows,
  runScenarios,
} from "./scenarioEngine";

describe("scenarioEngine", () => {
  beforeEach(() => {
    clearTablesForTests();
    _clearSimulationCacheForTests();
  });

  it("produces deterministic scenario results for identical inputs", () => {
    const t = upsertTable("s::1", [{ revenue: 10 }, { revenue: 20 }, { revenue: 30 }]);
    const plan = {
      intent: "average" as const,
      tableName: "s::1",
      schemaVersion: t.version,
      steps: [{ action: "aggregate" as const, operation: "avg" as const, column: "revenue" }],
    };
    const base = getSimulationBaseRows("s::1");
    const a = runScenarios(plan, base, { maxScenarios: 2, disableCache: true });
    const b = runScenarios(plan, base, { maxScenarios: 2, disableCache: true });
    expect(a.map((x) => x.execution.result)).toEqual(b.map((x) => x.execution.result));
    expect(a[0].seed).toBe(b[0].seed);
  });

  it("caches repeated simulations when cache is enabled", () => {
    const t = upsertTable("s::2", [{ revenue: 5 }, { revenue: 15 }]);
    const plan = {
      intent: "sum" as const,
      tableName: "s::2",
      schemaVersion: t.version,
      steps: [{ action: "aggregate" as const, operation: "sum" as const, column: "revenue" }],
    };
    const base = getSimulationBaseRows("s::2");
    const first = runScenarios(plan, base, { maxScenarios: 1, disableCache: false });
    const second = runScenarios(plan, base, { maxScenarios: 1, disableCache: false });
    expect(first[0].cacheHit).toBe(false);
    expect(second[0].cacheHit).toBe(true);
  });
});
