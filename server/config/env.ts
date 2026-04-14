import dotenv from "dotenv";

dotenv.config();

export const env = {
  port: Number(process.env.PORT ?? 4100),
  anthropicApiKey: process.env.ANTHROPIC_API_KEY ?? "",
  intentModel: process.env.CLAUDE_INTENT_MODEL ?? "claude-3-5-haiku-latest",
  plannerModel: process.env.CLAUDE_PLANNER_MODEL ?? "claude-sonnet-4-5",
  ollamaBaseUrl: process.env.OLLAMA_BASE_URL ?? "http://localhost:11434",
  ollamaApiKey: process.env.OLLAMA_API_KEY ?? "",
  ollamaModel: process.env.OLLAMA_MODEL ?? "kimi-k2.5",
  ollamaFallbackModel: process.env.OLLAMA_FALLBACK_MODEL ?? "glm-5",
  ollamaFastModel: process.env.OLLAMA_FAST_MODEL ?? "gpt-oss20b",
  groqApiKey: process.env.GROQ_API_KEY ?? "",
  openRouterApiKey: process.env.OPENROUTER_API_KEY ?? "",
  openRouterBaseUrl: process.env.OPENROUTER_BASE_URL ?? "https://openrouter.ai/api/v1",
  supabaseUrl: process.env.SUPABASE_URL ?? "",
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
};

export function hasClaude(): boolean {
  return env.anthropicApiKey.length > 0;
}

export function hasSupabase(): boolean {
  return env.supabaseUrl.length > 0 && env.supabaseServiceRoleKey.length > 0;
}

export function hasGroq(): boolean {
  return env.groqApiKey.length > 0;
}

export function hasOpenRouter(): boolean {
  return env.openRouterApiKey.length > 0;
}
