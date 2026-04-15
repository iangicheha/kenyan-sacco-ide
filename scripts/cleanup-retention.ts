import { env } from "../server/config/env.js";
import { cleanupExpiredIdempotencyRecords } from "../server/engine/idempotencyStore.js";
import { getSupabase } from "../server/lib/supabase.js";

type CleanupResult = {
  deleted: number;
  mode: "supabase" | "memory" | "none";
};

function getThresholdIso(retentionDays: number): string {
  return new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000).toISOString();
}

async function cleanupTableByCreatedAt(table: string, thresholdIso: string): Promise<CleanupResult> {
  const supabase = getSupabase();

  if (supabase) {
    const { data, error } = await supabase
      .from(table)
      .delete()
      .lt("created_at", thresholdIso)
      .select("id");

    if (!error) {
      return { deleted: data?.length ?? 0, mode: "supabase" };
    }
  }

  if (!env.allowInMemoryFallback) {
    return { deleted: 0, mode: "none" };
  }

  // In-memory stores are process-local only and reset on restart.
  return { deleted: 0, mode: "memory" };
}

async function main() {
  const idempotency = await cleanupExpiredIdempotencyRecords();
  const audit = await cleanupTableByCreatedAt("audit_log", getThresholdIso(env.retentionDaysAudit));
  const telemetryEvents = await cleanupTableByCreatedAt("orchestrator_events", getThresholdIso(env.retentionDaysTelemetry));
  const telemetryWorkflow = await cleanupTableByCreatedAt("workflow_transitions", getThresholdIso(env.retentionDaysTelemetry));

  const payload = {
    ranAt: new Date().toISOString(),
    idempotency,
    audit,
    telemetry: {
      orchestratorEvents: telemetryEvents,
      workflowTransitions: telemetryWorkflow,
    },
  };

  // eslint-disable-next-line no-console
  console.log(JSON.stringify(payload, null, 2));
}

main().catch((error) => {
  // eslint-disable-next-line no-console
  console.error("[cleanup-retention] failed", error);
  process.exitCode = 1;
});
