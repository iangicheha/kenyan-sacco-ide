import { Router } from "express";
import { z } from "zod";
import { getAuditLog } from "../engine/auditLogger.js";
import { listPendingOperations } from "../engine/pendingOps.js";
import { acceptOperation, rejectOperation } from "../pipeline/runAiPipeline.js";

const acceptSchema = z.object({
  operationId: z.string().min(1),
  analyst: z.string().min(1),
  sheetData: z
    .record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()]))
    .optional(),
});

export const spreadsheetRouter = Router();

spreadsheetRouter.get("/pending/:sessionId", async (req, res) => {
  const pendingOperations = await listPendingOperations(req.params.sessionId);
  return res.json({
    pendingOperations,
  });
});

spreadsheetRouter.post("/accept", async (req, res) => {
  const parsed = acceptSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      error: "Invalid accept payload.",
      details: parsed.error.flatten(),
    });
  }

  const result = await acceptOperation(parsed.data);
  if (result.status === "not_found") {
    return res.status(404).json(result);
  }
  if (result.status === "invalid_operation") {
    return res.status(400).json(result);
  }
  return res.json(result);
});

spreadsheetRouter.post("/reject", async (req, res) => {
  const parsed = z.object({ operationId: z.string().min(1) }).safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      error: "Invalid reject payload.",
      details: parsed.error.flatten(),
    });
  }
  const result = await rejectOperation({ operationId: parsed.data.operationId });
  if (result.status === "not_found") return res.status(404).json(result);
  return res.json(result);
});

spreadsheetRouter.get("/audit/:sessionId", async (req, res) => {
  return res.json({
    audit: await getAuditLog(req.params.sessionId),
  });
});
