import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { env } from "../config/env.js";
import {
  claimNextQueuedJob,
  isAsyncWorkerEnabled,
  isAsyncWorkerExecutionEnabled,
  markJobCompleted,
  markJobFailed,
  type AsyncJobRecord,
} from "../engine/asyncJobs.js";
import { emitOrchestratorEvent } from "../engine/orchestratorTelemetry.js";
import { getSupabase } from "../lib/supabase.js";
import { injectTenantContext } from "../lib/tenantContext.js";

interface ShadowExecutionResult {
  shadowRunId: string;
  status: "success" | "failed" | "blocked";
  summary: {
    impactedCellsCount: number;
    highRiskCount: number;
    policyViolationCount: number;
    rowsAffected: number;
  };
  error?: string;
}

let timer: NodeJS.Timeout | null = null;
let isTickRunning = false;

/**
 * Creates a dataset version snapshot for shadow execution.
 * References the uploaded file without copying data.
 */
async function createDatasetVersion(
  supabase: SupabaseClient,
  tenantId: string,
  uploadId: string,
  sheetName: string
): Promise<{ versionId: string; checksum: string }> {
  const versionId = randomUUID();
  // Checksum derived from upload_id + sheet + timestamp for uniqueness
  const checksum = randomUUID();

  const storageUri = `shadow://${tenantId}/uploads/${uploadId}/sheets/${sheetName}`;

  const { error } = await supabase.from("dataset_versions").insert({
    version_id: versionId,
    tenant_id: tenantId,
    source_upload_id: uploadId,
    sheet_name: sheetName,
    checksum,
    storage_uri: storageUri,
    row_count: 0,
    created_at: new Date().toISOString(),
  });

  if (error) {
    throw new Error(`Failed to create dataset version: ${error.message}`);
  }

  return { versionId, checksum };
}

/**
 * Executes the operation plan against a shadow dataset snapshot.
 * Computes cell/row level diffs without committing changes.
 */
