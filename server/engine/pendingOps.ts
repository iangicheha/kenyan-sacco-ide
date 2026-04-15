import { randomUUID } from "node:crypto";
import { env } from "../config/env.js";
import { getSupabase } from "../lib/supabase.js";
import type { PendingOperation } from "../types.js";

const pendingOpsStore: PendingOperation[] = [];

export async function createPendingFormulaOperation(input: {
  tenantId: string;
  sessionId: string;
  cellRef: string;
  formula: string;
  reasoning: string;
  regulationReference?: string;
  confidence: number;
}): Promise<PendingOperation> {
  const operation: PendingOperation = {
    id: randomUUID(),
    tenantId: input.tenantId,
    sessionId: input.sessionId,
    cellRef: input.cellRef,
    kind: "formula",
    formula: input.formula,
    oldValue: null,
    newValuePreview: "calculated on accept",
    reasoning: input.reasoning,
    regulationReference: input.regulationReference,
    confidence: input.confidence,
    status: "pending",
    createdAt: new Date().toISOString(),
  };

  const supabase = getSupabase();
  if (supabase) {
    const { error } = await supabase.from("pending_operations").insert({
      id: operation.id,
      tenant_id: operation.tenantId,
      session_id: operation.sessionId,
      cell_ref: operation.cellRef,
      kind: operation.kind,
      formula: operation.formula,
      old_value: operation.oldValue,
      new_value_preview: operation.newValuePreview,
      reasoning: operation.reasoning,
      regulation_reference: operation.regulationReference ?? null,
      confidence: operation.confidence,
      status: operation.status,
      created_at: operation.createdAt,
    });
    if (error) {
      if (!env.allowInMemoryFallback) {
        throw new Error("Failed to persist pending operation and in-memory fallback is disabled.");
      }
      pendingOpsStore.push(operation);
    }
  } else {
    if (!env.allowInMemoryFallback) {
      throw new Error("Supabase is unavailable and in-memory fallback is disabled.");
    }
    pendingOpsStore.push(operation);
  }
  return operation;
}

export async function listPendingOperations(sessionId: string, tenantId: string): Promise<PendingOperation[]> {
  const supabase = getSupabase();
  if (supabase) {
    const { data, error } = await supabase
      .from("pending_operations")
      .select("*")
      .eq("tenant_id", tenantId)
      .eq("session_id", sessionId)
      .eq("status", "pending");

    if (!error && data) {
      return data.map((row) => ({
        id: row.id,
        tenantId: row.tenant_id,
        sessionId: row.session_id,
        cellRef: row.cell_ref,
        kind: row.kind,
        formula: row.formula ?? undefined,
        value: row.value ?? undefined,
        oldValue: row.old_value ?? null,
        newValuePreview: row.new_value_preview,
        reasoning: row.reasoning,
        regulationReference: row.regulation_reference ?? undefined,
        confidence: row.confidence,
        status: row.status,
        createdAt: row.created_at,
      }));
    }
  }

  if (!env.allowInMemoryFallback) return [];
  return pendingOpsStore.filter((op) => op.tenantId === tenantId && op.sessionId === sessionId && op.status === "pending");
}

export async function markOperationAccepted(operationId: string, tenantId: string): Promise<PendingOperation | null> {
  const supabase = getSupabase();
  if (supabase) {
    const { data, error } = await supabase
      .from("pending_operations")
      .update({ status: "accepted" })
      .eq("tenant_id", tenantId)
      .eq("id", operationId)
      .select("*")
      .single();

    if (!error && data) {
      return {
        id: data.id,
        tenantId: data.tenant_id,
        sessionId: data.session_id,
        cellRef: data.cell_ref,
        kind: data.kind,
        formula: data.formula ?? undefined,
        value: data.value ?? undefined,
        oldValue: data.old_value ?? null,
        newValuePreview: data.new_value_preview,
        reasoning: data.reasoning,
        regulationReference: data.regulation_reference ?? undefined,
        confidence: data.confidence,
        status: data.status,
        createdAt: data.created_at,
      };
    }
  }

  if (!env.allowInMemoryFallback) return null;
  const op = pendingOpsStore.find((item) => item.id === operationId && item.tenantId === tenantId);
  if (!op) return null;
  op.status = "accepted";
  return op;
}

export async function markOperationRejected(operationId: string, tenantId: string): Promise<PendingOperation | null> {
  const supabase = getSupabase();
  if (supabase) {
    const { data, error } = await supabase
      .from("pending_operations")
      .update({ status: "rejected" })
      .eq("tenant_id", tenantId)
      .eq("id", operationId)
      .select("*")
      .single();

    if (!error && data) {
      return {
        id: data.id,
        tenantId: data.tenant_id,
        sessionId: data.session_id,
        cellRef: data.cell_ref,
        kind: data.kind,
        formula: data.formula ?? undefined,
        value: data.value ?? undefined,
        oldValue: data.old_value ?? null,
        newValuePreview: data.new_value_preview,
        reasoning: data.reasoning,
        regulationReference: data.regulation_reference ?? undefined,
        confidence: data.confidence,
        status: data.status,
        createdAt: data.created_at,
      };
    }
  }

  if (!env.allowInMemoryFallback) return null;
  const op = pendingOpsStore.find((item) => item.id === operationId && item.tenantId === tenantId);
  if (!op) return null;
  op.status = "rejected";
  return op;
}
