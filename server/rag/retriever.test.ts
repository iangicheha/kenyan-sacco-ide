import { describe, it, expect, beforeEach } from "vitest";
import { clearTablesForTests, upsertTable } from "../data/tableStore";
import { clearEmbeddingCache } from "./embeddings";
import { retrieveForQuery, _resetRagForTests, syncTableIndexFromStore } from "./retriever";

describe("rag retriever", () => {
  beforeEach(() => {
    process.env.RAG_USE_LOCAL_EMBEDDINGS = "true";
    clearTablesForTests();
    _resetRagForTests();
    clearEmbeddingCache();
  });

  it("returns relevant tables for a matching query", async () => {
    upsertTable("sales_quarterly::Sheet1", [
      { sales_total: 100, region: "Nairobi" },
      { sales_total: 200, region: "Mombasa" },
    ]);
    upsertTable("hr_roster::Sheet1", [{ employee_id: "E1", department: "Ops" }]);

    await syncTableIndexFromStore();
    const ctx = await retrieveForQuery("sales totals by region and quarterly revenue", { topK: 16 });

    const names = ctx.relevantTables.map((t) => t.name);
    expect(names.some((n) => n.includes("sales_quarterly"))).toBe(true);
    expect(ctx.relevantColumns.some((c) => c.column.toLowerCase() === "sales_total")).toBe(true);
    expect(ctx.selectedChunks?.length).toBeGreaterThan(0);
    expect(ctx.selectedChunks?.[0]?.score).toBeGreaterThanOrEqual(0);
  });
});
