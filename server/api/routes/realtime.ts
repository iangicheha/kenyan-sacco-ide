import { Router } from "express";
import { requireRole } from "../../middleware/apiAuth";
import { getRealtimeState } from "../../realtime/store";
import { getAlerts } from "../../alerts/notifier";
import { ingestFinancialEvent, ingestMarketData, ingestTransaction } from "../../streaming/ingestion";

export const realtimeRouter = Router();

realtimeRouter.get("/realtime/state", requireRole("read-only"), (_req, res) => {
  return res.status(200).json({ ok: true, state: getRealtimeState() });
});

realtimeRouter.get("/alerts", requireRole("read-only"), (_req, res) => {
  return res.status(200).json({ ok: true, alerts: getAlerts() });
});

realtimeRouter.post("/realtime/ingest", requireRole("analyst"), (req, res) => {
  const topic = String(req.body?.topic ?? "").trim();
  const payload = (req.body?.payload ?? {}) as Record<string, unknown>;
  if (!topic) return res.status(400).json({ ok: false, error: "topic is required" });
  if (topic === "transactions") return res.status(200).json({ ok: true, event: ingestTransaction(payload) });
  if (topic === "market_data") return res.status(200).json({ ok: true, event: ingestMarketData(payload) });
  if (topic === "financial_events") {
    return res.status(200).json({ ok: true, event: ingestFinancialEvent(payload) });
  }
  return res.status(400).json({ ok: false, error: "Unsupported topic" });
});
