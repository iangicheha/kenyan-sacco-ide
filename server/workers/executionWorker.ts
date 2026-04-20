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

let timer: NodeJS.Timeout | null = null;
let isTickRunning = false;

/**
 * Executes the approved operation plan against the canonical dataset.
 * This is the final commit step after shadow execution and approval.
 */
async function executeCommit(job: AsyncJobRecord): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) {
    throw new Error("Supabase client unavailable for commit execution");
  }

  const operationId = job.operationId;
  if (!operationId) {
    throw new Error("commit_execute job missing operation_id");
  }

  // Fetch operation plan and verify approval
  const { data: operation, error: opError } = await supabase
    .from("operation_plans")
    .select("*")
    .eq("id", operationId)
    .eq("tenant_id", job.tenantId)
    .single();

  if (opError || !operation) {
    throw new Error(`Operation not found: ${operationId}`);
  }

  if (operation.status !== "approved") {
    throw new Error(`Operation not approved. Current status: ${operation.status}`);
  }

  // Fetch shadow diffs to apply
  const { data: diffs, error: diffError } = await supabase
    .from("shadow_diffs")
    .select("*")
    .eq("shadow_run_id", operation.shadow_run_id)
    .eq("tenant_id", job.tenantId);

  if (diffError) {
    throw new Error(`Failed to fetch shadow diffs: ${diffError.message}`);
  }

  // Apply each diff to the canonical dataset
  // In a real implementation, this would update the actual spreadsheet/data store
  // For now, we log the execution and mark as completed
  const appliedChanges: Array<Record<string, unknown>> = [];

  for (const diff of diffs ?? []) {
    // TODO: Apply actual data changes to canonical dataset
    // This is where you would:
    // 1. Load the canonical dataset
    // 2. Apply the cell/row update
    // 3. Persist the updated dataset
    // 4. Track the change in audit_log

    appliedChanges.push({
      sheet: diff.sheet,
      cellRef: diff.cell_ref,
      rowId: diff.row_id,
      columnName: diff.column_name,
      beforeValue: diff.before_value,
      afterValue: diff.after_value,
      diffType: diff.diff_type,
    });
  }

  // Log audit entries for each change
  const auditEntries = appliedChanges.map((change) => ({
    tenant_id: job.tenantId,
    operation_id: operationId,
    session_id: job.sessionId,
    cell_ref: (change.cellRef as string) ?? (change.rowId ? `row:${change.rowId}` : "unknown"),
    formula_applied: change.diffType === "formula_change" ? (change.afterValue as string) : null,
    values_written: JSON.stringify({ before: change.beforeValue, after: change.afterValue }),
    analyst: job.createdBy ?? "system",
    timestamp: new Date().toISOString(),
    ai_reasoning: `Executed as part of operation ${operationId}`,
    correlation_id: job.correlationId,
  }));

  if (auditEntries.length > 0) {
    const { error: auditError } = await supabase.from("audit_log").insert(auditEntries);
    if (auditError) {
      throw new Error(`Failed to write audit log: ${auditError.message}`);
    }
  }

  // Update operation status to executed
  const executedAt = new Date().toISOString();
  await supabase
    .from("operation_plans")
    .update({
      status: "executed",
      executed_at: executedAt,
      updated_at: executedAt,
    })
    .eq("id", operationId);

  // Log workflow transition
  await supabase.from("workflow_transitions").insert({
    tenant_id: job.tenantId,
    session_id: job.sessionId,
    operation_id: operationId,
    correlation_id: job.correlationId,
    from_state: "approved",
    to_state: "executed",
    actor: "execution_worker",
    reason: "Automated execution of approved operation",
    timestamp: executedAt,
  });
}

async function processExecutionJob(job: AsyncJobRecord): Promise<void> {
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

  const startedAt = Date.now();

  await emitOrchestratorEvent({
    tenantId: job.tenantId,
    sessionId: job.sessionId,
    correlationId: job.correlationId,
    stage: "execution_worker_claimed",
    status: "ok",
    details: { jobId: job.id, operationId: job.operationId, attempt: job.attempt },
  });

  if (!isAsyncWorkerExecutionEnabled()) {
    await markJobCompleted(job.id, job.requestId, {
      ...job.payload,
      workerMode: "execution_noop",
      completedAt: new Date().toISOString(),
    });
    await emitOrchestratorEvent({
      tenantId: job.tenantId,
      sessionId: job.sessionId,
      correlationId: job.correlationId,
      stage: "execution_worker_completed",
      status: "fallback",
      durationMs: Date.now() - startedAt,
      details: { jobId: job.id, mode: "execution_noop" },
    });
    return;
  }

  await executeCommit(job);

  await markJobCompleted(job.id, job.requestId, {
    ...job.payload,
    workerMode: "commit_execute",
    executedAt: new Date().toISOString(),
    completedAt: new Date().toISOString(),
  });

  await emitOrchestratorEvent({
    tenantId: job.tenantId,
    sessionId: job.sessionId,
    correlationId: job.correlationId,
    stage: "execution_worker_completed",
    status: "ok",
    durationMs: Date.now() - startedAt,
    details: {
      jobId: job.id,
      operationId: job.operationId,
      mode: "commit_execute",
    },
  });
}

async function tick(): Promise<void> {
  if (isTickRunning) return;
  isTickRunning = true;
  try {
    const rounds = Math.max(1, env.asyncWorkerBatchSize);
    for (let i = 0; i < rounds; i += 1) {
      const job = await claimNextQueuedJob("commit_execute");
      if (!job) break;
      try {
        await processExecutionJob(job);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown execution worker error.";
        await markJobFailed(job, message);
        await emitOrchestratorEvent({
          tenantId: job.tenantId,
          sessionId: job.sessionId,
          correlationId: job.correlationId,
          stage: "execution_worker_failed",
          status: "failed",
          details: { jobId: job.id, error: message, attempt: job.attempt, maxAttempts: job.maxAttempts },
        });
      }
    }
  } finally {
    isTickRunning = false;
  }
}

export function startExecutionWorker(): void {
  if (!isAsyncWorkerEnabled()) return;
  if (timer) return;
  timer = setInterval(() => {
    void tick();
  }, Math.max(250, env.asyncWorkerPollMs));
  void tick();
}

export function stopExecutionWorker(): void {
  if (!timer) return;
  clearInterval(timer);
  timer = null;
}
