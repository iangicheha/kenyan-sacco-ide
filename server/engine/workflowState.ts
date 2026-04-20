import { ServiceUnavailableError } from "../lib/serviceUnavailableError.js";
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

export async function appendWorkflowTransition(
  transition: Omit<WorkflowTransition, "timestamp">
): Promise<WorkflowTransition> {
  const record: WorkflowTransition = {
    ...transition,
    timestamp: new Date().toISOString(),
  };

  const supabase = getSupabase();
  if (!supabase) {
    throw new ServiceUnavailableError("Failed to persist workflow transition.", {
      store: "workflow_transitions",
      reason: "supabase_unavailable",
    });
  }

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

  if (error) {
    throw new ServiceUnavailableError("Failed to persist workflow transition.", {
      store: "workflow_transitions",
      reason: "supabase_insert_failed",
    });
  }

  return record;
}

export async function listWorkflowTransitions(sessionId: string, tenantId: string): Promise<WorkflowTransition[]> {
  const supabase = getSupabase();
  if (!supabase) {
    throw new ServiceUnavailableError("Failed to fetch workflow transitions.", {
      store: "workflow_transitions",
      reason: "supabase_unavailable",
    });
  }

  const { data, error } = await supabase
    .from("workflow_transitions")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("session_id", sessionId)
    .order("timestamp", { ascending: false })
    .limit(500);

  if (error) {
    throw new ServiceUnavailableError("Failed to fetch workflow transitions.", {
      store: "workflow_transitions",
      reason: "supabase_query_failed",
    });
  }

  return data?.map((row) => ({
    tenantId: row.tenant_id,
    sessionId: row.session_id,
    operationId: row.operation_id ?? undefined,
    correlationId: row.correlation_id,
    fromState: (row.from_state as WorkflowState | null) ?? undefined,
    toState: row.to_state as WorkflowState,
    actor: row.actor,
    reason: row.reason ?? undefined,
    timestamp: row.timestamp,
  })) ?? [];
}
