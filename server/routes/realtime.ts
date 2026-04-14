import { Router } from "express";
import { getAuditLog } from "../engine/auditLogger.js";
import { listPendingOperations } from "../engine/pendingOps.js";

export const realtimeRouter = Router();

realtimeRouter.get("/state", async (_req, res) => {
  const pending = await listPendingOperations("s2").catch(() => []);
  const audit = await getAuditLog("s2").catch(() => []);
  const highRisk = pending.filter((p) => (p.confidence ?? 0) < 0.85).length;
  return res.json({
    state: {
      metrics: {
        transactionCount: audit.length + pending.length,
        transactionVolume: audit.length * 1000,
        highRiskTransactionCount: highRisk,
        marketTickCount: 1,
        anomalyCount: highRisk,
        updatedAt: new Date().toISOString(),
      },
    },
  });
});
