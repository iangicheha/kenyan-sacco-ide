import { appendOutboxEvent } from "./outboxStore.js";
import { publishRealtimeEvent } from "../lib/realtimeHub.js";
import { ServiceUnavailableError } from "../lib/serviceUnavailableError.js";
import { getSupabase } from "../lib/supabase.js";

export interface OrchestratorEvent {
  tenantId: string;
  correlationId: string;
  sessionId: string;
  stage: string;
  status: "ok" | "failed" | "fallback";
  durationMs?: number;
  details?: Record<string, unknown>;
  createdAt: string;
}

export async function emitOrchestratorEvent(event: Omit<OrchestratorEvent, "createdAt">): Promise<void> {
  const record: OrchestratorEvent = {
    ...event,
    createdAt: new Date().toISOString(),
  };

  const supabase = getSupabase();
  if (!supabase) {
    throw new ServiceUnavailableError("Failed to persist orchestrator telemetry event.", {
      store: "orchestrator_events",
      reason: "supabase_unavailable",
    });
  }

  const { error } = await supabase.from("orchestrator_events").insert({
    tenant_id: record.tenantId,
    correlation_id: record.correlationId,
    session_id: record.sessionId,
    stage: record.stage,
    status: record.status,
    duration_ms: record.durationMs ?? null,
    details: record.details ?? {},
    created_at: record.createdAt,
  });

  if (error) {
    throw new ServiceUnavailableError("Failed to persist orchestrator telemetry event.", {
      store: "orchestrator_events",
      reason: "supabase_insert_failed",
    });
  }

  await publishRealtimeEvent({
    tenantId: record.tenantId,
    sessionId: record.sessionId,
    correlationId: record.correlationId,
    stage: record.stage,
    status: record.status,
    createdAt: record.createdAt,
    details: record.details,
  });

  await appendOutboxEvent({
    eventType: "orchestrator.event",
    tenantId: record.tenantId,
    sessionId: record.sessionId,
    correlationId: record.correlationId,
    payload: {
      stage: record.stage,
      status: record.status,
      durationMs: record.durationMs,
      details: record.details ?? {},
      createdAt: record.createdAt,
    },
  });
}

export async function listOrchestratorEvents(sessionId: string, tenantId: string): Promise<OrchestratorEvent[]> {
  const supabase = getSupabase();
  if (!supabase) {
    throw new ServiceUnavailableError("Failed to fetch orchestrator events.", {
      store: "orchestrator_events",
      reason: "supabase_unavailable",
    });
  }

  const { data, error } = await supabase
    .from("orchestrator_events")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("session_id", sessionId)
    .order("created_at", { ascending: false })
    .limit(500);

  if (error) {
    throw new ServiceUnavailableError("Failed to fetch orchestrator events.", {
      store: "orchestrator_events",
      reason: "supabase_query_failed",
    });
  }

  return data?.map((row) => ({
    tenantId: row.tenant_id,
    correlationId: row.correlation_id,
    sessionId: row.session_id,
    stage: row.stage,
    status: row.status,
    durationMs: typeof row.duration_ms === "number" ? row.duration_ms : undefined,
    details: (row.details as Record<string, unknown> | null) ?? undefined,
    createdAt: row.created_at,
  })) ?? [];
}

export async function getOrchestratorStageMetrics(sessionId: string, tenantId: string): Promise<{
  total: number;
  ok: number;
  failed: number;
  fallback: number;
  byStage: Record<string, { total: number; ok: number; failed: number; fallback: number }>;
}> {
  const events = await listOrchestratorEvents(sessionId, tenantId);
  const metrics = {
    total: events.length,
    ok: 0,
    failed: 0,
    fallback: 0,
    byStage: {} as Record<string, { total: number; ok: number; failed: number; fallback: number }>,
  };

  for (const event of events) {
    if (!metrics.byStage[event.stage]) {
      metrics.byStage[event.stage] = { total: 0, ok: 0, failed: 0, fallback: 0 };
    }
    const stage = metrics.byStage[event.stage];
    stage.total += 1;
    if (event.status === "ok") {
      stage.ok += 1;
      metrics.ok += 1;
    } else if (event.status === "failed") {
      stage.failed += 1;
      metrics.failed += 1;
    } else {
      stage.fallback += 1;
      metrics.fallback += 1;
    }
  }

  return metrics;
}

export async function cleanupExpiredTelemetryRecords(
  retentionDays: number
): Promise<{ orchestratorEventsDeleted: number; workflowTransitionsDeleted: number; mode: "supabase" | "none" }> {
  const thresholdIso = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000).toISOString();
  const supabase = getSupabase();
  if (!supabase) {
    throw new ServiceUnavailableError("Failed to cleanup telemetry records.", {
      store: "orchestrator_events",
      reason: "supabase_unavailable",
    });
  }

  const [eventsResult, workflowResult] = await Promise.all([
    supabase.from("orchestrator_events").delete().lt("created_at", thresholdIso).select("id"),
    supabase.from("workflow_transitions").delete().lt("timestamp", thresholdIso).select("id"),
  ]);

  if (eventsResult.error || workflowResult.error) {
    throw new ServiceUnavailableError("Failed to cleanup telemetry records.", {
      store: "orchestrator_events",
      reason: "supabase_delete_failed",
    });
  }

  return {
    orchestratorEventsDeleted: eventsResult.data?.length ?? 0,
    workflowTransitionsDeleted: workflowResult.data?.length ?? 0,
    mode: "supabase",
  };
}

export async function getOrchestratorMetricsSummary(tenantId?: string): Promise<{
  total: number;
  ok: number;
  failed: number;
  fallback: number;
  byStage: Record<string, { total: number; ok: number; failed: number; fallback: number }>;
}> {
  const supabase = getSupabase();
  if (!supabase) {
    throw new ServiceUnavailableError("Failed to fetch orchestrator metrics.", {
      store: "orchestrator_events",
      reason: "supabase_unavailable",
    });
  }

  let query = supabase.from("orchestrator_events").select("*").order("created_at", { ascending: false }).limit(1000);
  if (tenantId) query = query.eq("tenant_id", tenantId);
  const { data, error } = await query;

  if (error) {
    throw new ServiceUnavailableError("Failed to fetch orchestrator metrics.", {
      store: "orchestrator_events",
      reason: "supabase_query_failed",
    });
  }

  const normalized = data?.map((row) => ({
    tenantId: row.tenant_id,
    correlationId: row.correlation_id,
    sessionId: row.session_id,
    stage: row.stage,
    status: row.status as "ok" | "failed" | "fallback",
    durationMs: typeof row.duration_ms === "number" ? row.duration_ms : undefined,
    details: (row.details as Record<string, unknown> | null) ?? undefined,
    createdAt: row.created_at,
  })) ?? [];

  return buildMetrics(normalized);
}

function buildMetrics(events: OrchestratorEvent[]) {
  const metrics = {
    total: events.length,
    ok: 0,
    failed: 0,
    fallback: 0,
    byStage: {} as Record<string, { total: number; ok: number; failed: number; fallback: number }>,
  };
  for (const event of events) {
    if (!metrics.byStage[event.stage]) {
      metrics.byStage[event.stage] = { total: 0, ok: 0, failed: 0, fallback: 0 };
    }
    const stage = metrics.byStage[event.stage];
    stage.total += 1;
    if (event.status === "ok") {
      stage.ok += 1;
      metrics.ok += 1;
    } else if (event.status === "failed") {
      stage.failed += 1;
      metrics.failed += 1;
    } else {
      stage.fallback += 1;
      metrics.fallback += 1;
    }
  }
  return metrics;
}
