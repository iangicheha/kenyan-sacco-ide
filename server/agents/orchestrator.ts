import { executePlan } from "../engine/executionEngine";
import type {
  AgentPipelineAudit,
  AgentRetryRecord,
  DataAgentOutput,
  ExecutionResult,
  OrchestratorMetrics,
  PlanningAgentOutput,
  ValidationAgentOutput,
} from "../types";
import { _clearDataAgentCacheForTests, getContext } from "./dataAgent";
import { _clearPlanningAgentCacheForTests, createPlan } from "./planningAgent";
import { validate } from "./validationAgent";

const MAX_PLAN_RETRIES = 2;

export interface OrchestratorRunInput {
  query: string;
  tableNameHint?: string;
  /** Tests / deterministic runs */
  skipCaches?: boolean;
}

export interface OrchestratorRunResult {
  context: DataAgentOutput;
  plan: PlanningAgentOutput["plan"];
  planning: PlanningAgentOutput;
  validation: ValidationAgentOutput;
  execution: ExecutionResult;
  result: unknown;
  retries: AgentRetryRecord[];
  metrics: OrchestratorMetrics;
  agentPipeline: AgentPipelineAudit;
}

export async function run(input: OrchestratorRunInput): Promise<OrchestratorRunResult> {
  const totalStart = Date.now();
  const retries: AgentRetryRecord[] = [];

  const context = await getContext(input.query, {
    tableNameHint: input.tableNameHint,
    skipCache: input.skipCaches,
  });

  let planning: PlanningAgentOutput | undefined;
  let validation: ValidationAgentOutput | undefined;
  let retryHint: string | undefined;

  for (let attempt = 0; attempt <= MAX_PLAN_RETRIES; attempt++) {
    planning = await createPlan(input.query, {
      relevantTables: context.relevantTables,
      relevantColumns: context.relevantColumns,
      relevantDocs: context.relevantDocs,
      selectedChunks: context.selectedChunks,
    }, {
      tableNameHint: input.tableNameHint,
      retryHint,
      skipCache: input.skipCaches,
    });

    validation = validate(planning.plan);

    if (validation.valid) {
      break;
    }

    if (attempt < MAX_PLAN_RETRIES) {
      const reason = validation.message ?? "validation failed";
      retries.push({ attempt: attempt + 1, reason });
      retryHint = reason;
    }
  }

  if (!planning || !validation) {
    throw new Error("Orchestrator internal error: missing plan or validation");
  }

  if (!validation.valid) {
    const metrics: OrchestratorMetrics = {
      dataAgentMs: context.latencyMs,
      planningAgentMs: planning.latencyMs,
      validationAgentMs: validation.latencyMs,
      executionMs: 0,
      totalMs: Date.now() - totalStart,
    };
    const agentPipeline: AgentPipelineAudit = {
      dataAgent: context,
      planningAgent: planning,
      validationAgent: validation,
      retries,
      metrics,
    };
    const err = new Error(validation.message ?? "Plan validation failed") as Error & {
      agentPipeline: AgentPipelineAudit;
    };
    err.agentPipeline = agentPipeline;
    throw err;
  }

  const execStart = Date.now();
  let execution: ExecutionResult;
  try {
    execution = executePlan(planning.plan);
  } catch (execErr) {
    const executionMs = Date.now() - execStart;
    const metrics: OrchestratorMetrics = {
      dataAgentMs: context.latencyMs,
      planningAgentMs: planning.latencyMs,
      validationAgentMs: validation.latencyMs,
      executionMs,
      totalMs: Date.now() - totalStart,
    };
    const agentPipeline: AgentPipelineAudit = {
      dataAgent: context,
      planningAgent: planning,
      validationAgent: validation,
      retries,
      metrics,
    };
    const msg = execErr instanceof Error ? execErr.message : "Execution failed";
    const err = new Error(msg) as Error & { agentPipeline: AgentPipelineAudit };
    err.agentPipeline = agentPipeline;
    throw err;
  }
  const executionMs = Date.now() - execStart;

  const metrics: OrchestratorMetrics = {
    dataAgentMs: context.latencyMs,
    planningAgentMs: planning.latencyMs,
    validationAgentMs: validation.latencyMs,
    executionMs,
    totalMs: Date.now() - totalStart,
  };

  const agentPipeline: AgentPipelineAudit = {
    dataAgent: context,
    planningAgent: planning,
    validationAgent: validation,
    retries,
    metrics,
  };

  return {
    context,
    plan: planning.plan,
    planning,
    validation,
    execution,
    result: execution.result,
    retries,
    metrics,
    agentPipeline,
  };
}

export function _clearOrchestratorCachesForTests(): void {
  _clearDataAgentCacheForTests();
  _clearPlanningAgentCacheForTests();
}
