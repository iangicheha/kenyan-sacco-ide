import { Queue, Worker, type Job, type ConnectionOptions } from "bullmq";
import { randomUUID } from "node:crypto";
import { env } from "../config/env.js";

export type AsyncJobType = "ai_plan" | "validate_plan" | "shadow_execute" | "commit_execute";

export interface AsyncJobRecord {
  id: string;
  jobType: AsyncJobType;
  tenantId: string;
  sessionId: string;
  operationId?: string;
  requestId: string;
  correlationId: string;
  priority: number;
  attempt: number;
  maxAttempts: number;
  payload: Record<string, unknown>;
  createdBy?: string;
  createdAt: string;
}

interface EnqueueJobInput {
  tenantId: string;
  sessionId: string;
  correlationId: string;
  operationId?: string;
  createdBy?: string;
  payload: Record<string, unknown>;
  priority?: number;
  maxAttempts?: number;
}

const DEFAULT_MAX_ATTEMPTS = 5;
const queueByType = new Map<AsyncJobType, Queue<AsyncJobRecord>>();
const workersByType = new Map<AsyncJobType, Worker<AsyncJobRecord>>();

const connection: ConnectionOptions = {
  url: env.redisUrl,
};

function getQueue(jobType: AsyncJobType): Queue<AsyncJobRecord> {
  const cached = queueByType.get(jobType);
  if (cached) return cached;
  const queue = new Queue<AsyncJobRecord>(jobType, {
    connection,
    prefix: env.redisQueuePrefix,
    defaultJobOptions: {
      removeOnComplete: true,
      removeOnFail: false,
      attempts: DEFAULT_MAX_ATTEMPTS,
      backoff: {
        type: "exponential",
        delay: 5000,
      },
    },
  });
  queueByType.set(jobType, queue);
  return queue;
}

function withDefaults(jobType: AsyncJobType, input: EnqueueJobInput): AsyncJobRecord {
  return {
    id: randomUUID(),
    jobType,
    tenantId: input.tenantId,
    sessionId: input.sessionId,
    operationId: input.operationId,
    requestId: randomUUID(),
    correlationId: input.correlationId,
    priority: input.priority ?? 1,
    attempt: 0,
    maxAttempts: input.maxAttempts ?? DEFAULT_MAX_ATTEMPTS,
    payload: input.payload,
    createdBy: input.createdBy,
    createdAt: new Date().toISOString(),
  };
}

export function isAsyncWorkerEnabled(): boolean {
  return env.asyncWorkerEnabled;
}

export function isAsyncWorkerExecutionEnabled(): boolean {
  return env.asyncWorkerExecutionEnabled;
}

async function enqueue(jobType: AsyncJobType, input: EnqueueJobInput): Promise<AsyncJobRecord> {
  const record = withDefaults(jobType, input);
  const queue = getQueue(jobType);
  await queue.add(jobType, record, {
    priority: record.priority,
    jobId: record.id, // Use our UUID as BullMQ jobId for traceability
  });
  return record;
}

export async function enqueueAiPlanJob(input: EnqueueJobInput): Promise<AsyncJobRecord> {
  return enqueue("ai_plan", input);
}

export async function enqueueValidatePlanJob(input: EnqueueJobInput): Promise<AsyncJobRecord> {
  return enqueue("validate_plan", input);
}

export async function enqueueShadowExecuteJob(input: EnqueueJobInput): Promise<AsyncJobRecord> {
  return enqueue("shadow_execute", input);
}

export async function enqueueCommitExecuteJob(input: EnqueueJobInput): Promise<AsyncJobRecord> {
  return enqueue("commit_execute", input);
}

/**
 * Registers a worker for a specific job type.
 * This replaces the manual polling logic in aiWorker.ts.
 */
export function registerWorker(
  jobType: AsyncJobType, 
  processor: (job: Job<AsyncJobRecord>) => Promise<any>
): Worker<AsyncJobRecord> {
  if (workersByType.has(jobType)) {
    return workersByType.get(jobType)!;
  }

  const worker = new Worker<AsyncJobRecord>(
    jobType,
    async (job) => {
      return await processor(job);
    },
    {
      connection,
      prefix: env.redisQueuePrefix,
      concurrency: env.redisConcurrency,
    }
  );

  workersByType.set(jobType, worker);
  return worker;
}

export async function closeAsyncJobQueues(): Promise<void> {
  await Promise.all([...queueByType.values()].map(q => q.close()));
  await Promise.all([...workersByType.values()].map(w => w.close()));
  queueByType.clear();
  workersByType.clear();
}

// Legacy exports for compatibility during refactor
export async function claimNextQueuedJob(_jobType: AsyncJobType): Promise<AsyncJobRecord | null> {
  return null; // Workers handle this now
}

export async function markJobCompleted(_jobId: string, _requestId: string, _result: Record<string, unknown>): Promise<void> {
  return; // BullMQ handles this
}

export async function markJobFailed(_job: AsyncJobRecord, _errorMessage: string): Promise<void> {
  return; // BullMQ handles this via throwing in worker
}
