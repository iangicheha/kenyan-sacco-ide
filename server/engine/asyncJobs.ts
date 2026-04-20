import { Queue, type Job } from "bullmq";
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
const transientFailureBackoffMs = [5_000, 30_000, 120_000, 600_000, 1_800_000];
const queueByType = new Map<AsyncJobType, Queue<AsyncJobRecord>>();
let deadLetterQueue: Queue<Record<string, unknown>> | null = null;

function getDeadLetterQueue(): Queue<Record<string, unknown>> {
  if (deadLetterQueue) return deadLetterQueue;
  deadLetterQueue = new Queue<Record<string, unknown>>("dead_letter_jobs", {
    connection: { url: env.redisUrl },
    prefix: env.redisQueuePrefix,
  });
  return deadLetterQueue;
}

function getQueue(jobType: AsyncJobType): Queue<AsyncJobRecord> {
  const cached = queueByType.get(jobType);
  if (cached) return cached;
  const queue = new Queue<AsyncJobRecord>(jobType, {
    connection: { url: env.redisUrl },
    prefix: env.redisQueuePrefix,
    defaultJobOptions: {
      removeOnComplete: true,
      removeOnFail: false,
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
  await getQueue(jobType).add(jobType, record, {
    priority: record.priority,
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

async function removeAndNormalize(jobType: AsyncJobType, job: Job<AsyncJobRecord>): Promise<AsyncJobRecord | null> {
  const data = job.data;
  try {
    await job.remove();
  } catch {
    return null;
  }
  return {
    ...data,
    jobType,
    id: job.id ? String(job.id) : data.id,
  };
}

export async function claimNextQueuedJob(jobType: AsyncJobType): Promise<AsyncJobRecord | null> {
  const queue = getQueue(jobType);
  const waiting = await queue.getJobs(["waiting"], 0, 20, true);
  for (const job of waiting) {
    if (job.name !== jobType) continue;
    const normalized = await removeAndNormalize(jobType, job);
    if (normalized) return normalized;
  }
  return null;
}

export async function markJobCompleted(_jobId: string, _requestId: string, _result: Record<string, unknown>): Promise<void> {
  return;
}

function nextDelayMs(attempt: number): number {
  return transientFailureBackoffMs[Math.min(attempt, transientFailureBackoffMs.length - 1)];
}

export async function markJobFailed(job: AsyncJobRecord, errorMessage: string): Promise<void> {
  const nextAttempt = job.attempt + 1;
  if (nextAttempt < job.maxAttempts) {
    const retryRecord: AsyncJobRecord = {
      ...job,
      attempt: nextAttempt,
    };
    await getQueue(job.jobType).add(job.jobType, retryRecord, {
      delay: nextDelayMs(job.attempt),
      priority: retryRecord.priority,
    });
    return;
  }

  await getDeadLetterQueue().add("dead_letter_jobs", {
    jobId: job.id,
    jobType: job.jobType,
    tenantId: job.tenantId,
    sessionId: job.sessionId,
    operationId: job.operationId,
    requestId: job.requestId,
    correlationId: job.correlationId,
    payload: job.payload,
    failedStage: job.jobType,
    errorMessage,
    attempts: nextAttempt,
    maxAttempts: job.maxAttempts,
    failedAt: new Date().toISOString(),
  });
}

export async function closeAsyncJobQueues(): Promise<void> {
  await Promise.all([...queueByType.values()].map(async (queue) => queue.close()));
  if (deadLetterQueue) {
    await deadLetterQueue.close();
    deadLetterQueue = null;
  }
}
