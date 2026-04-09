export type Primitive = string | number | boolean | null;

export type RowRecord = Record<string, Primitive>;

export type ColumnType = "string" | "number" | "date" | "boolean";

export interface TableSchema {
  tableName: string;
  columns: Array<{ name: string; type: ColumnType }>;
}

export interface DataTable {
  name: string;
  schema: TableSchema;
  rows: RowRecord[];
  version: number;
  updatedAt: string;
}

export type PlanActionType =
  | "select_column"
  | "apply_model"
  | "aggregate"
  | "fetch_external_rate"
  | "batch_execute";

export type ForecastModelType =
  | "moving_average"
  | "forecast"
  | "holt_winters"
  | "linear_regression"
  | "exponential_smoothing"
  | "arima";

export interface PlanStep {
  action: PlanActionType;
  column?: string;
  operation?: "sum" | "avg";
  type?: ForecastModelType;
  period?: number;
  forecastHorizon?: number;
  alpha?: number;
  beta?: number;
  gamma?: number;
  seasonLength?: number;
  d?: number;
  p?: number;
  q?: number;
  source?: string;
  steps?: PlanStep[];
}

export interface AiExecutionPlan {
  intent: string;
  tableName: string;
  schemaVersion: number;
  steps: PlanStep[];
}

export interface ExecutionStepResult {
  step: PlanStep;
  output: unknown;
}

export interface ExecutionResult {
  summary: string;
  result: unknown;
  steps: ExecutionStepResult[];
}

export interface AuditExecutionStep {
  action: PlanActionType;
  output: unknown;
}

export interface RetrievedTableRef {
  name: string;
  schemaVersion?: number;
  score: number;
  columns: string[];
  sample?: RowRecord[];
}

export interface RetrievedColumnRef {
  tableName: string;
  column: string;
  type?: ColumnType;
  score: number;
}

export interface RetrievedDocRef {
  id: string;
  title?: string;
  excerpt: string;
  score: number;
}

/** RAG output for planning context only — never used for numeric results. */
export interface RetrievedContext {
  relevantTables: RetrievedTableRef[];
  relevantColumns: RetrievedColumnRef[];
  relevantDocs: RetrievedDocRef[];
  /** Low-level hits for audit (ids, scores, snippets). */
  selectedChunks?: Array<{ id: string; kind: "table" | "column" | "document"; score: number; text: string }>;
}

export interface AuditRecord {
  id: string;
  timestamp: string;
  user: string;
  input: string;
  retrievedContext?: RetrievedContext;
  interpretation: Record<string, unknown>;
  plan: AiExecutionPlan;
  validationResult: { valid: boolean; message?: string };
  executionSteps: AuditExecutionStep[];
  executionResult: unknown;
  /** Agent orchestration steps, retries, and per-agent latency (Phase 4). */
  agentPipeline?: AgentPipelineAudit;
}

/** Data agent output — retrieval + confidence only; no financial numbers. */
export interface DataAgentOutput {
  relevantTables: RetrievedTableRef[];
  relevantColumns: RetrievedColumnRef[];
  relevantDocs: RetrievedDocRef[];
  selectedChunks?: RetrievedContext["selectedChunks"];
  /** Aggregate confidence in [0, 1] from retrieval scores. */
  confidence: number;
  latencyMs: number;
  cacheHit: boolean;
}

export interface PlanningAgentOutput {
  /** Structured execution plan — intent and steps only; numeric results come from execution engine. */
  plan: AiExecutionPlan;
  /** Non-numeric summary for audit (e.g. interpreted intent label). */
  intentSummary: string;
  latencyMs: number;
  cacheHit: boolean;
  source: "llm_intent" | "heuristic";
}

export interface ValidationDecision {
  code: string;
  detail: string;
  severity: "error" | "warn";
}

export interface ValidationAgentOutput {
  valid: boolean;
  message?: string;
  decisions: ValidationDecision[];
  /** Present when validation applied a safe structural fix (e.g. casing) without inventing data. */
  correctedPlan?: AiExecutionPlan;
  latencyMs: number;
}

export interface AgentRetryRecord {
  attempt: number;
  reason: string;
}

export interface AgentPipelineAudit {
  dataAgent?: DataAgentOutput;
  planningAgent?: PlanningAgentOutput;
  validationAgent?: ValidationAgentOutput;
  retries: AgentRetryRecord[];
  metrics: OrchestratorMetrics;
}

export interface OrchestratorMetrics {
  dataAgentMs: number;
  planningAgentMs: number;
  validationAgentMs: number;
  executionMs: number;
  totalMs: number;
}
