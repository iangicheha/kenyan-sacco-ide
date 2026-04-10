import { Router } from "express";
import { run as orchestratorRun } from "../../agents/orchestrator";
import type { AgentPipelineAudit, OrchestratorMetrics } from "../../types";
import { exportAuditCsv, exportAuditLog, exportAuditSqlDump, recordAudit } from "../../audit/auditLogger";
import { requireRole } from "../../middleware/apiAuth";
import type { AiExecutionPlan } from "../../types";
import { runGoalPipeline } from "../../autonomy/runGoalPipeline";
import {
  cacheSuccessfulPlan,
  improveRetrievalRanking,
  logFailedPlan,
} from "../../learning/continuousLearning";
import type { DataAgentOutput, ValidationAgentOutput } from "../../types";

export const aiRouter = Router();

type AiChatSuccessResponse = {
  query: string;
  context: Record<string, unknown>;
  plan: unknown[];
  validation: Record<string, unknown>;
  execution: {
    steps: unknown[];
    final: unknown;
  };
  result: unknown;
  error: null;
};

type AiChatErrorResponse = {
  query: string;
  context: null;
  plan: null;
  validation: null;
  execution: null;
  result: null;
  error: string;
};

function buildErrorResponse(query: string, error: string): AiChatErrorResponse {
  return {
    query,
    context: null,
    plan: null,
    validation: null,
    execution: null,
    result: null,
    error,
  };
}

function toStructuredContext(context: DataAgentOutput): Record<string, unknown> {
  return {
    confidence: context.confidence,
    relevantTables: context.relevantTables.map((t) => ({
      name: t.name,
      schemaVersion: t.schemaVersion,
      score: t.score,
      columns: t.columns,
    })),
    relevantColumns: context.relevantColumns.map((c) => ({
      tableName: c.tableName,
      column: c.column,
      type: c.type,
      score: c.score,
    })),
    relevantDocs: context.relevantDocs.map((d) => ({
      id: d.id,
      title: d.title,
      score: d.score,
    })),
    selectedChunks:
      context.selectedChunks?.map((chunk) => ({
        id: chunk.id,
        kind: chunk.kind,
        score: chunk.score,
      })) ?? [],
  };
}

function toStructuredValidation(validation: ValidationAgentOutput): Record<string, unknown> {
  return {
    valid: validation.valid,
    decisions: validation.decisions.map((decision) => ({
      code: decision.code,
      severity: decision.severity,
    })),
    correctedPlan: validation.correctedPlan ?? null,
  };
}

aiRouter.post("/ai/chat", requireRole("analyst"), async (req, res) => {
  const message = String(req.body?.message ?? "").trim();
  const tableName = req.body?.tableName ? String(req.body.tableName) : undefined;
  if (!message) return res.status(400).json(buildErrorResponse("", "message is required"));

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
    cacheSuccessfulPlan(message, orchestrated.plan);
    improveRetrievalRanking(retrievedContext);

    const result = orchestrated.execution.result;
    const response: AiChatSuccessResponse = {
      query: message,
      context: toStructuredContext(orchestrated.context),
      plan: orchestrated.plan.steps,
      validation: toStructuredValidation(orchestrated.validation),
      execution: {
        steps: orchestrated.execution.steps,
        final: result,
      },
      result,
      error: null,
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
    logFailedPlan(message, messageText, tableName);

    return res.status(400).json(buildErrorResponse(message, messageText));
  }
});

aiRouter.post("/ai/goal", requireRole("analyst"), async (req, res) => {
  const goal = String(req.body?.goal ?? "").trim();
  const tableName = req.body?.tableName ? String(req.body.tableName) : undefined;
  if (!goal) return res.status(400).json({ error: "goal is required" });

  const emptyPlan: AiExecutionPlan = {
    intent: "error",
    tableName: tableName ?? "",
    schemaVersion: 1,
    steps: [],
  };

  try {
    const result = await runGoalPipeline({
      goal,
      tableNameHint: tableName,
    });
    const baseline = result.scenarios.find((s) => s.id === "baseline") ?? result.scenarios[0];
    const primary = result.strategies[0];
    const planningMs = result.strategies.reduce((a, s) => a + s.planning.latencyMs, 0);
    const validationMs = result.strategies.reduce((a, s) => a + s.validation.latencyMs, 0);
    const executionMs = result.scenarios.reduce((a, s) => a + s.executionMs, 0);
    const metrics: OrchestratorMetrics = {
      dataAgentMs: result.dataAgent.latencyMs,
      planningAgentMs: planningMs,
      validationAgentMs: validationMs,
      executionMs,
      totalMs: result.audit.performance.totalMs,
    };
    const agentPipeline: AgentPipelineAudit = {
      dataAgent: result.dataAgent,
      planningAgent: primary.planning,
      validationAgent: primary.validation,
      retries: [],
      metrics,
      goalAutonomy: result.audit,
    };
    recordAudit({
      user: req.user?.sub ?? "unknown",
      input: goal,
      retrievedContext: {
        relevantTables: result.retrievedContext.relevantTables,
        relevantColumns: result.retrievedContext.relevantColumns,
        relevantDocs: result.retrievedContext.relevantDocs,
        selectedChunks: result.retrievedContext.selectedChunks,
      },
      interpretation: {
        kind: "goal_autonomy",
        intentSummary: result.objective.label,
        objectiveKey: result.objective.objective,
        tasks: result.tasks,
        strategiesCount: result.strategies.length,
        scenariosRun: result.scenarios.map((s) => s.id),
      },
      plan: primary.plan,
      validationResult: { valid: true },
      executionSteps:
        baseline?.execution.steps.map((s) => ({ action: s.step.action, output: s.output })) ?? [],
      executionResult: baseline?.execution.result ?? null,
      agentPipeline,
    });
    cacheSuccessfulPlan(goal, primary.plan);
    improveRetrievalRanking(result.retrievedContext);

    return res.status(200).json({
      goal: result.goal,
      tasks: result.tasks,
      strategies: result.strategies,
      scenarios: result.scenarios,
      report: result.report,
      objective: result.objective,
      metrics: result.audit.performance,
    });
  } catch (error) {
    const messageText = error instanceof Error ? error.message : "Unknown error";
    recordAudit({
      user: req.user?.sub ?? "unknown",
      input: goal,
      interpretation: {
        kind: "goal_autonomy",
        error: messageText,
      },
      plan: emptyPlan,
      validationResult: { valid: false, message: messageText },
      executionSteps: [],
      executionResult: null,
      agentPipeline: {
        retries: [],
        metrics: {
          dataAgentMs: 0,
          planningAgentMs: 0,
          validationAgentMs: 0,
          executionMs: 0,
          totalMs: 0,
        },
      },
    });
    logFailedPlan(goal, messageText, tableName);
    return res.status(400).json({ ok: false, error: messageText });
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
