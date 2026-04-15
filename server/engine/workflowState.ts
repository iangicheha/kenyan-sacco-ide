import { env } from "../config/env.js";
import { getSupabase } from "../lib/supabase.js";

export type WorkflowState =
  | "draft"
  | "pending_review"
  | "accepted"
  | "rejected"
  | "executed"
  | "failed"
  | "closed";

export interface WorkflowTransition {
  tenantId: string;
  sessionId: string;
  operationId?: string;
  correlationId: string;
  fromState?: WorkflowState;
  toState: WorkflowState;
  actor: string;
  reason?: string;
  timestamp: string;
}

const workflowStore: WorkflowTransition[] = [];

export async function appendWorkflowTransition(
  transition: Omit<WorkflowTransition, "timestamp">
): Promise<WorkflowTransition> {
  const record: WorkflowTransition = {
    ...transition,
    timestamp: new Date().toISOString(),
  };

  const supabase = getSupabase();
  if (supabase) {
    const { error } = await supabase.from("workflow_transitions").insert({
      tenant_id: record.tenantId,
      session_id: record.sessionId,
      operation_id: record.operationId ?? null,
      correlation_id: record.correlationId,
      from_state: record.fromState ?? null,
      to_state: record.toState,
      actor: record.actor,
      reason: record.reason ?? null,
      timestamp: record.timestamp,
    });
    if (!error) return record;
  }

  if (!env.allowInMemoryFallback) {
    throw new Error("Failed to persist workflow transition and in-memory fallback is disabled.");
  }
  workflowStore.push(record);
  return record;
}

export async function listWorkflowTransitions(sessionId: string, tenantId: string): Promise<WorkflowTransition[]> {
  const supabase = getSupabase();
  if (supabase) {
    const { data, error } = await supabase
      .from("workflow_transitions")
      .select("*")
      .eq("tenant_id", tenantId)
      .eq("session_id", sessionId)
      .order("timestamp", { ascending: false })
      .limit(500);

    if (!error && data) {
      return data.map((row) => ({
        tenantId: row.tenant_id,
        sessionId: row.session_id,
        operationId: row.operation_id ?? undefined,
        correlationId: row.correlation_id,
        fromState: (row.from_state as WorkflowState | null) ?? undefined,
        toState: row.to_state as WorkflowState,
        actor: row.actor,
        reason: row.reason ?? undefined,
        timestamp: row.timestamp,
      }));
    }
  }

  if (!env.allowInMemoryFallback) return [];
  return workflowStore.filter((item) => item.tenantId === tenantId && item.sessionId === sessionId).slice().reverse();
}
