import { buildFinancialPlan } from "../agents/financialPlanner.js";
import { classifyIntent } from "../agents/intentClassifier.js";
import { appendAuditLog } from "../engine/auditLogger.js";
import { executeFormulaRange } from "../engine/formulaExecutor.js";
import { emitOrchestratorEvent } from "../engine/orchestratorTelemetry.js";
import {
  createPendingFormulaOperation,
  listPendingOperations,
  getPendingOperationById,
  markOperationAccepted,
  markOperationRejected,
} from "../engine/pendingOps.js";
import { evaluatePolicyGate } from "../engine/policyGate.js";
import { appendWorkflowTransition } from "../engine/workflowState.js";
import { validateFormula } from "../tools/validateFormula.js";
import type { Regulator } from "../types.js";

export async function runPlanningPipeline(input: {
  tenantId: string;
  sessionId: string;
  analystPrompt: string;
  regulator: Regulator;
  correlationId: string;
  actor: string;
  preclassifiedIntent?: Awaited<ReturnType<typeof classifyIntent>>;
}) {
  const classifyStartedAt = Date.now();
  const intent =
    input.preclassifiedIntent ??
    (await classifyIntent(input.analystPrompt, input.regulator, {
      tenantId: input.tenantId,
      sessionId: input.sessionId,
      correlationId: input.correlationId,
      role: "analyst",
    }));
  await emitOrchestratorEvent({
    tenantId: input.tenantId,
    correlationId: input.correlationId,
    sessionId: input.sessionId,
    stage: "classify",
    status: "ok",
    durationMs: Date.now() - classifyStartedAt,
    details: { confidence: intent.confidence, intent: intent.intent, scope: intent.scope },
  });

  if (intent.confidence < 0.8) {
    await emitOrchestratorEvent({
      tenantId: input.tenantId,
      correlationId: input.correlationId,
      sessionId: input.sessionId,
      stage: "classify_gate",
      status: "fallback",
      details: { reason: "low_confidence", confidence: intent.confidence },
    });
    return { status: "clarification_required" as const, intent };
  }

  const policyDecision = await evaluatePolicyGate({ intent, regulator: input.regulator });
  await emitOrchestratorEvent({
    tenantId: input.tenantId,
    correlationId: input.correlationId,
    sessionId: input.sessionId,
    stage: "policy_gate",
    status: policyDecision.allowed ? "ok" : "failed",
    details: {
      allowed: policyDecision.allowed,
      risk: policyDecision.risk,
      requiresApproval: policyDecision.requiresApproval,
      reason: policyDecision.reason,
      policyVersion: policyDecision.policyVersion,
      policyId: policyDecision.policyId,
    },
  });
  if (!policyDecision.allowed) {
    return {
      status: "policy_blocked" as const,
      reason: policyDecision.reason,
      policyDecision,
    };
  }

  const planningStartedAt = Date.now();
  const plan = await buildFinancialPlan(intent, {
    tenantId: input.tenantId,
    sessionId: input.sessionId,
    correlationId: input.correlationId,
    role: "analyst",
  });
  await emitOrchestratorEvent({
    tenantId: input.tenantId,
    correlationId: input.correlationId,
    sessionId: input.sessionId,
    stage: "plan",
    status: "ok",
    durationMs: Date.now() - planningStartedAt,
    details: { actions: plan.plan.length },
  });

  for (const action of plan.plan) {
    if (action.action !== "write_formula" || !action.formula) continue;
    const validation = validateFormula(action.formula);
    if (!validation.isValid) {
      await emitOrchestratorEvent({
        tenantId: input.tenantId,
        correlationId: input.correlationId,
        sessionId: input.sessionId,
        stage: "validate_formula",
        status: "failed",
        details: { target: action.target, error: validation.errorMessage ?? "Invalid formula." },
      });
      return {
        status: "validation_error" as const,
        error: validation.errorMessage ?? "Invalid formula.",
        action,
      };
    }

    await createPendingFormulaOperation({
      tenantId: input.tenantId,
      sessionId: input.sessionId,
      cellRef: action.target,
      formula: action.formula,
      reasoning: action.reasoning,
      regulationReference: action.regulationReference,
      confidence: intent.confidence,
      policyVersion: policyDecision.policyVersion,
      policyId: policyDecision.policyId,
    });
  }

  await appendWorkflowTransition({
    tenantId: input.tenantId,
    sessionId: input.sessionId,
    correlationId: input.correlationId,
    fromState: "draft",
    toState: "pending_review",
    actor: input.actor,
    reason: "Plan created and pending operations queued.",
  });
  await emitOrchestratorEvent({
    tenantId: input.tenantId,
    correlationId: input.correlationId,
    sessionId: input.sessionId,
    stage: "queue_review",
    status: "ok",
    details: { requiresApproval: policyDecision.requiresApproval },
  });

  return {
    status: "pending_review" as const,
    policyDecision,
    policyVersion: policyDecision.policyVersion,
    policyId: policyDecision.policyId,
    pendingOperations: await listPendingOperations(input.sessionId, input.tenantId),
  };
}

