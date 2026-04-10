import type { RetrievedContext } from "../types";
import { getTable, listSchemas } from "../data/tableStore";

const DEFAULT_MODEL = process.env.AI_MODEL ?? "gpt-5.3";

export interface InterpretedIntent {
  intent: string;
  targetColumn?: string;
  forecastModel?: "moving_average" | "holt_winters" | "linear_regression" | "exponential_smoothing" | "arima";
}

export interface InterpretIntentOptions {
  retrievedContext?: RetrievedContext;
  schemaSummary?: string;
  /** Passed when replanning after validation failure (no numbers — validation error text only). */
  retryHint?: string;
}

export function buildSchemaSummary(tableNameHint?: string): string {
  if (tableNameHint) {
    const t = getTable(tableNameHint);
    if (t) {
      return JSON.stringify({
        tableName: t.name,
        schemaVersion: t.version,
        columns: t.schema.columns,
      });
    }
  }
  const schemas = listSchemas();
  return JSON.stringify(
    schemas.map((s) => ({
      tableName: s.tableName,
      columns: s.columns,
    }))
  );
}

function heuristicInterpret(message: string, retrieved?: RetrievedContext, retryHint?: string): InterpretedIntent {
  const lower = message.toLowerCase();
  const ragColumn = retrieved?.relevantColumns
    ?.slice()
    .sort((a, b) => b.score - a.score)[0]?.column;
  const colMatch = lower.match(/(revenue|amount|balance|payment|contribution)/);
  const forecastModel = lower.includes("holt")
    ? "holt_winters"
    : lower.includes("linear regression")
      ? "linear_regression"
      : lower.includes("exponential smoothing")
        ? "exponential_smoothing"
        : lower.includes("arima")
          ? "arima"
          : "moving_average";
  let retryPick: string | undefined;
  if (retryHint?.includes("Unknown column")) {
    const m = retryHint.match(/Unknown column "([^"]+)"/i);
    const bad = m?.[1]?.toLowerCase();
    retryPick = retrieved?.relevantColumns
      ?.filter((c) => c.column.toLowerCase() !== bad)
      .sort((a, b) => b.score - a.score)[0]?.column;
  }

  return {
    intent: lower.includes("forecast") ? "forecast" : lower.includes("average") ? "average" : "sum",
    targetColumn: retryPick ?? colMatch?.[1] ?? ragColumn,
    forecastModel,
  };
}

function buildSystemPrompt(): string {
  return [
    "You are a financial intent parser.",
    "Use ONLY the provided SCHEMA and CONTEXT. CONTEXT is retrieved documentation and schema hints — it may be incomplete.",
    "Do not compute numbers, totals, forecasts, or aggregates. Output intent and column names only.",
    "If targetColumn is uncertain, pick the best match from SCHEMA column names only.",
    "STRICT RULES:",
    "Output ONLY valid JSON.",
    "No explanations.",
    "No extra text.",
    "Respond with strict JSON only: { \"intent\": string, \"targetColumn\"?: string, \"forecastModel\"?: string }",
  ].join(" ");
}

async function requestStrictIntentJson(
  apiKey: string,
  content: string
): Promise<InterpretedIntent | null> {
  for (let attempt = 0; attempt < 3; attempt++) {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: DEFAULT_MODEL,
        temperature: 0,
        messages: [
          {
            role: "system",
            content: buildSystemPrompt(),
          },
          {
            role: "user",
            content,
          },
        ],
      }),
    });
    if (!response.ok) {
      return null;
    }
    const body = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const raw = body.choices?.[0]?.message?.content;
    if (!raw) {
      continue;
    }
    try {
      return JSON.parse(raw) as InterpretedIntent;
    } catch {
      continue;
    }
  }
  return null;
}

export async function interpretIntent(message: string, options?: InterpretIntentOptions): Promise<InterpretedIntent> {
  const apiKey = process.env.AI_MODEL_KEY ?? process.env.OPENAI_API_KEY;
  const schemaSummary = options?.schemaSummary ?? buildSchemaSummary();
  const retrieved = options?.retrievedContext;

  if (!apiKey) return heuristicInterpret(message, retrieved, options?.retryHint);

  const contextBlock = retrieved
    ? `CONTEXT:\n${JSON.stringify(
        {
          relevantTables: retrieved.relevantTables,
          relevantColumns: retrieved.relevantColumns,
          relevantDocs: retrieved.relevantDocs,
        },
        null,
        2
      )}\n`
    : "CONTEXT:\n{}\n";

  const retryBlock = options?.retryHint
    ? `VALIDATION_FEEDBACK (fix the plan; do not output numbers):\n${options.retryHint}\n\n`
    : "";

  const parsed = await requestStrictIntentJson(
    apiKey,
    `${retryBlock}${contextBlock}SCHEMA:\n${schemaSummary}\n\nUSER:\n${message}\n\nOUTPUT:\nstrict JSON only`
  );
  if (parsed) {
    return parsed;
  }
  return heuristicInterpret(message, retrieved, options?.retryHint);
}
