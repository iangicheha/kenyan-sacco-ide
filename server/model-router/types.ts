export type RouterMode = "auto" | "free" | "paid";
export type RouterTaskType = "classification" | "formula" | "planning" | "analysis" | "chat";
export type RouterComplexity = "low" | "medium" | "high";
export type RouterLatencyPriority = "low" | "medium" | "high";
export type RouterProviderName = "ollama" | "groq" | "openrouter" | "claude";

export interface RoutingRequirements {
  needs_json: boolean;
  needs_tools: boolean;
  min_context_tokens: number;
}

export interface ProviderStatus {
  name: RouterProviderName;
  available: boolean;
  latency_ms: number;
  error_rate: number;
  healthy: boolean;
}

export interface ModelCandidate {
  name: string;
  provider: RouterProviderName;
  available: boolean;
  context_window: number;
  supports_json: boolean;
  supports_tools: boolean;
  avg_latency_ms: number;
  cost_per_1k_tokens: number;
  quality_score: number;
}

export interface RoutingInput {
  user_query: string;
  mode: RouterMode;
  task_type: RouterTaskType;
  complexity: RouterComplexity;
  latency_priority: RouterLatencyPriority;
  requirements: RoutingRequirements;
  providers: ProviderStatus[];
  models: ModelCandidate[];
}

export interface RoutingOutput {
  selected_model: string;
  provider: RouterProviderName;
  fallback_model: string;
  fallback_provider: RouterProviderName;
  reason: string;
  routing_metadata: {
    mode: RouterMode;
    task_type: RouterTaskType;
    complexity: RouterComplexity;
    latency_priority: RouterLatencyPriority;
    score_breakdown: {
      quality: number;
      latency: number;
      cost: number;
      capability: number;
    };
  };
  execution_policy: {
    timeout_ms: number;
    retry_count: number;
  };
}
