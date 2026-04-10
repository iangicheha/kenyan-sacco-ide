import { getContext } from "../agents/dataAgent";
import type {
  DataAgentOutput,
  GoalAutonomyAudit,
  GoalReport,
  RetrievedContext,
  ScenarioRun,
  StrategyCandidate,
  StructuredObjective,
} from "../types";
import { parseGoal } from "./goalAgent";
import { decomposeTasks } from "./taskDecomposer";
import { planStrategies } from "./strategyPlanner";
import { getSimulationBaseRows, runScenarios, _clearSimulationCacheForTests } from "../simulation/scenarioEngine";
import { buildGoalReport } from "../reporting/reportGenerator";

export interface RunGoalPipelineInput {
  goal: string;
  tableNameHint?: string;
  skipCaches?: boolean;
}

export interface RunGoalPipelineResult {
  goal: string;
  objective: StructuredObjective;
  tasks: string[];
  strategies: StrategyCandidate[];
  scenarios: ScenarioRun[];
  report: GoalReport;
  audit: GoalAutonomyAudit;
  retrievedContext: RetrievedContext;
  dataAgent: DataAgentOutput;
}

/**
 * goal → goalAgent → taskDecomposer → strategyPlanner → scenarioEngine → executionEngine → reportGenerator
 */
export async function runGoalPipeline(input: RunGoalPipelineInput): Promise<RunGoalPipelineResult> {
  const totalStart = Date.now();
  const goal = input.goal.trim();
  if (!goal) {
    throw new Error("goal is required");
  }

  const objective = parseGoal(goal);
  const decomposed = decomposeTasks(objective);

  const dataAgent = await getContext(goal, {
    tableNameHint: input.tableNameHint,
    skipCache: input.skipCaches,
  });

  const retrievedContext: RetrievedContext = {
    relevantTables: dataAgent.relevantTables,
    relevantColumns: dataAgent.relevantColumns,
    relevantDocs: dataAgent.relevantDocs,
    selectedChunks: dataAgent.selectedChunks,
  };

  const strategies = await planStrategies(goal, objective, retrievedContext, {
    tableNameHint: input.tableNameHint,
    skipCache: input.skipCaches,
  });

  if (strategies.length === 0) {
    throw new Error("No valid strategies after planning and validation");
  }

  const primary = strategies[0];
  const baseRows = getSimulationBaseRows(primary.plan.tableName);

  const scenarioRuns = runScenarios(primary.plan, baseRows, {});
  const cacheHits = scenarioRuns.filter((s) => s.cacheHit).length;

  const report = buildGoalReport({
    goalText: goal,
    objective,
    strategies,
    scenarios: scenarioRuns,
  });

  const totalMs = Date.now() - totalStart;
  const audit: GoalAutonomyAudit = {
    goalInput: goal,
    objective,
    tasks: decomposed.tasks,
    strategies,
    scenarios: scenarioRuns,
    report,
    performance: {
      totalMs,
      scenarioCount: scenarioRuns.length,
      cacheHits,
      maxScenarios: Math.max(1, Number(process.env.GOAL_MAX_SCENARIOS ?? 4)),
    },
  };

  return {
    goal,
    objective,
    tasks: decomposed.tasks,
    strategies,
    scenarios: scenarioRuns,
    report,
    audit,
    retrievedContext,
    dataAgent,
  };
}

export { _clearSimulationCacheForTests };
