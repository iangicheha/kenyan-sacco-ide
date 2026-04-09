import { describe, it, expect } from "vitest";
import { clearTablesForTests, getCurrentSchemaVersion, upsertTable } from "../data/tableStore";
import { buildPlan } from "./planner";

describe("planner", () => {
  it("builds moving average forecast plan", () => {
    clearTablesForTests();
    upsertTable("test::Sheet1", [{ revenue: 10 }, { revenue: 20 }]);
    const plan = buildPlan({ intent: "forecast", targetColumn: "revenue" }, "test::Sheet1");
    expect(plan.schemaVersion).toBe(getCurrentSchemaVersion("test::Sheet1"));
    expect(plan.steps).toEqual([
      { action: "select_column", column: "revenue" },
      {
        action: "apply_model",
        type: "moving_average",
        column: "revenue",
        period: 3,
        forecastHorizon: 3,
        seasonLength: 4,
        d: 1,
        p: 1,
        q: 0,
      },
    ]);
  });
});
