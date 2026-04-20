import { randomUUID } from "node:crypto";
import { ServiceUnavailableError } from "../lib/serviceUnavailableError.js";
import { getSupabase } from "../lib/supabase.js";
import type { PendingOperation } from "../types.js";

export async function createPendingFormulaOperation(input: {
  tenantId: string;
  sessionId: string;
  cellRef: string;
  formula: string;
  reasoning: string;
  regulationReference?: string;
  confidence: number;
  policyVersion?: string;
  policyId?: string;
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
    policyVersion: input.policyVersion,
    policyId: input.policyId,
    status: "pending",
    createdAt: new Date().toISOString(),
  };

  const supabase = getSupabase();
  if (!supabase) {
    throw new ServiceUnavailableError("Failed to persist pending operation.", {
      store: "pending_operations",
      reason: "supabase_unavailable",
    });
  }

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
    policy_version: operation.policyVersion ?? null,
    policy_id: operation.policyId ?? null,
    status: operation.status,
    created_at: operation.createdAt,
  });

  if (error) {
    throw new ServiceUnavailableError("Failed to persist pending operation.", {
      store: "pending_operations",
      reason: "supabase_insert_failed",
    });
  }

  return operation;
}

export async function getPendingOperationById(operationId: string): Promise<PendingOperation | null> {
  const supabase = getSupabase();
  if (!supabase) {
    throw new ServiceUnavailableError("Failed to fetch pending operation.", {
      store: "pending_operations",
      reason: "supabase_unavailable",
    });
  }

  const { data, error } = await supabase.from("pending_operations").select("*").eq("id", operationId).single();

  if (error) {
    if (error.code === "PGRST116") return null;
    throw new ServiceUnavailableError("Failed to fetch pending operation.", {
      store: "pending_operations",
      reason: "supabase_query_failed",
    });
  }

  if (!data) return null;

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
    policyVersion: data.policy_version ?? undefined,
    policyId: data.policy_id ?? undefined,
    status: data.status,
    createdAt: data.created_at,
  };
}

export async function listPendingOperations(sessionId: string, tenantId: string): Promise<PendingOperation[]> {
  const supabase = getSupabase();
  if (!supabase) {
    throw new ServiceUnavailableError("Failed to list pending operations.", {
      store: "pending_operations",
      reason: "supabase_unavailable",
    });
  }

  const { data, error } = await supabase
    .from("pending_operations")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("session_id", sessionId)
    .eq("status", "pending");

  if (error) {
    throw new ServiceUnavailableError("Failed to list pending operations.", {
      store: "pending_operations",
      reason: "supabase_query_failed",
    });
  }

  return data?.map((row) => ({
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
    policyVersion: row.policy_version ?? undefined,
    policyId: row.policy_id ?? undefined,
    status: row.status,
    createdAt: row.created_at,
  })) ?? [];
}

export async function cleanupExpiredRejectedPendingOperations(
  retentionDays: number
): Promise<{ deleted: number; mode: "supabase" | "none" }> {
  const thresholdIso = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000).toISOString();
  const supabase = getSupabase();
  if (!supabase) {
    throw new ServiceUnavailableError("Failed to cleanup pending operations.", {
      store: "pending_operations",
      reason: "supabase_unavailable",
    });
  }

  const { data, error } = await supabase
    .from("pending_operations")
    .delete()
    .eq("status", "rejected")
    .lt("created_at", thresholdIso)
    .select("id");

  if (error) {
    throw new ServiceUnavailableError("Failed to cleanup pending operations.", {
      store: "pending_operations",
      reason: "supabase_delete_failed",
    });
  }

  return { deleted: data?.length ?? 0, mode: "supabase" };
}

export async function markOperationAccepted(operationId: string, tenantId: string): Promise<PendingOperation | null> {
  const supabase = getSupabase();
  if (!supabase) {
    throw new ServiceUnavailableError("Failed to update pending operation.", {
      store: "pending_operations",
      reason: "supabase_unavailable",
    });
  }

  const { data, error } = await supabase
    .from("pending_operations")
    .update({ status: "accepted" })
    .eq("tenant_id", tenantId)
    .eq("id", operationId)
    .select("*")
    .single();

  if (error) {
    if (error.code === "PGRST116") return null;
    throw new ServiceUnavailableError("Failed to update pending operation.", {
      store: "pending_operations",
      reason: "supabase_update_failed",
    });
  }

  if (!data) return null;

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
    policyVersion: data.policy_version ?? undefined,
    policyId: data.policy_id ?? undefined,
    status: data.status,
    createdAt: data.created_at,
  };
}

export async function markOperationRejected(operationId: string, tenantId: string): Promise<PendingOperation | null> {
  const supabase = getSupabase();
  if (!supabase) {
    throw new ServiceUnavailableError("Failed to update pending operation.", {
      store: "pending_operations",
      reason: "supabase_unavailable",
    });
  }

  const { data, error } = await supabase
    .from("pending_operations")
    .update({ status: "rejected" })
    .eq("tenant_id", tenantId)
    .eq("id", operationId)
    .select("*")
    .single();

  if (error) {
    if (error.code === "PGRST116") return null;
    throw new ServiceUnavailableError("Failed to update pending operation.", {
      store: "pending_operations",
      reason: "supabase_update_failed",
    });
  }

  if (!data) return null;

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
    policyVersion: data.policy_version ?? undefined,
    policyId: data.policy_id ?? undefined,
    status: data.status,
    createdAt: data.created_at,
  };
}
