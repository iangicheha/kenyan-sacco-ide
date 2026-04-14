import { env, hasGroq, hasOpenRouter } from "../config/env.js";
import { askClaudeJson } from "./claude.js";
import type { RoutingOutput } from "../model-router/types.js";

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
}): Promise<T | null> {
  const timeoutMs = input.route.execution_policy.timeout_ms;

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

  const primary = await attempt(input.route.provider, input.route.selected_model);
  if (primary) return primary;
  return attempt(input.route.fallback_provider, input.route.fallback_model);
}
