import { Router } from "express";
import { requireRole } from "../../middleware/apiAuth";

export const healthRouter = Router();

healthRouter.get("/health", requireRole("read-only"), (_req, res) => {
  res.status(200).json({ status: "ok", timestamp: new Date().toISOString() });
});
