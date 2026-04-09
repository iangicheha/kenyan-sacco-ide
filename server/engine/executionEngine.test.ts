import { describe, it, expect } from "vitest";
import { clearTablesForTests, rollbackTable, upsertTable } from "../data/tableStore";
import { executePlan } from "./executionEngine";

describe("execution engine", () => {
  it("returns deterministic sum", () => {
    clearTablesForTests();
    const table = upsertTable("finance::Q1", [{ amount: 10 }, { amount: 30 }, { amount: 60 }]);
    const result = executePlan({
      intent: "sum",
      tableName: "finance::Q1",
      schemaVersion: table.version,
      steps: [{ action: "aggregate", operation: "sum", column: "amount" }],
    });
    expect(result.result).toBe(100);
  });

  it("supports deterministic advanced forecast models", () => {
    clearTablesForTests();
    const table = upsertTable("finance::Q2", [
      { revenue: 10 },
      { revenue: 12 },
      { revenue: 13 },
      { revenue: 15 },
      { revenue: 16 },
    ]);
    const models = ["holt_winters", "linear_regression", "exponential_smoothing", "arima"] as const;
    for (const model of models) {
      const result = executePlan({
        intent: "forecast",
        tableName: "finance::Q2",
        schemaVersion: table.version,
        steps: [{ action: "apply_model", type: model, column: "revenue", forecastHorizon: 2, d: 1, p: 1, q: 0 }],
      });
      expect(result.result).toBeTruthy();
    }
  });

  it("rejects stale schema versions and supports rollback", () => {
    clearTablesForTests();
    const v1 = upsertTable("finance::Versioned", [{ amount: 50 }]);
    upsertTable("finance::Versioned", [{ amount: 75 }]);
    expect(() =>
      executePlan({
        intent: "sum",
        tableName: "finance::Versioned",
        schemaVersion: v1.version,
        steps: [{ action: "aggregate", operation: "sum", column: "amount" }],
      })
    ).toThrow(/Schema version mismatch/);
    const restored = rollbackTable("finance::Versioned", v1.version);
    expect(restored.version).toBeGreaterThan(v1.version);
    const result = executePlan({
      intent: "sum",
      tableName: "finance::Versioned",
      schemaVersion: restored.version,
      steps: [{ action: "aggregate", operation: "sum", column: "amount" }],
    });
    expect(result.result).toBe(50);
  });
});
