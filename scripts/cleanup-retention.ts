import { env } from "../server/config/env.js";
import { cleanupExpiredIdempotencyRecords } from "../server/engine/idempotencyStore.js";
import { getSupabase } from "../server/lib/supabase.js";

type CleanupResult = {
  deleted: number;
  mode: "supabase" | "memory" | "none";
};

async function cleanupOrchestratorEvents(): Promise<CleanupResult> {
  const retentionDays = Number(process.env.ORCHESTRATOR_RETENTION_DAYS ?? 30);
  const thresholdIso = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000).toISOString();
  const supabase = getSupabase();

  if (supabase) {
    const { data, error } = await supabase
      .from("orchestrator_events")
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

  // Orchestrator in-memory events are process-local only and reset on restart.
  return { deleted: 0, mode: "memory" };
}

async function main() {
  const idempotency = await cleanupExpiredIdempotencyRecords();
  const orchestrator = await cleanupOrchestratorEvents();

  const payload = {
    ranAt: new Date().toISOString(),
    idempotency,
    orchestrator,
  };

  // eslint-disable-next-line no-console
  console.log(JSON.stringify(payload, null, 2));
}

main().catch((error) => {
  // eslint-disable-next-line no-console
  console.error("[cleanup-retention] failed", error);
  process.exitCode = 1;
});
