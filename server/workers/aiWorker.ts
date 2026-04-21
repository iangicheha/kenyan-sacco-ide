import { env } from "../config/env.js";
import {
  enqueueValidatePlanJob,
  isAsyncWorkerEnabled,
  registerWorker,
  type AsyncJobRecord,
} from "../engine/asyncJobs.js";
import { emitOrchestratorEvent } from "../engine/orchestratorTelemetry.js";
import { getSupabase } from "../lib/supabase.js";
import { injectTenantContext } from "../lib/tenantContext.js";
import { runPlanningPipeline } from "../pipeline/runAiPipeline.js";
import type { Regulator } from "../types.js";
import type { Job } from "bullmq";

async function processAiPlanJob(job: Job<AsyncJobRecord>): Promise<void> {
  const data = job.data;
  const startedAt = Date.now();

  // Inject tenant context for RLS if enabled
  if (env.rlsEnforced) {
    const supabase = getSupabase();
    if (supabase) {
      await injectTenantContext(supabase, {
        tenantId: data.tenantId,
        userId: data.createdBy,
        role: "system",
      });
    }
  }

  await emitOrchestratorEvent({
    tenantId: data.tenantId,
    sessionId: data.sessionId,
    correlationId: data.correlationId,
    stage: "ai_worker_claimed",
    status: "ok",
    details: { jobId: job.id, attempt: job.attemptsMade, requestId: data.requestId },
  });

  try {
    const result = await runPlanningPipeline({
      tenantId: data.tenantId,
      sessionId: data.sessionId,
      analystPrompt: String(data.payload.prompt ?? ""),
      regulator: String(data.payload.regulator ?? "CBK") as Regulator,
      correlationId: data.correlationId,
      actor: String(data.payload.actor ?? data.createdBy ?? "system"),
    });

    if (result.status === "pending_review") {
      await enqueueValidatePlanJob({
        tenantId: data.tenantId,
        sessionId: data.sessionId,
        correlationId: data.correlationId,
        createdBy: data.createdBy,
        payload: {
          pendingOperations: result.pendingOperations,
          uploadId: data.payload.uploadId,
          sheetName: data.payload.sheetName,
        },
      });
    }

    await emitOrchestratorEvent({
      tenantId: data.tenantId,
      sessionId: data.sessionId,
      correlationId: data.correlationId,
      stage: "ai_worker_completed",
      status: "ok",
      durationMs: Date.now() - startedAt,
      details: { 
        jobId: job.id, 
        requestId: data.requestId, 
        resultStatus: result.status, 
        queuedValidation: result.status === "pending_review" 
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown ai worker error.";
    await emitOrchestratorEvent({
      tenantId: data.tenantId,
      sessionId: data.sessionId,
      correlationId: data.correlationId,
      stage: "ai_worker_failed",
      status: "failed",
      details: { 
        jobId: job.id, 
        requestId: data.requestId, 
        error: message, 
        attempt: job.attemptsMade, 
        maxAttempts: job.opts.attempts 
      },
    });
    // Re-throw to let BullMQ handle retries
    throw error;
  }
}

export function startAiWorker(): void {
  if (!isAsyncWorkerEnabled()) return;
  if (!env.asyncPipelineEnabled) return;
  
  console.log("Starting AI Worker with BullMQ...");
  registerWorker("ai_plan", processAiPlanJob);
}

export function stopAiWorker(): void {
  // BullMQ workers are closed via closeAsyncJobQueues() in asyncJobs.ts
}
