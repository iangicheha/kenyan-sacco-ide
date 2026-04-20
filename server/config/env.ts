import dotenv from "dotenv";

dotenv.config();

export const env = {
  port: Number(process.env.PORT ?? 4100),
  nodeEnv: process.env.NODE_ENV ?? "development",
  disableRbac: (process.env.DISABLE_RBAC ?? "false") === "true",
  anthropicApiKey: process.env.ANTHROPIC_API_KEY ?? "",
  intentModel: process.env.CLAUDE_INTENT_MODEL ?? "claude-3-5-haiku-latest",
  plannerModel: process.env.CLAUDE_PLANNER_MODEL ?? "claude-sonnet-4-5",
  ollamaBaseUrl: process.env.OLLAMA_BASE_URL ?? "http://localhost:11434",
  ollamaApiKey: process.env.OLLAMA_API_KEY ?? "",
  ollamaModel: process.env.OLLAMA_MODEL ?? "kimi-k2.5",
  ollamaFallbackModel: process.env.OLLAMA_FALLBACK_MODEL ?? "glm-5",
  ollamaFastModel: process.env.OLLAMA_FAST_MODEL ?? "gpt-oss20b",
  groqApiKey: process.env.GROQ_API_KEY ?? "",
  openRouterApiKey: process.env.OPENROUTER_API_KEY ?? "",
  openRouterBaseUrl: process.env.OPENROUTER_BASE_URL ?? "https://openrouter.ai/api/v1",
  supabaseUrl: process.env.SUPABASE_URL ?? "",
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
  idempotencyTtlSeconds: Number(process.env.IDEMPOTENCY_TTL_SECONDS ?? 86400),
  retentionDaysAudit: Number(process.env.RETENTION_DAYS_AUDIT ?? 365),
  retentionDaysTelemetry: Number(process.env.RETENTION_DAYS_TELEMETRY ?? 90),
  retentionDaysIdempotency: Number(process.env.RETENTION_DAYS_IDEMPOTENCY ?? 30),
  retentionDaysPendingRejected: Number(process.env.RETENTION_DAYS_PENDING_REJECTED ?? 30),
  providerRetryCount: Number(process.env.PROVIDER_RETRY_COUNT ?? 2),
  providerRetryJitterMs: Number(process.env.PROVIDER_RETRY_JITTER_MS ?? 200),
  providerCircuitFailureThreshold: Number(process.env.PROVIDER_CIRCUIT_FAILURE_THRESHOLD ?? 3),
  providerCircuitCooldownMs: Number(process.env.PROVIDER_CIRCUIT_COOLDOWN_MS ?? 30000),
  allowedOrigins: (process.env.ALLOWED_ORIGINS ?? "").split(",").map((item) => item.trim()).filter(Boolean),
  asyncPipelineEnabled: (process.env.ASYNC_PIPELINE_ENABLED ?? (process.env.NODE_ENV === "production" ? "true" : "false")) === "true",
  asyncWorkerEnabled: (process.env.ASYNC_WORKER_ENABLED ?? "false") === "true",
  asyncWorkerExecutionEnabled: (process.env.ASYNC_WORKER_EXECUTION_ENABLED ?? "false") === "true",
  asyncWorkerPollMs: Number(process.env.ASYNC_WORKER_POLL_MS ?? 2000),
  asyncWorkerBatchSize: Number(process.env.ASYNC_WORKER_BATCH_SIZE ?? 5),
  wsRealtimeEnabled: (process.env.WS_REALTIME_ENABLED ?? (process.env.NODE_ENV === "production" ? "true" : "false")) === "true",
  rlsEnforced: (process.env.RLS_ENFORCED ?? (process.env.NODE_ENV === "production" ? "true" : "false")) === "true",
  promptRegistryEnabled: (process.env.PROMPT_REGISTRY_ENABLED ?? (process.env.NODE_ENV === "production" ? "true" : "false")) === "true",
  redisUrl: process.env.REDIS_URL ?? "redis://localhost:6379",
  redisQueuePrefix: process.env.REDIS_QUEUE_PREFIX ?? "sacco:queue:",
  redisConcurrency: Number(process.env.REDIS_CONCURRENCY ?? 10),
  eventBusEnabled: (process.env.EVENT_BUS_ENABLED ?? (process.env.NODE_ENV === "production" ? "true" : "false")) === "true",
  natsUrl: process.env.NATS_URL ?? "",
};

export function hasClaude(): boolean {
  return env.anthropicApiKey.length > 0;
}

export function hasSupabase(): boolean {
  return env.supabaseUrl.length > 0 && env.supabaseServiceRoleKey.length > 0;
}

export function hasGroq(): boolean {
  return env.groqApiKey.length > 0;
}

export function hasOpenRouter(): boolean {
  return env.openRouterApiKey.length > 0;
}
