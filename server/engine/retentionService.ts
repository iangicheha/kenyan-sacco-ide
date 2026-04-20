import { env } from "../config/env.js";
import { cleanupExpiredAuditRecords } from "./auditLogger.js";
import { cleanupExpiredIdempotencyRecords } from "./idempotencyStore.js";
import { cleanupExpiredTelemetryRecords } from "./orchestratorTelemetry.js";
import { cleanupExpiredRejectedPendingOperations } from "./pendingOps.js";

export async function runRetentionCleanup() {
  const [audit, telemetry, idempotency, pendingRejected] = await Promise.all([
    cleanupExpiredAuditRecords(env.retentionDaysAudit),
    cleanupExpiredTelemetryRecords(env.retentionDaysTelemetry),
    cleanupExpiredIdempotencyRecords(),
    cleanupExpiredRejectedPendingOperations(env.retentionDaysPendingRejected),
  ]);

  return {
    ranAt: new Date().toISOString(),
    retentionDays: {
      audit: env.retentionDaysAudit,
      telemetry: env.retentionDaysTelemetry,
      idempotency: env.retentionDaysIdempotency,
      pendingRejected: env.retentionDaysPendingRejected,
    },
    audit,
    telemetry,
    idempotency,
    pendingRejected,
  };
}