export async function acceptOperation(input: {
  tenantId: string;
  operationId: string;
  analyst: string;
  correlationId: string;
  sheetData?: Record<string, string | number | boolean | null>;
}) {
  const startedAt = Date.now();
  const existing = await getPendingOperationById(input.operationId);
  if (existing && existing.tenantId !== input.tenantId) {
    await emitOrchestratorEvent({
      tenantId: input.tenantId,
      correlationId: input.correlationId,
      sessionId: existing.sessionId,
      stage: "accept_operation",
      status: "failed",
      details: { reason: "cross_tenant", operationId: input.operationId },
    });
    return { status: "forbidden" as const };
  }

  const op = await markOperationAccepted(input.operationId, input.tenantId);
  if (!op) {
    await emitOrchestratorEvent({
      tenantId: input.tenantId,
      correlationId: input.correlationId,
      sessionId: "unknown",
      stage: "accept_operation",
      status: "failed",
      details: { reason: "not_found", operationId: input.operationId },
    });
    return { status: "not_found" as const };
  }
  if (!op.formula) {
    await emitOrchestratorEvent({
      tenantId: input.tenantId,
      correlationId: input.correlationId,
      sessionId: op.sessionId,
      stage: "accept_operation",
      status: "failed",
      details: { reason: "invalid_operation", operationId: op.id },
    });
    return { status: "invalid_operation" as const };
  }

  await appendWorkflowTransition({
    tenantId: input.tenantId,
    sessionId: op.sessionId,
    operationId: op.id,
    correlationId: input.correlationId,
    fromState: "pending_review",
    toState: "accepted",
    actor: input.analyst,
    reason: "Reviewer accepted pending operation.",
  });

  const values = executeFormulaRange({ formula: op.formula, cellRef: op.cellRef, sheetData: input.sheetData });
  await appendAuditLog({
    tenantId: input.tenantId,
    operationId: op.id,
    sessionId: op.sessionId,
    cellRef: op.cellRef,
    formulaApplied: op.formula,
    valuesWritten: values,
    analyst: input.analyst,
    timestamp: new Date().toISOString(),
    aiReasoning: op.reasoning,
    correlationId: input.correlationId,
    policyVersion: op.policyVersion,
    policyId: op.policyId,
  });
  await appendWorkflowTransition({
    tenantId: input.tenantId,
    sessionId: op.sessionId,
    operationId: op.id,
    correlationId: input.correlationId,
    fromState: "accepted",
    toState: "executed",
    actor: input.analyst,
    reason: "Formula executed and audit logged.",
  });
  await emitOrchestratorEvent({
    tenantId: input.tenantId,
    correlationId: input.correlationId,
    sessionId: op.sessionId,
    stage: "accept_operation",
    status: "ok",
    durationMs: Date.now() - startedAt,
    details: { operationId: op.id, valuesCount: values.length },
  });

  return { status: "applied" as const, operationId: op.id, values };
}

export async function rejectOperation(input: { tenantId: string; operationId: string; actor: string; correlationId: string }) {
  const existing = await getPendingOperationById(input.operationId);
  if (existing && existing.tenantId !== input.tenantId) {
    await emitOrchestratorEvent({
      tenantId: input.tenantId,
      correlationId: input.correlationId,
      sessionId: existing.sessionId,
      stage: "reject_operation",
      status: "failed",
      details: { reason: "cross_tenant", operationId: input.operationId },
    });
    return { status: "forbidden" as const };
  }

  const op = await markOperationRejected(input.operationId, input.tenantId);
  if (!op) return { status: "not_found" as const };
  await appendWorkflowTransition({
    tenantId: input.tenantId,
    sessionId: op.sessionId,
    operationId: op.id,
    correlationId: input.correlationId,
    fromState: "pending_review",
    toState: "rejected",
    actor: input.actor,
    reason: "Reviewer rejected pending operation.",
  });
  await emitOrchestratorEvent({
    tenantId: input.tenantId,
    correlationId: input.correlationId,
    sessionId: op.sessionId,
    stage: "reject_operation",
    status: "ok",
    details: { operationId: op.id },
  });
  return { status: "rejected" as const, operationId: op.id };
}
