import { Router, type Response } from "express";
import { z } from "zod";
import { getAuditLog } from "../engine/auditLogger.js";
import { getIdempotentResponse, saveIdempotentResponse } from "../engine/idempotencyStore.js";
import { getOrchestratorStageMetrics, listOrchestratorEvents } from "../engine/orchestratorTelemetry.js";
import { listPendingOperations } from "../engine/pendingOps.js";
import { getRequestContext } from "../engine/requestContext.js";
import { assertTenantAccess } from "../engine/tenantAccess.js";
import { listWorkflowTransitions } from "../engine/workflowState.js";
import { isServiceUnavailableError } from "../lib/serviceUnavailableError.js";
import { userHasAnyRole, type AuthenticatedRequest } from "../middleware/auth.js";
import { acceptOperation, rejectOperation } from "../pipeline/runAiPipeline.js";

const acceptSchema = z.object({
  operationId: z.string().min(1),
  analyst: z.string().min(1),
  sheetData: z
    .record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()]))
    .optional(),
});

export const spreadsheetRouter = Router();

function assertSessionTenantOrThrow(sessionId: string, tenantId: string): void {
  const sessionTenantId = sessionId.split(":")[0] ?? "";
  assertTenantAccess(sessionTenantId, tenantId);
}

function requireSpreadsheetRoles(
  req: AuthenticatedRequest,
  res: Response,
  allowedRoles: Array<"read-only" | "analyst" | "reviewer" | "admin">,
  correlationId?: string
): boolean {
  if (userHasAnyRole(req, allowedRoles)) return true;
  res.status(403).json({
    error: `Forbidden. Required role: ${allowedRoles.join(" or ")}.`,
    ...(correlationId ? { correlationId } : {}),
  });
  return false;
}

spreadsheetRouter.get("/pending/:sessionId", async (req, res) => {
  const request = req as AuthenticatedRequest;
  if (!requireSpreadsheetRoles(request, res, ["analyst", "reviewer", "admin"])) return;
  try {
    assertSessionTenantOrThrow(req.params.sessionId, request.user?.tenantId ?? "");
  } catch {
    return res.status(403).json({ error: "Forbidden. Cross-tenant session access denied." });
  }
  const pendingOperations = await listPendingOperations(req.params.sessionId, request.user?.tenantId ?? "default");
  return res.json({
    pendingOperations,
  });
});

spreadsheetRouter.post("/accept", async (req, res) => {
  const context = getRequestContext(req);
  res.setHeader("x-correlation-id", context.correlationId);
  const request = req as AuthenticatedRequest;
  if (!userHasAnyRole(request, ["reviewer", "admin"])) {
    return res.status(403).json({
      error: "Forbidden. Reviewer or admin role required.",
      correlationId: context.correlationId,
    });
  }
  const parsed = acceptSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      error: "Invalid accept payload.",
      correlationId: context.correlationId,
      details: parsed.error.flatten(),
    });
  }

  try {
    if (context.idempotencyKey) {
      const cached = await getIdempotentResponse("spreadsheet.accept", context.idempotencyKey);
      if (cached) {
        return res.status(cached.statusCode).json(cached.body);
      }
    }

    const result = await acceptOperation({
      tenantId: request.user?.tenantId ?? "default",
      operationId: parsed.data.operationId,
      analyst: parsed.data.analyst,
      sheetData: parsed.data.sheetData,
      correlationId: context.correlationId,
    });
    if (result.status === "forbidden") {
      return res.status(403).json({
        error: "Forbidden. Cross-tenant operation access denied.",
        correlationId: context.correlationId,
      });
    }
    if (result.status === "not_found") {
      const body = { ...result, correlationId: context.correlationId };
      if (context.idempotencyKey) {
        await saveIdempotentResponse("spreadsheet.accept", context.idempotencyKey, { statusCode: 404, body });
      }
      return res.status(404).json(body);
    }
    if (result.status === "invalid_operation") {
      const body = { ...result, correlationId: context.correlationId };
      if (context.idempotencyKey) {
        await saveIdempotentResponse("spreadsheet.accept", context.idempotencyKey, { statusCode: 400, body });
      }
      return res.status(400).json(body);
    }
    const body = {
      ...result,
      correlationId: context.correlationId,
      reviewer: request.user?.email ?? parsed.data.analyst,
    };
    if (context.idempotencyKey) {
      await saveIdempotentResponse("spreadsheet.accept", context.idempotencyKey, { statusCode: 200, body });
    }
    return res.json(body);
  } catch (error) {
    if (isServiceUnavailableError(error)) {
      return res.status(503).json({
        error: "Service temporarily unavailable for critical write path.",
        message: "Please retry after data services recover.",
        correlationId: context.correlationId,
      });
    }
    return res.status(500).json({
      error: "Failed to accept operation.",
      message: "Please retry in a moment.",
      correlationId: context.correlationId,
    });
  }
});

