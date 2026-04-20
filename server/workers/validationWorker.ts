import { env } from "../config/env.js";
import {
  claimNextQueuedJob,
  enqueueShadowExecuteJob,
  isAsyncWorkerEnabled,
  markJobCompleted,
  markJobFailed,
  type AsyncJobRecord,
} from "../engine/asyncJobs.js";
import { emitOrchestratorEvent } from "../engine/orchestratorTelemetry.js";
import { getSupabase } from "../lib/supabase.js";
import { injectTenantContext } from "../lib/tenantContext.js";
import { validateFormula } from "../tools/validateFormula.js";

let timer: NodeJS.Timeout | null = null;
let isTickRunning = false;

function extractOperationId(payload: Record<string, unknown>): string | undefined {
  const pending = payload.pendingOperations;
  if (!Array.isArray(pending) || pending.length === 0) return undefined;
  const first = pending[0] as Record<string, unknown>;
  return typeof first.id === "string" ? first.id : undefined;
}

async function processValidateJob(job: AsyncJobRecord): Promise<void> {
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
    stage: "validation_worker_claimed",
    status: "ok",
    details: { jobId: job.id, requestId: job.requestId, attempt: job.attempt },
  });

  const pendingOperations = Array.isArray(job.payload.pendingOperations)
    ? (job.payload.pendingOperations as Array<Record<string, unknown>>)
    : [];
  for (const op of pendingOperations) {
    if (typeof op.formula !== "string") continue;
    const check = validateFormula(op.formula);
    if (!check.isValid) {
      await emitOrchestratorEvent({
        tenantId: job.tenantId,
        sessionId: job.sessionId,
        correlationId: job.correlationId,
        stage: "validation_worker_failed",
        status: "failed",
        details: { jobId: job.id, formula: op.formula, error: check.errorMessage ?? "Invalid formula." },
      });
      throw new Error(check.errorMessage ?? "Validation worker rejected invalid formula.");
    }
  }

  const operationId = extractOperationId(job.payload);
  const uploadId = typeof job.payload.uploadId === "string" ? job.payload.uploadId : undefined;
  const sheetName = typeof job.payload.sheetName === "string" ? job.payload.sheetName : "Sheet1";
  if (operationId && uploadId) {
    await enqueueShadowExecuteJob({
      tenantId: job.tenantId,
      sessionId: job.sessionId,
      correlationId: job.correlationId,
      operationId,
      createdBy: job.createdBy,
      payload: {
        plan: { operations: pendingOperations },
        uploadId,
        sheet: sheetName,
      },
    });
  }

  await markJobCompleted(job.id, job.requestId, {
    ...job.payload,
    workerMode: "validate_plan",
    validatedCount: pendingOperations.length,
    completedAt: new Date().toISOString(),
  });

  await emitOrchestratorEvent({
    tenantId: job.tenantId,
    sessionId: job.sessionId,
    correlationId: job.correlationId,
    stage: "validation_worker_completed",
    status: operationId && uploadId ? "ok" : "fallback",
    durationMs: Date.now() - startedAt,
    details: { jobId: job.id, requestId: job.requestId, queuedShadow: Boolean(operationId && uploadId) },
  });
}

async function tick(): Promise<void> {
  if (isTickRunning) return;
  isTickRunning = true;
  try {
    const rounds = Math.max(1, env.asyncWorkerBatchSize);
    for (let i = 0; i < rounds; i += 1) {
      const job = await claimNextQueuedJob("validate_plan");
      if (!job) break;
      try {
        await processValidateJob(job);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown validation worker error.";
        await markJobFailed(job, message);
      }
    }
  } finally {
    isTickRunning = false;
  }
}

export function startValidationWorker(): void {
  if (!isAsyncWorkerEnabled()) return;
  if (!env.asyncPipelineEnabled) return;
  if (timer) return;
  timer = setInterval(() => {
    void tick();
  }, Math.max(250, env.asyncWorkerPollMs));
  void tick();
}

export function stopValidationWorker(): void {
  if (!timer) return;
  clearInterval(timer);
  timer = null;
}
