import { Router } from "express";
import { cleanupExpiredIdempotencyRecords } from "../engine/idempotencyStore.js";
import { env, hasClaude, hasSupabase } from "../config/env.js";
import { getSupabase } from "../lib/supabase.js";

export const adminRouter = Router();

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

  return res.json(result);
});

adminRouter.post("/cleanup/idempotency", async (_req, res) => {
  const result = await cleanupExpiredIdempotencyRecords();
  return res.json({
    status: "ok",
    cleanup: result,
  });
});
