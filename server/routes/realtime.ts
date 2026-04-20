import { Router } from "express";
import { getAuditLog } from "../engine/auditLogger.js";
import { listPendingOperations } from "../engine/pendingOps.js";
import { subscribeTenantEvents } from "../lib/realtimeHub.js";
import type { AuthenticatedRequest } from "../middleware/auth.js";

export const realtimeRouter = Router();

realtimeRouter.get("/state", async (req, res) => {
  const request = req as AuthenticatedRequest;
  const tenantId = request.user?.tenantId ?? "default";
  const sessionId = "s2";
  const pending = await listPendingOperations(sessionId, tenantId).catch(() => []);
  const audit = await getAuditLog(sessionId, tenantId).catch(() => []);
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

realtimeRouter.get("/stream", async (req, res) => {
  const request = req as AuthenticatedRequest;
  const tenantId = request.user?.tenantId ?? "default";
  const sessionId = typeof req.query.sessionId === "string" ? req.query.sessionId : undefined;

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders?.();

  const unsubscribe = subscribeTenantEvents(tenantId, sessionId, (event) => {
    res.write(`event: orchestrator\n`);
    res.write(`data: ${JSON.stringify(event)}\n\n`);
  });

  const heartbeat = setInterval(() => {
    res.write(`event: ping\ndata: {"ok":true,"ts":"${new Date().toISOString()}"}\n\n`);
  }, 15000);

  req.on("close", () => {
    clearInterval(heartbeat);
    unsubscribe();
    res.end();
  });
});
