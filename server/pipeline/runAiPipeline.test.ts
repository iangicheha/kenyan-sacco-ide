import { randomUUID } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { getAuditLog } from "../engine/auditLogger.js";
import { listOrchestratorEvents } from "../engine/orchestratorTelemetry.js";
import { listPendingOperations } from "../engine/pendingOps.js";
import { listWorkflowTransitions } from "../engine/workflowState.js";
import { acceptOperation, rejectOperation, runPlanningPipeline } from "./runAiPipeline.js";

vi.mock("../engine/policyStore.js", () => ({
  getActivePolicy: vi.fn(async () => ({
    id: "policy-test-1",
    regulator: "CBK" as const,
    version: "1.0.0",
    rulesJson: {
      highRiskIntents: ["calculate_provisioning", "generate_report", "validate_data"],
      requiresApproval: true,
    },
    effectiveFrom: new Date().toISOString(),
    isActive: true,
    createdAt: new Date().toISOString(),
  })),
}));

vi.mock("../agents/financialPlanner.js", () => {
  return {
    buildFinancialPlan: vi.fn(async () => ({
      plan: [
        {
          step: 1,
          action: "write_formula",
          target: "E2",
          formula: "=SUM(A1:A1)",
          reasoning: "Test deterministic formula operation",
          regulationReference: "CBK/TEST",
        },
      ],
    })),
  };
});

describe("runAiPipeline operational lifecycle", () => {
  it("queues and accepts operation with workflow/audit/events", async () => {
    const tenantId = "tenant-a";
    const sessionId = `${tenantId}:session-${randomUUID()}`;
    const correlationId = `corr-${randomUUID()}`;
    const actor = "reviewer@test.local";

    const planned = await runPlanningPipeline({
      tenantId,
      sessionId,
      analystPrompt: "calculate provisioning and write formula",
      regulator: "CBK",
      correlationId,
      actor,
      preclassifiedIntent: {
        intent: "calculate_provisioning",
        scope: "column_range",
        regulation: "CBK",
        confidence: 0.93,
      },
    });

    expect(planned.status).toBe("pending_review");
    if (planned.status !== "pending_review") {
      throw new Error("Expected pending_review");
    }
    expect(planned.pendingOperations.length).toBeGreaterThan(0);

    const operationId = planned.pendingOperations[0]?.id;
    expect(operationId).toBeTruthy();

    const applied = await acceptOperation({
      tenantId,
      operationId: operationId!,
      analyst: actor,
      correlationId,
      sheetData: { A1: 120 },
    });
    expect(applied.status).toBe("applied");

    const pending = await listPendingOperations(sessionId, tenantId);
    expect(pending.find((item) => item.id === operationId)).toBeUndefined();

    const auditEntries = await getAuditLog(sessionId, tenantId);
    expect(auditEntries.length).toBeGreaterThan(0);
    expect(auditEntries[0]?.correlationId).toBe(correlationId);

    const transitions = await listWorkflowTransitions(sessionId, tenantId);
    expect(transitions.some((item) => item.toState === "pending_review")).toBe(true);
    expect(transitions.some((item) => item.toState === "accepted")).toBe(true);
    expect(transitions.some((item) => item.toState === "executed")).toBe(true);

    const events = await listOrchestratorEvents(sessionId, tenantId);
    expect(events.some((item) => item.stage === "queue_review")).toBe(true);
    expect(events.some((item) => item.stage === "accept_operation" && item.status === "ok")).toBe(true);
  });

  it("queues and rejects operation with rejection transition", async () => {
    const tenantId = "tenant-a";
    const sessionId = `${tenantId}:session-${randomUUID()}`;
    const correlationId = `corr-${randomUUID()}`;
    const actor = "reviewer@test.local";

    const planned = await runPlanningPipeline({
      tenantId,
      sessionId,
      analystPrompt: "generate report and write formula",
      regulator: "SASRA",
      correlationId,
      actor,
      preclassifiedIntent: {
        intent: "generate_report",
        scope: "sheet_range",
        regulation: "SASRA",
        confidence: 0.95,
      },
    });

    expect(planned.status).toBe("pending_review");
    if (planned.status !== "pending_review") {
      throw new Error("Expected pending_review");
    }

    const operationId = planned.pendingOperations[0]?.id;
    expect(operationId).toBeTruthy();

    const rejected = await rejectOperation({
      tenantId,
      operationId: operationId!,
      actor,
      correlationId,
    });
    expect(rejected.status).toBe("rejected");

    const transitions = await listWorkflowTransitions(sessionId, tenantId);
    expect(transitions.some((item) => item.toState === "rejected")).toBe(true);
  });
});
