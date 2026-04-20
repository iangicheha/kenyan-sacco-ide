import { getSupabase } from "./supabase.js";

export interface GovernanceContext {
  tenantId: string;
  sessionId: string;
  correlationId: string;
  role: "read-only" | "analyst" | "reviewer" | "admin";
  actionType: string;
  promptId: string;
  promptVersion: number;
}

export interface InvocationMetrics {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  costUsd: number;
  latencyMs: number;
  status: "success" | "failed" | "timeout";
  errorMessage?: string;
}

const USD_PER_1K_TOKENS_DEFAULT = 0.0015;

function estimateTokens(text: string): number {
  // Approximate tokenization for governance checks.
  return Math.max(1, Math.ceil(text.length / 4));
}

export async function enforceModelGovernance(input: {
  context?: GovernanceContext;
  provider: string;
  model: string;
  systemPrompt: string;
  userPrompt: string;
}): Promise<void> {
  if (!input.context) return;
  const supabase = getSupabase();
  const estimatedInputTokens = estimateTokens(`${input.systemPrompt}\n${input.userPrompt}`);
  if (estimatedInputTokens > 16000) {
    throw new Error("TokenGuard denied request: estimated input exceeds maximum allowed tokens.");
  }

  if (!supabase) return;
  const [policyResult, budgetResult] = await Promise.all([
    supabase
      .from("role_model_policies")
      .select("allowed_models")
      .eq("role", input.context.role)
      .eq("action_type", input.context.actionType)
      .limit(1),
    supabase
      .from("tenant_model_budgets")
      .select("monthly_budget_usd, spent_usd")
      .eq("tenant_id", input.context.tenantId)
      .limit(1),
  ]);

  const allowedModels = policyResult.data?.[0]?.allowed_models as unknown;
  if (Array.isArray(allowedModels) && allowedModels.length > 0 && !allowedModels.includes(input.model)) {
    throw new Error(`PolicyGuard denied request: model "${input.model}" is not allowed for role/action.`);
  }

  const budget = budgetResult.data?.[0];
  if (budget && Number(budget.spent_usd ?? 0) >= Number(budget.monthly_budget_usd ?? 0)) {
    throw new Error("QuotaGuard denied request: tenant monthly model budget exhausted.");
  }
}

export async function recordModelInvocation(input: {
  context?: GovernanceContext;
  provider: string;
  model: string;
  metrics: InvocationMetrics;
}): Promise<void> {
  if (!input.context) return;
  const supabase = getSupabase();
  if (!supabase) return;

  const costUsd =
    input.metrics.costUsd > 0
      ? input.metrics.costUsd
      : Number(((input.metrics.totalTokens / 1000) * USD_PER_1K_TOKENS_DEFAULT).toFixed(6));

  const insert = await supabase.from("model_invocations").insert({
    tenant_id: input.context.tenantId,
    session_id: input.context.sessionId,
    correlation_id: input.context.correlationId,
    prompt_id: input.context.promptId,
    prompt_version: input.context.promptVersion,
    model_provider: input.provider,
    model_name: input.model,
    input_tokens: input.metrics.inputTokens,
    output_tokens: input.metrics.outputTokens,
    total_tokens: input.metrics.totalTokens,
    cost_usd: costUsd,
    latency_ms: input.metrics.latencyMs,
    status: input.metrics.status,
    error_message: input.metrics.errorMessage ?? null,
  });
  if (insert.error) return;

  const budget = await supabase
    .from("tenant_model_budgets")
    .select("spent_usd")
    .eq("tenant_id", input.context.tenantId)
    .limit(1);
  if (budget.error || !budget.data || budget.data.length === 0) return;

  const currentSpent = Number(budget.data[0].spent_usd ?? 0);
  await supabase
    .from("tenant_model_budgets")
    .update({ spent_usd: Number((currentSpent + costUsd).toFixed(6)) })
    .eq("tenant_id", input.context.tenantId);
}

export function buildInvocationMetrics(input: {
  systemPrompt: string;
  userPrompt: string;
  output: unknown;
  latencyMs: number;
  status: "success" | "failed" | "timeout";
  errorMessage?: string;
}): InvocationMetrics {
  const inputTokens = estimateTokens(`${input.systemPrompt}\n${input.userPrompt}`);
  const outputText = input.output ? JSON.stringify(input.output) : "";
  const outputTokens = estimateTokens(outputText);
  return {
    inputTokens,
    outputTokens,
    totalTokens: inputTokens + outputTokens,
    costUsd: 0,
    latencyMs: input.latencyMs,
    status: input.status,
    errorMessage: input.errorMessage,
  };
}