spreadsheetRouter.post("/reject", async (req, res) => {
  const context = getRequestContext(req);
  res.setHeader("x-correlation-id", context.correlationId);
  const request = req as AuthenticatedRequest;
  if (!userHasAnyRole(request, ["reviewer", "admin"])) {
    return res.status(403).json({
      error: "Forbidden. Reviewer or admin role required.",
      correlationId: context.correlationId,
    });
  }
  const parsed = z.object({ operationId: z.string().min(1) }).safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      error: "Invalid reject payload.",
      correlationId: context.correlationId,
      details: parsed.error.flatten(),
    });
  }

  try {
    if (context.idempotencyKey) {
      const cached = await getIdempotentResponse("spreadsheet.reject", context.idempotencyKey);
      if (cached) {
        return res.status(cached.statusCode).json(cached.body);
      }
    }
    const result = await rejectOperation({
      tenantId: request.user?.tenantId ?? "default",
      operationId: parsed.data.operationId,
      actor: request.user?.email ?? "reviewer",
      correlationId: context.correlationId,
    });
    if (result.status === "forbidden") {
      return res.status(403).json({
        error: "Forbidden. Cross-tenant operation access denied.",
        correlationId: context.correlationId,
      });
    }
    if (result.status === "not_found") {
      const body = { ...result, correlationId: context.correlationId };
      if (context.idempotencyKey) {
        await saveIdempotentResponse("spreadsheet.reject", context.idempotencyKey, { statusCode: 404, body });
      }
      return res.status(404).json(body);
    }
    const body = { ...result, correlationId: context.correlationId };
    if (context.idempotencyKey) {
      await saveIdempotentResponse("spreadsheet.reject", context.idempotencyKey, { statusCode: 200, body });
    }
    return res.json(body);
  } catch (error) {
    if (isServiceUnavailableError(error)) {
      return res.status(503).json({
        error: "Service temporarily unavailable for critical write path.",
        message: "Please retry after data services recover.",
        correlationId: context.correlationId,
      });
    }
    return res.status(500).json({
      error: "Failed to reject operation.",
      message: "Please retry in a moment.",
      correlationId: context.correlationId,
    });
  }
});

spreadsheetRouter.get("/audit/:sessionId", async (req, res) => {
  const request = req as AuthenticatedRequest;
  if (!requireSpreadsheetRoles(request, res, ["reviewer", "admin"])) return;
  try {
    assertSessionTenantOrThrow(req.params.sessionId, request.user?.tenantId ?? "");
  } catch {
    return res.status(403).json({ error: "Forbidden. Cross-tenant session access denied." });
  }
  return res.json({
    audit: await getAuditLog(req.params.sessionId, request.user?.tenantId ?? "default"),
  });
});

spreadsheetRouter.get("/workflow/:sessionId", async (req, res) => {
  const request = req as AuthenticatedRequest;
  if (!requireSpreadsheetRoles(request, res, ["reviewer", "admin"])) return;
  try {
    assertSessionTenantOrThrow(req.params.sessionId, request.user?.tenantId ?? "");
  } catch {
    return res.status(403).json({ error: "Forbidden. Cross-tenant session access denied." });
  }
  return res.json({
    transitions: await listWorkflowTransitions(req.params.sessionId, request.user?.tenantId ?? "default"),
  });
});

spreadsheetRouter.get("/events/:sessionId", async (req, res) => {
  const request = req as AuthenticatedRequest;
  if (!requireSpreadsheetRoles(request, res, ["reviewer", "admin"])) return;
  try {
    assertSessionTenantOrThrow(req.params.sessionId, request.user?.tenantId ?? "");
  } catch {
    return res.status(403).json({ error: "Forbidden. Cross-tenant session access denied." });
  }
  return res.json({
    events: await listOrchestratorEvents(req.params.sessionId, request.user?.tenantId ?? "default"),
  });
});

spreadsheetRouter.get("/metrics/:sessionId", async (req, res) => {
  const request = req as AuthenticatedRequest;
  if (!requireSpreadsheetRoles(request, res, ["reviewer", "admin"])) return;
  try {
    assertSessionTenantOrThrow(req.params.sessionId, request.user?.tenantId ?? "");
  } catch {
    return res.status(403).json({ error: "Forbidden. Cross-tenant session access denied." });
  }
  return res.json({
    metrics: await getOrchestratorStageMetrics(req.params.sessionId, request.user?.tenantId ?? "default"),
  });
});
