import { env } from "../config/env.js";
import { getSupabase } from "../lib/supabase.js";

export interface OrchestratorEvent {
  correlationId: string;
  sessionId: string;
  stage: string;
  status: "ok" | "failed" | "fallback";
  durationMs?: number;
  details?: Record<string, unknown>;
  createdAt: string;
}

const eventsStore: OrchestratorEvent[] = [];

export async function emitOrchestratorEvent(event: Omit<OrchestratorEvent, "createdAt">): Promise<void> {
  const record: OrchestratorEvent = {
    ...event,
    createdAt: new Date().toISOString(),
  };

  const supabase = getSupabase();
  if (supabase) {
    const { error } = await supabase.from("orchestrator_events").insert({
      correlation_id: record.correlationId,
      session_id: record.sessionId,
      stage: record.stage,
      status: record.status,
      duration_ms: record.durationMs ?? null,
      details: record.details ?? {},
      created_at: record.createdAt,
    });
    if (!error) return;
  }

  if (!env.allowInMemoryFallback) {
    throw new Error("Failed to persist orchestrator event and in-memory fallback is disabled.");
  }
  eventsStore.push(record);
}

export async function listOrchestratorEvents(sessionId: string): Promise<OrchestratorEvent[]> {
  const supabase = getSupabase();
  if (supabase) {
    const { data, error } = await supabase
      .from("orchestrator_events")
      .select("*")
      .eq("session_id", sessionId)
      .order("created_at", { ascending: false })
      .limit(500);

    if (!error && data) {
      return data.map((row) => ({
        correlationId: row.correlation_id,
        sessionId: row.session_id,
        stage: row.stage,
        status: row.status,
        durationMs: typeof row.duration_ms === "number" ? row.duration_ms : undefined,
        details: (row.details as Record<string, unknown> | null) ?? undefined,
        createdAt: row.created_at,
      }));
    }
  }

  if (!env.allowInMemoryFallback) return [];
  return eventsStore.filter((entry) => entry.sessionId === sessionId).slice().reverse();
}

export async function getOrchestratorStageMetrics(sessionId: string): Promise<{
  total: number;
  ok: number;
  failed: number;
  fallback: number;
  byStage: Record<string, { total: number; ok: number; failed: number; fallback: number }>;
}> {
  const events = await listOrchestratorEvents(sessionId);
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
