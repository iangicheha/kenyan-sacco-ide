import { env, hasClaude, hasGroq, hasOpenRouter } from "../config/env.js";
import type {
  ModelCandidate,
  ProviderStatus,
  RouterLatencyPriority,
  RouterMode,
  RouterTaskType,
  RoutingInput,
} from "./types.js";

function defaultProviders(): ProviderStatus[] {
  return [
    { name: "ollama", available: true, latency_ms: 200, error_rate: 0.05, healthy: true },
    { name: "groq", available: hasGroq(), latency_ms: 120, error_rate: 0.08, healthy: hasGroq() },
    { name: "openrouter", available: hasOpenRouter(), latency_ms: 250, error_rate: 0.08, healthy: hasOpenRouter() },
    { name: "claude", available: hasClaude(), latency_ms: 280, error_rate: 0.04, healthy: hasClaude() },
  ];
}

function defaultModels(): ModelCandidate[] {
  return [
    {
      name: env.ollamaModel,
      provider: "ollama",
      available: true,
      context_window: 32000,
      supports_json: true,
      supports_tools: false,
      avg_latency_ms: 240,
      cost_per_1k_tokens: 0.0001,
      quality_score: 0.9,
    },
    {
      name: env.ollamaFallbackModel,
      provider: "ollama",
      available: true,
      context_window: 32000,
      supports_json: true,
      supports_tools: false,
      avg_latency_ms: 300,
      cost_per_1k_tokens: 0.0002,
      quality_score: 0.86,
    },
    {
      name: env.ollamaFastModel,
      provider: "ollama",
      available: true,
      context_window: 16000,
      supports_json: true,
      supports_tools: false,
      avg_latency_ms: 120,
      cost_per_1k_tokens: 0.00005,
      quality_score: 0.8,
    },
    {
      name: "llama3-70b",
      provider: "groq",
      available: true,
      context_window: 8000,
      supports_json: true,
      supports_tools: false,
      avg_latency_ms: 150,
      cost_per_1k_tokens: 0.0005,
      quality_score: 0.84,
    },
    {
      name: "deepseek-chat",
      provider: "openrouter",
      available: true,
      context_window: 64000,
      supports_json: true,
      supports_tools: false,
      avg_latency_ms: 330,
      cost_per_1k_tokens: 0.001,
      quality_score: 0.82,
    },
    {
      name: env.intentModel,
      provider: "claude",
      available: hasClaude(),
      context_window: 200000,
      supports_json: true,
      supports_tools: true,
      avg_latency_ms: 320,
      cost_per_1k_tokens: 0.003,
      quality_score: 0.9,
    },
    {
      name: env.plannerModel,
      provider: "claude",
      available: hasClaude(),
      context_window: 200000,
      supports_json: true,
      supports_tools: true,
      avg_latency_ms: 450,
      cost_per_1k_tokens: 0.015,
      quality_score: 0.95,
    },
  ];
}

function inferComplexity(text: string): "low" | "medium" | "high" {
  const l = text.toLowerCase();
  if (l.includes("regulatory") || l.includes("multi-step") || l.length > 180) return "high";
  if (l.length > 90) return "medium";
  return "low";
}

export function buildRoutingInput(input: {
  userQuery: string;
  taskType: RouterTaskType;
  mode?: RouterMode;
  latencyPriority?: RouterLatencyPriority;
}): RoutingInput {
  return {
    user_query: input.userQuery,
    mode: input.mode ?? "auto",
    task_type: input.taskType,
    complexity: inferComplexity(input.userQuery),
    latency_priority: input.latencyPriority ?? "medium",
    requirements: {
      needs_json: true,
      needs_tools: false,
      min_context_tokens: input.taskType === "analysis" ? 12000 : 4000,
    },
    providers: defaultProviders(),
    models: defaultModels(),
  };
}
