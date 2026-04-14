import { Router } from "express";
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
    },
  };

  if (!supabase) {
    return res.json(result);
  }

  const pendingCheck = await supabase.from("pending_operations").select("id").limit(1);
  result.checks.pendingOperationsTable = !pendingCheck.error;

  const auditCheck = await supabase.from("audit_log").select("id").limit(1);
  result.checks.auditLogTable = !auditCheck.error;

  return res.json(result);
});
