import { describe, expect, it } from "vitest";
import { appendWorkflowTransition, listWorkflowTransitions } from "./workflowState.js";

describe("workflowState", () => {
  it("stores transitions in order for a session", async () => {
    const sessionId = "session-test-1";
    await appendWorkflowTransition({
      sessionId,
      operationId: "op-1",
      correlationId: "corr-1",
      fromState: "draft",
      toState: "pending_review",
      actor: "analyst@example.com",
      reason: "Queued for review",
    });
    await appendWorkflowTransition({
      sessionId,
      operationId: "op-1",
      correlationId: "corr-1",
      fromState: "pending_review",
      toState: "accepted",
      actor: "reviewer@example.com",
      reason: "Approved",
    });

    const entries = await listWorkflowTransitions(sessionId);
    expect(entries.length).toBeGreaterThanOrEqual(2);
    expect(entries[0]?.toState).toBe("accepted");
    expect(entries[1]?.toState).toBe("pending_review");
  });
});
