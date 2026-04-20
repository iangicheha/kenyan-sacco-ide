import { ServiceUnavailableError } from "../lib/serviceUnavailableError.js";
import { getSupabase } from "../lib/supabase.js";
import type { AuditLogEntry } from "../types.js";

export async function appendAuditLog(entry: AuditLogEntry): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) {
    throw new ServiceUnavailableError("Failed to write audit log.", {
      store: "audit_log",
      reason: "supabase_unavailable",
    });
  }

  const basePayload = {
    tenant_id: entry.tenantId,
    operation_id: entry.operationId,
    session_id: entry.sessionId,
    cell_ref: entry.cellRef,
    formula_applied: entry.formulaApplied ?? null,
    values_written: entry.valuesWritten,
    analyst: entry.analyst,
    timestamp: entry.timestamp,
    ai_reasoning: entry.aiReasoning,
    correlation_id: entry.correlationId ?? null,
  };
  const extendedPayload = {
    ...basePayload,
    policy_version: entry.policyVersion ?? null,
    policy_id: entry.policyId ?? null,
  };
  const extendedInsert = await supabase.from("audit_log").insert(extendedPayload);
  if (!extendedInsert.error) return;
  const legacyInsert = await supabase.from("audit_log").insert(basePayload);
  if (!legacyInsert.error) return;

  throw new ServiceUnavailableError("Failed to write audit log.", {
    store: "audit_log",
    reason: "supabase_insert_failed",
  });
}

export async function getAuditLog(sessionId: string, tenantId: string): Promise<AuditLogEntry[]> {
  const supabase = getSupabase();
  if (!supabase) {
    throw new ServiceUnavailableError("Failed to fetch audit log.", {
      store: "audit_log",
      reason: "supabase_unavailable",
    });
  }

  const { data, error } = await supabase
    .from("audit_log")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("session_id", sessionId)
    .order("timestamp", { ascending: false })
    .limit(200);

  if (error) {
    throw new ServiceUnavailableError("Failed to fetch audit log.", {
      store: "audit_log",
      reason: "supabase_query_failed",
    });
  }

  return data?.map((row) => ({
    tenantId: row.tenant_id,
    operationId: row.operation_id,
    sessionId: row.session_id,
    cellRef: row.cell_ref,
    formulaApplied: row.formula_applied ?? undefined,
    valuesWritten: row.values_written ?? [],
    analyst: row.analyst,
    timestamp: row.timestamp,
    aiReasoning: row.ai_reasoning,
    correlationId: row.correlation_id ?? undefined,
    policyVersion: row.policy_version ?? undefined,
    policyId: row.policy_id ?? undefined,
  })) ?? [];
}

export async function cleanupExpiredAuditRecords(retentionDays: number): Promise<{ deleted: number; mode: "supabase" | "none" }> {
  const thresholdIso = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000).toISOString();
  const supabase = getSupabase();
  if (!supabase) {
    throw new ServiceUnavailableError("Failed to cleanup audit records.", {
      store: "audit_log",
      reason: "supabase_unavailable",
    });
  }

  const { data, error } = await supabase.from("audit_log").delete().lt("timestamp", thresholdIso).select("id");
  if (error) {
    throw new ServiceUnavailableError("Failed to cleanup audit records.", {
      store: "audit_log",
      reason: "supabase_delete_failed",
    });
  }

  return { deleted: data?.length ?? 0, mode: "supabase" };
}
