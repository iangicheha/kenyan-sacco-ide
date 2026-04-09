import { describe, it, expect, beforeEach } from "vitest";
import { clearTablesForTests, upsertTable } from "../data/tableStore";
import { filterRetrievedContextToSchema } from "./validator";

describe("filterRetrievedContextToSchema", () => {
  beforeEach(() => {
    clearTablesForTests();
    upsertTable("demo::Sheet1", [{ revenue: 10, cost: 5 }]);
  });

  it("drops unknown tables and columns from retrieved context", () => {
    const filtered = filterRetrievedContextToSchema({
      relevantTables: [
        {
          name: "demo::Sheet1",
          score: 0.9,
          columns: ["revenue", "ghost_col"],
          sample: [{ revenue: 1, ghost_col: 2 } as Record<string, string | number | boolean | null>],
        },
        { name: "nope::Missing", score: 0.8, columns: ["x"], sample: [] },
      ],
      relevantColumns: [
        { tableName: "demo::Sheet1", column: "revenue", score: 0.95 },
        { tableName: "demo::Sheet1", column: "not_a_column", score: 0.9 },
      ],
      relevantDocs: [],
      selectedChunks: [
        {
          id: "column:demo::Sheet1:revenue",
          kind: "column",
          score: 0.9,
          text: JSON.stringify({ type: "column", tableName: "demo::Sheet1", column: "revenue" }),
        },
        {
          id: "column:demo::Sheet1:bad",
          kind: "column",
          score: 0.8,
          text: JSON.stringify({ type: "column", tableName: "demo::Sheet1", column: "not_a_column" }),
        },
      ],
    });

    expect(filtered.relevantTables.map((t) => t.name)).toEqual(["demo::Sheet1"]);
    expect(filtered.relevantTables[0].columns).not.toContain("ghost_col");
    expect(filtered.relevantColumns.map((c) => c.column)).toEqual(["revenue"]);
    expect(filtered.selectedChunks?.some((c) => c.text.includes("not_a_column"))).toBe(false);
  });
});