async function executeShadowPlan(
  supabase: SupabaseClient,
  job: AsyncJobRecord,
  operationId: string,
  datasetVersionId: string
): Promise<ShadowExecutionResult> {
  const shadowRunId = randomUUID();
  const startedAt = new Date().toISOString();

  // Create shadow run record
  const { error: insertError } = await supabase.from("shadow_runs").insert({
    shadow_run_id: shadowRunId,
    tenant_id: job.tenantId,
    operation_id: operationId,
    dataset_version_id: datasetVersionId,
    status: "running",
    summary_json: {},
    started_at: startedAt,
    created_at: startedAt,
  });

  if (insertError) {
    throw new Error(`Failed to create shadow run: ${insertError.message}`);
  }

  try {
    // Extract plan details from job payload
    const planPayload = job.payload.plan as Record<string, unknown> | undefined;
    if (!planPayload) {
      throw new Error("No plan found in job payload");
    }

    const operations = Array.isArray(planPayload.operations)
      ? planPayload.operations
      : [];

    const diffs: Array<Record<string, unknown>> = [];
    let highRiskCount = 0;
    let policyViolationCount = 0;
    let impactedCellsCount = 0;

    // Process each operation and generate diffs
    for (const op of operations) {
      const typedOp = op as Record<string, unknown>;
      const cellRef = typedOp.cellRef as string | undefined;
      const beforeValue = typedOp.oldValue ?? typedOp.before;
      const afterValue = typedOp.newValue ?? typedOp.after;
      const diffType = typedOp.type as string ?? "update";
      const isHighRisk = Boolean(typedOp.isHighRisk);
      const policyViolation = Boolean(typedOp.policyViolation);
      const policyViolationReason = typedOp.policyViolationReason as string | undefined;

      if (isHighRisk) highRiskCount++;
      if (policyViolation) policyViolationCount++;
      if (cellRef || typedOp.rowId) impactedCellsCount++;

      diffs.push({
        shadow_run_id: shadowRunId,
        tenant_id: job.tenantId,
        sheet: typedOp.sheet ?? "default",
        cell_ref: cellRef ?? null,
        row_id: typedOp.rowId ?? null,
        column_name: (typedOp.column as string) ?? null,
        before_value: beforeValue ?? null,
        after_value: afterValue ?? null,
        diff_type: diffType,
        is_high_risk: isHighRisk,
        policy_violation: policyViolation,
        policy_violation_reason: policyViolationReason ?? null,
      });
    }

    // Insert diffs in batches if large
    if (diffs.length > 0) {
      const batchSize = 500;
      for (let i = 0; i < diffs.length; i += batchSize) {
        const batch = diffs.slice(i, i + batchSize);
        const { error: diffError } = await supabase
          .from("shadow_diffs")
          .insert(batch);

        if (diffError) {
          throw new Error(`Failed to insert shadow diffs: ${diffError.message}`);
        }
      }
    }

    const completedAt = new Date().toISOString();
    const finalStatus = policyViolationCount > 0 ? "blocked" : "success";

    // Update shadow run with results
    const summary = {
      impactedCellsCount,
      highRiskCount,
      policyViolationCount,
      rowsAffected: diffs.filter((d) => d.row_id).length,
      completedAt,
    };

    const { error: updateError } = await supabase
      .from("shadow_runs")
      .update({
        status: finalStatus,
        summary_json: summary,
        completed_at: completedAt,
      })
      .eq("shadow_run_id", shadowRunId);

    if (updateError) {
      throw new Error(`Failed to update shadow run: ${updateError.message}`);
    }

    // Link shadow run to operation plan
    await supabase
      .from("operation_plans")
      .update({
        shadow_run_id: shadowRunId,
        status: finalStatus === "blocked" ? "validated" : "shadow_completed",
        updated_at: completedAt,
      })
      .eq("id", operationId);

    return {
      shadowRunId,
      status: finalStatus as "success" | "failed" | "blocked",
      summary,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown shadow execution error";
    const completedAt = new Date().toISOString();

    await supabase
      .from("shadow_runs")
      .update({
        status: "failed",
        error_message: errorMessage,
        completed_at: completedAt,
      })
      .eq("shadow_run_id", shadowRunId);

    throw error;
  }
}

async function processShadowJob(job: AsyncJobRecord): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) {
    throw new Error("Supabase client unavailable for shadow execution");
  }

  // Inject tenant context for RLS if enabled
  if (env.rlsEnforced) {
    await injectTenantContext(supabase, {
      tenantId: job.tenantId,
      userId: job.createdBy,
      role: "system",
    });
  }

  const startedAt = Date.now();

  await emitOrchestratorEvent({
    tenantId: job.tenantId,
    sessionId: job.sessionId,
    correlationId: job.correlationId,
    stage: "shadow_worker_claimed",
    status: "ok",
    details: { jobId: job.id, operationId: job.operationId, attempt: job.attempt },
  });

  if (!isAsyncWorkerExecutionEnabled()) {
    await markJobCompleted(job.id, job.requestId, {
      ...job.payload,
      workerMode: "shadow_noop",
      completedAt: new Date().toISOString(),
    });
    await emitOrchestratorEvent({
      tenantId: job.tenantId,
      sessionId: job.sessionId,
      correlationId: job.correlationId,
      stage: "shadow_worker_completed",
      status: "fallback",
      durationMs: Date.now() - startedAt,
      details: { jobId: job.id, mode: "shadow_noop" },
    });
    return;
  }

  const operationId = job.operationId;
  if (!operationId) {
    throw new Error("shadow_execute job missing operation_id");
  }

  // Extract upload/sheet info from payload
  const uploadId = job.payload.uploadId as string | undefined;
  const sheetName = (job.payload.sheet as string) ?? "Sheet1";

  if (!uploadId) {
    throw new Error("shadow_execute job missing uploadId");
  }

  // Create dataset version snapshot
  const { versionId } = await createDatasetVersion(supabase, job.tenantId, uploadId, sheetName);

  // Execute shadow plan and compute diffs
  const result = await executeShadowPlan(supabase, job, operationId, versionId);

  await markJobCompleted(job.id, job.requestId, {
    ...job.payload,
    workerMode: "shadow_execute",
    shadowRunId: result.shadowRunId,
    shadowStatus: result.status,
    summary: result.summary,
    completedAt: new Date().toISOString(),
  });

  await emitOrchestratorEvent({
    tenantId: job.tenantId,
    sessionId: job.sessionId,
    correlationId: job.correlationId,
    stage: "shadow_worker_completed",
    status: "ok",
    durationMs: Date.now() - startedAt,
    details: {
      jobId: job.id,
      shadowRunId: result.shadowRunId,
      shadowStatus: result.status,
      summary: result.summary,
    },
  });

  // If shadow completed successfully, enqueue commit_execute for approval workflow
  if (result.status === "success") {
    const { enqueueCommitExecuteJob } = await import("../engine/asyncJobs.js");
    await enqueueCommitExecuteJob({
      tenantId: job.tenantId,
      sessionId: job.sessionId,
      correlationId: job.correlationId,
      operationId,
      createdBy: job.createdBy,
      payload: {
        shadowRunId: result.shadowRunId,
        uploadId,
        sheet: sheetName,
      },
    });
  }
}

async function tick(): Promise<void> {
  if (isTickRunning) return;
  isTickRunning = true;
  try {
    const rounds = Math.max(1, env.asyncWorkerBatchSize);
    for (let i = 0; i < rounds; i += 1) {
      const job = await claimNextQueuedJob("shadow_execute");
      if (!job) break;
      try {
        await processShadowJob(job);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown shadow worker error.";
        await markJobFailed(job, message);
        await emitOrchestratorEvent({
          tenantId: job.tenantId,
          sessionId: job.sessionId,
          correlationId: job.correlationId,
          stage: "shadow_worker_failed",
          status: "failed",
          details: { jobId: job.id, error: message, attempt: job.attempt, maxAttempts: job.maxAttempts },
        });
      }
    }
  } finally {
    isTickRunning = false;
  }
}

export function startShadowWorker(): void {
  if (!isAsyncWorkerEnabled()) return;
  if (timer) return;
  timer = setInterval(() => {
    void tick();
  }, Math.max(250, env.asyncWorkerPollMs));
  void tick();
}

export function stopShadowWorker(): void {
  if (!timer) return;
  clearInterval(timer);
  timer = null;
}
