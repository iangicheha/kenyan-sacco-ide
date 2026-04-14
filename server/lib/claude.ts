import Anthropic from "@anthropic-ai/sdk";
import { env, hasClaude } from "../config/env.js";

let client: Anthropic | null = null;

function getClient(): Anthropic {
  if (!client) {
    client = new Anthropic({ apiKey: env.anthropicApiKey });
  }
  return client;
}

function extractText(blocks: Anthropic.Messages.ContentBlock[]): string {
  return blocks
    .filter((b): b is Anthropic.Messages.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim();
}

function extractJson<T>(text: string): T {
  const first = text.indexOf("{");
  const last = text.lastIndexOf("}");
  if (first < 0 || last <= first) {
    throw new Error("Model response does not contain JSON.");
  }
  return JSON.parse(text.slice(first, last + 1)) as T;
}

export async function askClaudeJson<T>(input: {
  model: string;
  system: string;
  user: string;
}): Promise<T | null> {
  if (!hasClaude()) return null;

  const response = await getClient().messages.create({
    model: input.model,
    max_tokens: 1200,
    temperature: 0,
    system: input.system,
    messages: [{ role: "user", content: input.user }],
  });

  const text = extractText(response.content);
  return extractJson<T>(text);
}
