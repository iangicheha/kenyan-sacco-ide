import { Router } from "express";
import { z } from "zod";
import { env, hasClaude, hasSupabase } from "../config/env.js";
import { getOrchestratorMetricsSummary } from "../engine/orchestratorTelemetry.js";
import { activatePolicy, createPolicy, listPolicyHistory, validatePolicyStructure } from "../engine/policyStore.js";
import { runRetentionCleanup } from "../engine/retentionService.js";
import { getSupabase } from "../lib/supabase.js";
import type { Regulator } from "../types.js";

export const adminRouter = Router();

const regulatorSchema = z.enum(["CBK", "SASRA", "IRA", "RBA", "CMA"]);

const createPolicySchema = z.object({
  regulator: regulatorSchema,
  version: z.string().min(1),
  rulesJson: z.unknown(),
  effectiveFrom: z.string().min(1),
  effectiveTo: z.string().min(1).optional(),
  isActive: z.boolean().optional(),
});

adminRouter.get("/setup", async (_req, res) => {
  const supabase = getSupabase();
  const result = {
    env: {
      port: env.port,
      claudeConfigured: hasClaude(),
      supabaseConfigured: hasSupabase(),
      intentModel: env.intentModel,
      plannerModel: env.plannerModel,
    },
    checks: {
      pendingOperationsTable: false,
      auditLogTable: false,
      orchestratorEventsTable: false,
      workflowTransitionsTable: false,
      idempotencyRecordsTable: false,
      policiesTable: false,
    },
  };

  if (!supabase) {
    return res.json(result);
  }

  const pendingCheck = await supabase.from("pending_operations").select("id").limit(1);
  result.checks.pendingOperationsTable = !pendingCheck.error;

  const auditCheck = await supabase.from("audit_log").select("id").limit(1);
  result.checks.auditLogTable = !auditCheck.error;

  const orchestratorCheck = await supabase.from("orchestrator_events").select("id").limit(1);
  result.checks.orchestratorEventsTable = !orchestratorCheck.error;

  const workflowCheck = await supabase.from("workflow_transitions").select("id").limit(1);
  result.checks.workflowTransitionsTable = !workflowCheck.error;

  const idempotencyCheck = await supabase.from("idempotency_records").select("id").limit(1);
  result.checks.idempotencyRecordsTable = !idempotencyCheck.error;

  const policiesCheck = await supabase.from("policies").select("id").limit(1);
  result.checks.policiesTable = !policiesCheck.error;

  return res.json(result);
});

adminRouter.post("/policies", async (req, res) => {
  const parsed = createPolicySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid request body.", details: parsed.error.flatten() });
  }
  if (!validatePolicyStructure(parsed.data.rulesJson)) {
    return res.status(400).json({ error: "Invalid policy rulesJson structure." });
  }
  const created = await createPolicy({
    regulator: parsed.data.regulator as Regulator,
    version: parsed.data.version,
    rulesJson: parsed.data.rulesJson,
    effectiveFrom: parsed.data.effectiveFrom,
    effectiveTo: parsed.data.effectiveTo,
    isActive: parsed.data.isActive,
  });
  return res.json({ status: "ok", policy: created });
});

adminRouter.get("/policies/:regulator", async (req, res) => {
  const parsed = regulatorSchema.safeParse(req.params.regulator);
  if (!parsed.success) return res.status(400).json({ error: "Invalid regulator." });
  const history = await listPolicyHistory(parsed.data as Regulator);
  return res.json({ status: "ok", regulator: parsed.data, policies: history });
});

adminRouter.post("/policies/:id/activate", async (req, res) => {
  const id = String(req.params.id ?? "").trim();
  if (!id) return res.status(400).json({ error: "Missing policy id." });
  const result = await activatePolicy(id);
  if (result.status === "not_found") return res.status(404).json({ error: "Policy not found (or activation unsupported for legacy table)." });
  return res.json({ status: "ok" });
});

adminRouter.post("/cleanup/idempotency", async (_req, res) => {
  const result = await runRetentionCleanup();
  return res.json({
    status: "ok",
    cleanup: result.idempotency,
  });
});

adminRouter.post("/cleanup/audit", async (_req, res) => {
  const result = await runRetentionCleanup();
  return res.json({
    status: "ok",
    cleanup: result.audit,
  });
});

adminRouter.post("/cleanup/telemetry", async (_req, res) => {
  const result = await runRetentionCleanup();
  return res.json({
    status: "ok",
    cleanup: result.telemetry,
  });
});

adminRouter.post("/cleanup/all", async (_req, res) => {
  const cleanup = await runRetentionCleanup();
  return res.json({
    status: "ok",
    cleanup,
  });
});

adminRouter.get("/metrics/orchestrator", async (req, res) => {
  const tenantId = typeof req.query.tenantId === "string" && req.query.tenantId.trim().length > 0 ? req.query.tenantId : undefined;
  const metrics = await getOrchestratorMetricsSummary(tenantId);
  return res.json({
    status: "ok",
    scope: tenantId ? { tenantId } : { tenantId: "all" },
    metrics,
    generatedAt: new Date().toISOString(),
  });
});
