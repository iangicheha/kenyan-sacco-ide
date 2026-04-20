import { env } from "../config/env.js";
import {
  claimNextQueuedJob,
  enqueueValidatePlanJob,
  isAsyncWorkerEnabled,
  markJobCompleted,
  markJobFailed,
  type AsyncJobRecord,
} from "../engine/asyncJobs.js";
import { emitOrchestratorEvent } from "../engine/orchestratorTelemetry.js";
import { getSupabase } from "../lib/supabase.js";
import { injectTenantContext } from "../lib/tenantContext.js";
import { runPlanningPipeline } from "../pipeline/runAiPipeline.js";
import type { Regulator } from "../types.js";

let timer: NodeJS.Timeout | null = null;
let isTickRunning = false;

async function processAiPlanJob(job: AsyncJobRecord): Promise<void> {
  const startedAt = Date.now();

  // Inject tenant context for RLS if enabled
  if (env.rlsEnforced) {
    const supabase = getSupabase();
    if (supabase) {
      await injectTenantContext(supabase, {
        tenantId: job.tenantId,
        userId: job.createdBy,
        role: "system",
      });
    }
  }

  await emitOrchestratorEvent({
    tenantId: job.tenantId,
    sessionId: job.sessionId,
    correlationId: job.correlationId,
    stage: "ai_worker_claimed",
    status: "ok",
    details: { jobId: job.id, attempt: job.attempt, requestId: job.requestId },
  });

  const result = await runPlanningPipeline({
    tenantId: job.tenantId,
    sessionId: job.sessionId,
    analystPrompt: String(job.payload.prompt ?? ""),
    regulator: String(job.payload.regulator ?? "CBK") as Regulator,
    correlationId: job.correlationId,
    actor: String(job.payload.actor ?? job.createdBy ?? "system"),
  });

  await markJobCompleted(job.id, job.requestId, {
    ...job.payload,
    workerMode: "ai_plan",
    result,
    completedAt: new Date().toISOString(),
  });

  if (result.status === "pending_review") {
    await enqueueValidatePlanJob({
      tenantId: job.tenantId,
      sessionId: job.sessionId,
      correlationId: job.correlationId,
      createdBy: job.createdBy,
      payload: {
        pendingOperations: result.pendingOperations,
        uploadId: job.payload.uploadId,
        sheetName: job.payload.sheetName,
      },
    });
  }

  await emitOrchestratorEvent({
    tenantId: job.tenantId,
    sessionId: job.sessionId,
    correlationId: job.correlationId,
    stage: "ai_worker_completed",
    status: "ok",
    durationMs: Date.now() - startedAt,
    details: { jobId: job.id, requestId: job.requestId, resultStatus: result.status, queuedValidation: result.status === "pending_review" },
  });
}

async function tick(): Promise<void> {
  if (isTickRunning) return;
  isTickRunning = true;
  try {
    const rounds = Math.max(1, env.asyncWorkerBatchSize);
    for (let i = 0; i < rounds; i += 1) {
      const job = await claimNextQueuedJob("ai_plan");
      if (!job) break;
      try {
        await processAiPlanJob(job);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown ai worker error.";
        await markJobFailed(job, message);
        await emitOrchestratorEvent({
          tenantId: job.tenantId,
          sessionId: job.sessionId,
          correlationId: job.correlationId,
          stage: "ai_worker_failed",
          status: "failed",
          details: { jobId: job.id, requestId: job.requestId, error: message, attempt: job.attempt, maxAttempts: job.maxAttempts },
        });
      }
    }
  } finally {
    isTickRunning = false;
  }
}

export function startAiWorker(): void {
  if (!isAsyncWorkerEnabled()) return;
  if (!env.asyncPipelineEnabled) return;
  if (timer) return;
  timer = setInterval(() => {
    void tick();
  }, Math.max(250, env.asyncWorkerPollMs));
  void tick();
}

export function stopAiWorker(): void {
  if (!timer) return;
  clearInterval(timer);
  timer = null;
}
