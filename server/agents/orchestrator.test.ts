import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import * as validationAgent from "./validationAgent";
import { run, _clearOrchestratorCachesForTests } from "./orchestrator";
import { clearTablesForTests, upsertTable } from "../data/tableStore";
import { _resetRagForTests } from "../rag/retriever";
import { clearEmbeddingCache } from "../rag/embeddings";

describe("orchestrator", () => {
  beforeEach(() => {
    process.env.RAG_USE_LOCAL_EMBEDDINGS = "true";
    delete process.env.AI_MODEL_KEY;
    delete process.env.OPENAI_API_KEY;
    clearTablesForTests();
    _resetRagForTests();
    clearEmbeddingCache();
    _clearOrchestratorCachesForTests();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("coordinates data → planning → validation → execution with structured JSON outputs", async () => {
    upsertTable("demo::Sheet1", [{ revenue: 100 }, { revenue: 200 }]);
    const out = await run({
      query: "sum revenue",
      tableNameHint: "demo::Sheet1",
      skipCaches: true,
    });

    expect(out.context.relevantTables.length).toBeGreaterThanOrEqual(0);
    expect(out.context.confidence).toBeGreaterThanOrEqual(0);
    expect(out.validation.valid).toBe(true);
    expect(out.plan.tableName).toBe("demo::Sheet1");
    expect(out.execution.steps.length).toBeGreaterThan(0);
    expect(out.result).toBe(300);
    expect(out.metrics.dataAgentMs).toBeGreaterThanOrEqual(0);
    expect(out.metrics.planningAgentMs).toBeGreaterThanOrEqual(0);
    expect(out.metrics.validationAgentMs).toBeGreaterThanOrEqual(0);
    expect(out.metrics.executionMs).toBeGreaterThanOrEqual(0);
    expect(out.agentPipeline.retries.length).toBe(0);
  });

  it("retries planning when validation fails (max 2 retries) then succeeds", async () => {
    upsertTable("demo::Sheet1", [{ revenue: 5 }, { revenue: 5 }]);
    const orig = validationAgent.validate;
    let calls = 0;
    vi.spyOn(validationAgent, "validate").mockImplementation((plan) => {
      calls++;
      if (calls <= 2) {
        return {
          valid: false,
          message: "forced invalid for test",
          decisions: [{ code: "test", detail: "retry", severity: "error" }],
          latencyMs: 0,
        };
      }
      return orig(plan);
    });

    const out = await run({
      query: "sum revenue",
      tableNameHint: "demo::Sheet1",
      skipCaches: true,
    });

    expect(calls).toBe(3);
    expect(out.retries.length).toBe(2);
    expect(out.retries[0].reason).toContain("forced");
    expect(out.validation.valid).toBe(true);
    expect(out.result).toBe(10);
  });

  it("returns deterministic outputs for the same query with caches cleared per run", async () => {
    upsertTable("demo::Sheet1", [{ revenue: 2 }, { revenue: 3 }]);
    const a = await run({
      query: "average revenue",
      tableNameHint: "demo::Sheet1",
      skipCaches: true,
    });
    const b = await run({
      query: "average revenue",
      tableNameHint: "demo::Sheet1",
      skipCaches: true,
    });
    expect(a.plan.intent).toBe(b.plan.intent);
    expect(a.plan.tableName).toBe(b.plan.tableName);
    expect(a.result).toBe(b.result);
  });

  it("caches RAG and plan results for repeated queries", async () => {
    upsertTable("demo::Sheet1", [{ revenue: 1 }]);
    const first = await run({
      query: "sum revenue",
      tableNameHint: "demo::Sheet1",
      skipCaches: false,
    });
    const second = await run({
      query: "sum revenue",
      tableNameHint: "demo::Sheet1",
      skipCaches: false,
    });
    expect(second.context.cacheHit).toBe(true);
    expect(second.planning.cacheHit).toBe(true);
    expect(first.context.cacheHit).toBe(false);
    expect(first.planning.cacheHit).toBe(false);
  });
});
