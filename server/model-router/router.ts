import type {
  ModelCandidate,
  ProviderStatus,
  RouterMode,
  RouterProviderName,
  RoutingInput,
  RoutingOutput,
} from "./types.js";

interface Scored {
  model: ModelCandidate;
  score: number;
  breakdown: {
    quality: number;
    latency: number;
    cost: number;
    capability: number;
  };
}

function providerMap(providers: ProviderStatus[]): Map<RouterProviderName, ProviderStatus> {
  return new Map(providers.map((p) => [p.name, p]));
}

function timeoutForPriority(priority: RoutingInput["latency_priority"]): number {
  if (priority === "high") return 1500;
  if (priority === "medium") return 3000;
  return 6000;
}

function providerRank(provider: RouterProviderName, mode: RouterMode): number {
  if (mode === "paid") {
    return provider === "claude" ? 4 : 1;
  }
  if (mode === "auto") {
    if (provider === "ollama") return 4;
    if (provider === "groq") return 3;
    if (provider === "openrouter") return 2;
    return 1;
  }
  // free mode
  return provider === "claude" ? 0 : 1;
}

function inferTaskCapability(model: ModelCandidate, task: RoutingInput["task_type"]): number {
  if (task === "classification") return model.avg_latency_ms <= 1200 ? 1 : 0.6;
  if (task === "formula") return model.supports_json ? 1 : 0.4;
  if (task === "planning") return model.quality_score >= 0.85 ? 1 : 0.5;
  if (task === "analysis") return model.context_window >= 12000 ? 1 : 0.5;
  return 0.8;
}

function filterCandidates(input: RoutingInput): ModelCandidate[] {
  const pMap = providerMap(input.providers);
  const afterHardFilter = input.models.filter((model) => {
    const p = pMap.get(model.provider);
    if (!p || !p.available || !p.healthy || p.error_rate > 0.2) return false;
    if (!model.available) return false;
    if (model.context_window < input.requirements.min_context_tokens) return false;
    if (input.requirements.needs_json && !model.supports_json) return false;
    if (input.requirements.needs_tools && !model.supports_tools) return false;
    return true;
  });

  if (input.mode === "free") {
    return afterHardFilter.filter((m) => m.provider !== "claude");
  }
  return afterHardFilter;
}

function filterDiagnostics(input: RoutingInput): Array<{
  model: string;
  provider: string;
  accepted: boolean;
  reason: string;
}> {
  const pMap = providerMap(input.providers);
  return input.models.map((model) => {
    const provider = pMap.get(model.provider);
    if (!provider || !provider.available) {
      return { model: model.name, provider: model.provider, accepted: false, reason: "provider_unavailable" };
    }
    if (!provider.healthy) {
      return { model: model.name, provider: model.provider, accepted: false, reason: "provider_unhealthy" };
    }
    if (provider.error_rate > 0.2) {
      return { model: model.name, provider: model.provider, accepted: false, reason: "provider_error_rate_high" };
    }
    if (!model.available) {
      return { model: model.name, provider: model.provider, accepted: false, reason: "model_unavailable" };
    }
    if (model.context_window < input.requirements.min_context_tokens) {
      return { model: model.name, provider: model.provider, accepted: false, reason: "context_too_small" };
    }
    if (input.requirements.needs_json && !model.supports_json) {
      return { model: model.name, provider: model.provider, accepted: false, reason: "json_not_supported" };
    }
    if (input.requirements.needs_tools && !model.supports_tools) {
      return { model: model.name, provider: model.provider, accepted: false, reason: "tools_not_supported" };
    }
    if (input.mode === "free" && model.provider === "claude") {
      return { model: model.name, provider: model.provider, accepted: false, reason: "mode_free_disallows_claude" };
    }
    return { model: model.name, provider: model.provider, accepted: true, reason: "eligible" };
  });
}

function normalizeHigherBetter(value: number, min: number, max: number): number {
  if (max === min) return 1;
  return (value - min) / (max - min);
}

