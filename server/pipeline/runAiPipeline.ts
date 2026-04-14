import { buildFinancialPlan } from "../agents/financialPlanner.js";
import { classifyIntent } from "../agents/intentClassifier.js";
import { appendAuditLog } from "../engine/auditLogger.js";
import { executeFormulaRange } from "../engine/formulaExecutor.js";
import {
  createPendingFormulaOperation,
  listPendingOperations,
  markOperationAccepted,
  markOperationRejected,
} from "../engine/pendingOps.js";
import { validateFormula } from "../tools/validateFormula.js";
import type { Regulator } from "../types.js";

export async function runPlanningPipeline(input: {
  sessionId: string;
  analystPrompt: string;
  regulator: Regulator;
}) {
  const intent = await classifyIntent(input.analystPrompt, input.regulator);
  if (intent.confidence < 0.8) {
    return { status: "clarification_required" as const, intent };
  }

  const plan = await buildFinancialPlan(intent);
  for (const action of plan.plan) {
    if (action.action !== "write_formula" || !action.formula) continue;
    const validation = validateFormula(action.formula);
    if (!validation.isValid) {
      return {
        status: "validation_error" as const,
        error: validation.errorMessage ?? "Invalid formula.",
        action,
      };
    }

    await createPendingFormulaOperation({
      sessionId: input.sessionId,
      cellRef: action.target,
      formula: action.formula,
      reasoning: action.reasoning,
      regulationReference: action.regulationReference,
      confidence: intent.confidence,
    });
  }

  return {
    status: "pending_review" as const,
    pendingOperations: await listPendingOperations(input.sessionId),
  };
}

export async function acceptOperation(input: {
  operationId: string;
  analyst: string;
  sheetData?: Record<string, string | number | boolean | null>;
}) {
  const op = await markOperationAccepted(input.operationId);
  if (!op) {
    return { status: "not_found" as const };
  }
  if (!op.formula) {
    return { status: "invalid_operation" as const };
  }

  const values = executeFormulaRange({ formula: op.formula, cellRef: op.cellRef, sheetData: input.sheetData });
  await appendAuditLog({
    operationId: op.id,
    sessionId: op.sessionId,
    cellRef: op.cellRef,
    formulaApplied: op.formula,
    valuesWritten: values,
    analyst: input.analyst,
    timestamp: new Date().toISOString(),
    aiReasoning: op.reasoning,
  });

  return { status: "applied" as const, operationId: op.id, values };
}

export async function rejectOperation(input: { operationId: string }) {
  const op = await markOperationRejected(input.operationId);
  if (!op) return { status: "not_found" as const };
  return { status: "rejected" as const, operationId: op.id };
}
