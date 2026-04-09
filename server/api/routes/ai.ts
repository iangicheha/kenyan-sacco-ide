import { Router } from "express";
import { run as orchestratorRun } from "../../agents/orchestrator";
import type { AgentPipelineAudit } from "../../types";
import { exportAuditCsv, exportAuditLog, exportAuditSqlDump, recordAudit } from "../../audit/auditLogger";
import { requireRole } from "../../middleware/apiAuth";
import type { AiExecutionPlan } from "../../types";

export const aiRouter = Router();

aiRouter.post("/ai/chat", requireRole("analyst"), async (req, res) => {
  const message = String(req.body?.message ?? "").trim();
  const tableName = req.body?.tableName ? String(req.body.tableName) : undefined;
  if (!message) return res.status(400).json({ error: "message is required" });

  try {
    const orchestrated = await orchestratorRun({
      query: message,
      tableNameHint: tableName,
    });

    const retrievedContext = {
      relevantTables: orchestrated.context.relevantTables,
      relevantColumns: orchestrated.context.relevantColumns,
      relevantDocs: orchestrated.context.relevantDocs,
      selectedChunks: orchestrated.context.selectedChunks,
    };

    recordAudit({
      user: req.user?.sub ?? "unknown",
      input: message,
      retrievedContext,
      interpretation: {
        intentSummary: orchestrated.planning.intentSummary,
        source: orchestrated.planning.source,
      },
      plan: orchestrated.plan,
      validationResult: {
        valid: orchestrated.validation.valid,
        message: orchestrated.validation.message,
      },
      executionSteps: orchestrated.execution.steps.map((s) => ({ action: s.step.action, output: s.output })),
      executionResult: orchestrated.execution.result,
      agentPipeline: orchestrated.agentPipeline,
    });

    const response = {
      ok: true,
      context: orchestrated.context,
      plan: orchestrated.plan,
      planning: {
        intentSummary: orchestrated.planning.intentSummary,
        source: orchestrated.planning.source,
        latencyMs: orchestrated.planning.latencyMs,
        cacheHit: orchestrated.planning.cacheHit,
      },
      validation: orchestrated.validation,
      execution: orchestrated.execution,
      result: orchestrated.result,
      retries: orchestrated.retries,
      metrics: orchestrated.metrics,
      interpretation: {
        intentSummary: orchestrated.planning.intentSummary,
        source: orchestrated.planning.source,
      },
      retrievedContext,
    };
    return res.status(200).json(response);
  } catch (error) {
    const pipeline = (error as Error & { agentPipeline?: AgentPipelineAudit }).agentPipeline;
    const emptyPlan: AiExecutionPlan = {
      intent: "error",
      tableName: tableName ?? "",
      schemaVersion: 1,
      steps: [],
    };
    const messageText = error instanceof Error ? error.message : "Unknown error";

    recordAudit({
      user: req.user?.sub ?? "unknown",
      input: message,
      retrievedContext: pipeline?.dataAgent
        ? {
            relevantTables: pipeline.dataAgent.relevantTables,
            relevantColumns: pipeline.dataAgent.relevantColumns,
            relevantDocs: pipeline.dataAgent.relevantDocs,
            selectedChunks: pipeline.dataAgent.selectedChunks,
          }
        : undefined,
      interpretation: pipeline?.planningAgent
        ? { intentSummary: pipeline.planningAgent.intentSummary, source: pipeline.planningAgent.source }
        : {},
      plan: pipeline?.planningAgent?.plan ?? emptyPlan,
      validationResult: {
        valid: false,
        message: messageText,
      },
      executionSteps: [],
      executionResult: null,
      agentPipeline: pipeline,
    });

    return res.status(400).json({
      ok: false,
      error: messageText,
      validation: pipeline?.validationAgent,
      retries: pipeline?.retries ?? [],
      metrics: pipeline?.metrics,
      agentPipeline: pipeline,
    });
  }
});

aiRouter.get("/audit/export", requireRole("admin"), (req, res) => {
  const format = String(req.query.format ?? "json").toLowerCase();
  if (format === "csv") {
    res.setHeader("content-type", "text/csv; charset=utf-8");
    return res.status(200).send(exportAuditCsv());
  }
  if (format === "sql") {
    res.setHeader("content-type", "application/sql; charset=utf-8");
    return res.status(200).send(exportAuditSqlDump());
  }
  return res.status(200).json({ events: exportAuditLog() });
});
