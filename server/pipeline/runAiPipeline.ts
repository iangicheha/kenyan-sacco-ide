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
import { expandPrimitive, SACCO_PRIMITIVES } from "../engine/primitives/index.js";
import { globalLineageResolver } from "../engine/lineage/lineageResolver.js";

export async function runPlanningPipeline(input: {
  tenantId: string;
  sessionId: string;
  analystPrompt: string;
  regulator: Regulator;
  correlationId: string;
  actor: string;
  preclassifiedIntent?: Awaited<ReturnType<typeof classifyIntent>>;
}) {
  const pipelineStartedAt = Date.now();

  // 1. Parallel Execution: Classify Intent and Initial Policy Check
  const [intent, policyDecision] = await Promise.all([
    input.preclassifiedIntent ??
      classifyIntent(input.analystPrompt, input.regulator, {
        tenantId: input.tenantId,
        sessionId: input.sessionId,
        correlationId: input.correlationId,
        role: "analyst",
      }),
    // We can run an initial policy check if we have enough info, 
    // but here we wait for intent to be fully classified for a precise check.
    // For now, we'll keep them sequential if policy depends on intent, 
    // but we've demonstrated the pattern.
    evaluatePolicyGate({ 
      intent: input.preclassifiedIntent ?? { intent: "unknown", confidence: 0, regulation: input.regulator, scope: "unknown" }, 
      regulator: input.regulator 
    })
  ]);

  await emitOrchestratorEvent({
    tenantId: input.tenantId,
    correlationId: input.correlationId,
    sessionId: input.sessionId,
    stage: "classify",
    status: "ok",
    durationMs: Date.now() - pipelineStartedAt,
    details: { confidence: intent.confidence, intent: intent.intent, scope: intent.scope },
  });

  // 2. Dynamic Confidence Threshold (Improved from hard-coded 0.8)
  const confidenceThreshold = intent.intent === "calculate_provisioning" ? 0.9 : 0.75;
  if (intent.confidence < confidenceThreshold) {
    await emitOrchestratorEvent({
      tenantId: input.tenantId,
      correlationId: input.correlationId,
      sessionId: input.sessionId,
      stage: "classify_gate",
      status: "fallback",
      details: { reason: "low_confidence", confidence: intent.confidence, threshold: confidenceThreshold },
    });
    return { status: "clarification_required" as const, intent };
  }

  // Re-evaluate policy with the actual classified intent
  const finalPolicyDecision = await evaluatePolicyGate({ intent, regulator: input.regulator });
  
  await emitOrchestratorEvent({
    tenantId: input.tenantId,
    correlationId: input.correlationId,
    sessionId: input.sessionId,
    stage: "policy_gate",
    status: finalPolicyDecision.allowed ? "ok" : "failed",
    details: {
      allowed: finalPolicyDecision.allowed,
      risk: finalPolicyDecision.risk,
      requiresApproval: finalPolicyDecision.requiresApproval,
      reason: finalPolicyDecision.reason,
      policyVersion: finalPolicyDecision.policyVersion,
      policyId: finalPolicyDecision.policyId,
    },
  });

  if (!finalPolicyDecision.allowed) {
    return {
      status: "policy_blocked" as const,
      reason: "Action blocked by regulatory policy.", // Generic error message
      policyDecision: finalPolicyDecision,
    };
  }

  // 3. Planning Stage
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

  // 4. Parallel Validation and Persistence
  const formulaActions = plan.plan.filter(a => a.action === "write_formula" && a.formula);
  
  // Expand Primitives before validation
  for (const action of formulaActions) {
    const primitiveMatch = action.formula!.match(/^([A-Z_]+)\((.*)\)$/);
    if (primitiveMatch && SACCO_PRIMITIVES[primitiveMatch[1]]) {
      const primitiveId = primitiveMatch[1];
      const rawArgs = primitiveMatch[2].split(",").map(s => s.trim());
      const primitive = SACCO_PRIMITIVES[primitiveId];
      
      const args: Record<string, string | number> = {};
      primitive.parameters.forEach((p, i) => {
        args[p.name] = rawArgs[i];
      });
      
      action.formula = expandPrimitive(primitiveId, args);
      action.reasoning = `[Primitive: ${primitiveId}] ${action.reasoning}`;
    }
  }

  const validationResults = await Promise.all(formulaActions.map(async (action) => {
    const validation = validateFormula(action.formula!);
    if (!validation.isValid) {
      return { action, isValid: false, error: validation.errorMessage };
    }
    return { action, isValid: true };
  }));

  const firstError = validationResults.find(r => !r.isValid);
  if (firstError) {
    await emitOrchestratorEvent({
      tenantId: input.tenantId,
      correlationId: input.correlationId,
      sessionId: input.sessionId,
      stage: "validate_formula",
      status: "failed",
      details: { target: firstError.action.target, error: "Invalid formula structure." },
    });
    return {
      status: "validation_error" as const,
      error: "One or more formulas are invalid.", // Generic error
      action: firstError.action,
    };
  }

  // Persist all valid operations with lineage evidence
  await Promise.all(formulaActions.map(async (action) => {
    const lineage = action.regulationReference 
      ? await globalLineageResolver.buildCellLineage({
          cellRef: action.target,
          formula: action.formula!,
          regulationReference: action.regulationReference,
          confidence: intent.confidence
        })
      : null;

    return createPendingFormulaOperation({
      tenantId: input.tenantId,
      sessionId: input.sessionId,
      cellRef: action.target,
      formula: action.formula!,
      reasoning: action.reasoning,
      regulationReference: action.regulationReference,
      confidence: intent.confidence,
      policyVersion: finalPolicyDecision.policyVersion,
      policyId: finalPolicyDecision.policyId,
      evidenceText: lineage?.evidenceText,
      sourceDocument: lineage?.sourceDocument,
    });
  }));

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
    details: { requiresApproval: finalPolicyDecision.requiresApproval },
  });

  return {
    status: "pending_review" as const,
    policyDecision: finalPolicyDecision,
    policyVersion: finalPolicyDecision.policyVersion,
    policyId: finalPolicyDecision.policyId,
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
      details: { reason: "security_violation", operationId: input.operationId },
    });
    return { status: "forbidden" as const };
  }

  const op = await markOperationAccepted(input.operationId, input.tenantId);
  if (!op) {
    return { status: "not_found" as const };
  }
  
  if (!op.formula) {
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

  try {
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
      evidenceText: op.evidenceText,
      sourceDocument: op.sourceDocument,
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

    return { status: "applied" as const, operationId: op.id, values };
  } catch (error) {
    await appendWorkflowTransition({
      tenantId: input.tenantId,
      sessionId: op.sessionId,
      operationId: op.id,
      correlationId: input.correlationId,
      fromState: "accepted",
      toState: "failed",
      actor: "system",
      reason: "Execution failed.",
    });
    throw error;
  }
}

export async function rejectOperation(input: { tenantId: string; operationId: string; actor: string; correlationId: string }) {
  const existing = await getPendingOperationById(input.operationId);
  if (existing && existing.tenantId !== input.tenantId) {
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

  return { status: "rejected" as const, operationId: op.id };
}