function normalizeLowerBetter(value: number, min: number, max: number): number {
  if (max === min) return 1;
  return (max - value) / (max - min);
}

function scoreModel(input: RoutingInput, model: ModelCandidate, pool: ModelCandidate[]): Scored {
  const qualityValues = pool.map((m) => m.quality_score);
  const latencyValues = pool.map((m) => m.avg_latency_ms);
  const costValues = pool.map((m) => m.cost_per_1k_tokens);

  const qualityNorm = normalizeHigherBetter(
    model.quality_score,
    Math.min(...qualityValues),
    Math.max(...qualityValues)
  );
  const latencyNorm = normalizeLowerBetter(
    model.avg_latency_ms,
    Math.min(...latencyValues),
    Math.max(...latencyValues)
  );
  const costNorm = normalizeLowerBetter(
    model.cost_per_1k_tokens,
    Math.min(...costValues),
    Math.max(...costValues)
  );

  const quality = qualityNorm * 0.4;
  const latency = latencyNorm * 0.2;
  const cost = costNorm * 0.2;
  const capability = inferTaskCapability(model, input.task_type) * 0.2;
  return {
    model,
    score: quality + latency + cost + capability,
    breakdown: { quality, latency, cost, capability },
  };
}

function deterministicSort(input: RoutingInput, scored: Scored[]): Scored[] {
  return [...scored].sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (b.model.quality_score !== a.model.quality_score) {
      return b.model.quality_score - a.model.quality_score;
    }
    if (a.model.avg_latency_ms !== b.model.avg_latency_ms) {
      return a.model.avg_latency_ms - b.model.avg_latency_ms;
    }
    if (a.model.cost_per_1k_tokens !== b.model.cost_per_1k_tokens) {
      return a.model.cost_per_1k_tokens - b.model.cost_per_1k_tokens;
    }
    const pRank = providerRank(b.model.provider, input.mode) - providerRank(a.model.provider, input.mode);
    if (pRank !== 0) return pRank;
    return a.model.name.localeCompare(b.model.name);
  });
}

export function selectModelRoute(input: RoutingInput): RoutingOutput {
  const candidates = filterCandidates(input);
  if (candidates.length === 0) {
    throw new Error("No eligible models after router filtering.");
  }

  const scored = deterministicSort(
    input,
    candidates.map((m) => scoreModel(input, m, candidates))
  );

  const selected = scored[0];
  const fallback =
    scored.find((s) => s.model.provider !== selected.model.provider) ?? scored[Math.min(1, scored.length - 1)];

  return {
    selected_model: selected.model.name,
    provider: selected.model.provider,
    fallback_model: fallback.model.name,
    fallback_provider: fallback.model.provider,
    reason: `Selected by deterministic score for ${input.task_type} with mode=${input.mode}.`,
    routing_metadata: {
      mode: input.mode,
      task_type: input.task_type,
      complexity: input.complexity,
      latency_priority: input.latency_priority,
      score_breakdown: selected.breakdown,
    },
    execution_policy: {
      timeout_ms: timeoutForPriority(input.latency_priority),
      retry_count: 1,
    },
  };
}

export function explainModelRoute(input: RoutingInput): {
  route: RoutingOutput;
  diagnostics: ReturnType<typeof filterDiagnostics>;
  ranked: Array<{
    model: string;
    provider: string;
    total_score: number;
    breakdown: {
      quality: number;
      latency: number;
      cost: number;
      capability: number;
    };
  }>;
} {
  const diagnostics = filterDiagnostics(input);
  const candidates = filterCandidates(input);
  if (candidates.length === 0) {
    throw new Error("No eligible models after router filtering.");
  }

  const ranked = deterministicSort(
    input,
    candidates.map((m) => scoreModel(input, m, candidates))
  ).map((s) => ({
    model: s.model.name,
    provider: s.model.provider,
    total_score: s.score,
    breakdown: s.breakdown,
  }));

  return {
    route: selectModelRoute(input),
    diagnostics,
    ranked,
  };
}
