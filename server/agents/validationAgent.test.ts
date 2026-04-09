import { describe, it, expect } from "vitest";
import { validate } from "./validationAgent";
import type { AiExecutionPlan } from "../types";
import { clearTablesForTests, upsertTable } from "../data/tableStore";

describe("validationAgent", () => {
  it("accepts a plan that matches schema", () => {
    clearTablesForTests();
    upsertTable("t::Sheet1", [{ revenue: 10 }, { revenue: 20 }]);
    const plan: AiExecutionPlan = {
      intent: "sum",
      tableName: "t::Sheet1",
      schemaVersion: 1,
      steps: [{ action: "aggregate", operation: "sum", column: "revenue" }],
    };
    const out = validate(plan);
    expect(out.valid).toBe(true);
    expect(out.decisions.length).toBe(0);
  });

  it("rejects unknown columns (no hallucinated fields)", () => {
    clearTablesForTests();
    upsertTable("t::Sheet1", [{ revenue: 10 }]);
    const plan: AiExecutionPlan = {
      intent: "sum",
      tableName: "t::Sheet1",
      schemaVersion: 1,
      steps: [{ action: "aggregate", operation: "sum", column: "not_a_column" }],
    };
    const out = validate(plan);
    expect(out.valid).toBe(false);
    expect(out.message).toMatch(/Unknown column/i);
  });
});
