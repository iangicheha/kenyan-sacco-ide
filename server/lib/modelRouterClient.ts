import { env, hasGroq, hasOpenRouter } from "../config/env.js";
import { buildInvocationMetrics, enforceModelGovernance, recordModelInvocation, type GovernanceContext } from "./modelGovernance.js";
import { askClaudeJson } from "./claude.js";
import { retryWithCircuitBreaker } from "./retryWithBackoff.js";
import type { RoutingOutput } from "../model-router/types.js";
import type { FailureReason } from "./circuitBreaker.js";

function parseJson<T>(text: string): T | null {
  try {
    return JSON.parse(text) as T;
  } catch {
    const first = text.indexOf("{");
    const last = text.lastIndexOf("}");
    if (first < 0 || last <= first) return null;
    try {
      return JSON.parse(text.slice(first, last + 1)) as T;
    } catch {
      return null;
    }
  }
}

async function postJson(url: string, init: RequestInit, timeoutMs: number): Promise<unknown> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...init, signal: controller.signal });
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

async function askOllamaJson<T>(model: string, system: string, user: string, timeoutMs: number): Promise<T | null> {
  const prompt = `${system}\n\nReturn strict JSON only.\n\n${user}`;
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (env.ollamaApiKey) {
    headers.Authorization = `Bearer ${env.ollamaApiKey}`;
  }
  const data = (await postJson(
    `${env.ollamaBaseUrl}/api/generate`,
    {
      method: "POST",
      headers,
      body: JSON.stringify({
        model,
        prompt,
        stream: false,
        format: "json",
      }),
    },
    timeoutMs
  )) as { response?: string } | null;
  if (!data?.response) return null;
  return parseJson<T>(data.response);
}

async function askOpenAICompatJson<T>(input: {
  baseUrl: string;
  apiKey: string;
  model: string;
  system: string;
  user: string;
  timeoutMs: number;
}): Promise<T | null> {
  const data = (await postJson(
    `${input.baseUrl}/chat/completions`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${input.apiKey}`,
      },
      body: JSON.stringify({
        model: input.model,
        temperature: 0,
        messages: [
          { role: "system", content: `${input.system} Return strict JSON only.` },
          { role: "user", content: input.user },
        ],
      }),
    },
    input.timeoutMs
  )) as { choices?: Array<{ message?: { content?: string } }> } | null;

  const content = data?.choices?.[0]?.message?.content;
  if (!content) return null;
  return parseJson<T>(content);
}

export async function askRoutedJson<T>(input: {
  route: RoutingOutput;
  system: string;
  user: string;
  operationName?: string;
  governance?: GovernanceContext;
}): Promise<{ data: T | null; failureReason?: FailureReason; attempts?: number }> {
  const timeoutMs = input.route.execution_policy.timeout_ms;
  const operationName = input.operationName ?? `router:${input.route.provider}:${input.route.selected_model}`;
  const requestStartedAt = Date.now();

  const attempt = async (provider: string, model: string): Promise<T | null> => {
    if (provider === "claude") {
      return askClaudeJson<T>({ model, system: input.system, user: input.user }).catch(() => null);
    }
    if (provider === "ollama") {
      return askOllamaJson<T>(model, input.system, input.user, timeoutMs);
    }
    if (provider === "groq" && hasGroq()) {
      return askOpenAICompatJson<T>({
        baseUrl: "https://api.groq.com/openai/v1",
        apiKey: env.groqApiKey,
        model,
        system: input.system,
        user: input.user,
        timeoutMs,
      });
    }
    if (provider === "openrouter" && hasOpenRouter()) {
      return askOpenAICompatJson<T>({
        baseUrl: env.openRouterBaseUrl,
        apiKey: env.openRouterApiKey,
        model,
        system: input.system,
        user: input.user,
        timeoutMs,
      });
    }
    return null;
  };

  await enforceModelGovernance({
    context: input.governance,
    provider: input.route.provider,
    model: input.route.selected_model,
    systemPrompt: input.system,
    userPrompt: input.user,
  });

  const primaryResult = await retryWithCircuitBreaker(
    () => attempt(input.route.provider, input.route.selected_model).then((result) => {
      if (result === null) throw new Error("Provider returned null");
      return result;
    }),
    input.route.provider,
    input.route.selected_model,
    { operationName }
  );

  if (primaryResult.success && primaryResult.data) {
    await recordModelInvocation({
      context: input.governance,
      provider: input.route.provider,
      model: input.route.selected_model,
      metrics: buildInvocationMetrics({
        systemPrompt: input.system,
        userPrompt: input.user,
        output: primaryResult.data,
        latencyMs: Date.now() - requestStartedAt,
        status: "success",
      }),
    });
    return { data: primaryResult.data, attempts: primaryResult.attempts };
  }

  const fallbackResult = await retryWithCircuitBreaker(
    () => attempt(input.route.fallback_provider, input.route.fallback_model).then((result) => {
      if (result === null) throw new Error("Fallback provider returned null");
      return result;
    }),
    input.route.fallback_provider,
    input.route.fallback_model,
    { operationName: `${operationName}:fallback` }
  );

  if (fallbackResult.success && fallbackResult.data) {
    await recordModelInvocation({
      context: input.governance,
      provider: input.route.fallback_provider,
      model: input.route.fallback_model,
      metrics: buildInvocationMetrics({
        systemPrompt: input.system,
        userPrompt: input.user,
        output: fallbackResult.data,
        latencyMs: Date.now() - requestStartedAt,
        status: "success",
      }),
    });
    return {
      data: fallbackResult.data,
      attempts: primaryResult.attempts + fallbackResult.attempts,
      failureReason: "fallback_used",
    };
  }

  const terminalFailureReason = fallbackResult.success ? undefined : fallbackResult.failureReason;
  await recordModelInvocation({
    context: input.governance,
    provider: input.route.fallback_provider,
    model: input.route.fallback_model,
    metrics: buildInvocationMetrics({
      systemPrompt: input.system,
      userPrompt: input.user,
      output: null,
      latencyMs: Date.now() - requestStartedAt,
      status: terminalFailureReason === "timeout" ? "timeout" : "failed",
      errorMessage: terminalFailureReason,
    }),
  });

  return {
    data: null,
    failureReason: terminalFailureReason,
    attempts: primaryResult.attempts + fallbackResult.attempts,
  };
}
