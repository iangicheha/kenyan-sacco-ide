import { env } from "../config/env.js";
import { getSupabase } from "../lib/supabase.js";
import type { AuditLogEntry } from "../types.js";

const auditLogStore: AuditLogEntry[] = [];

export async function appendAuditLog(entry: AuditLogEntry): Promise<void> {
  const supabase = getSupabase();
  if (supabase) {
    const { error } = await supabase.from("audit_log").insert({
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
    });
    if (!error) return;
  }
  if (!env.allowInMemoryFallback) {
    throw new Error("Failed to write audit log and in-memory fallback is disabled.");
  }
  auditLogStore.push(entry);
}

export async function getAuditLog(sessionId: string, tenantId: string): Promise<AuditLogEntry[]> {
  const supabase = getSupabase();
  if (supabase) {
    const { data, error } = await supabase
      .from("audit_log")
      .select("*")
      .eq("tenant_id", tenantId)
      .eq("session_id", sessionId)
      .order("timestamp", { ascending: false })
      .limit(200);
    if (!error && data) {
      return data.map((row) => ({
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
      }));
    }
  }
  if (!env.allowInMemoryFallback) return [];
  return auditLogStore.filter((entry) => entry.tenantId === tenantId && entry.sessionId === sessionId);
}
