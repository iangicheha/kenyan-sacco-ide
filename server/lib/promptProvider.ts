import { env } from "../config/env.js";
import { getSupabase } from "./supabase.js";

export type PromptStage =
  | "intent_classifier"
  | "financial_planner"
  | "chat_assistant"
  | "file_analyst";

export interface ResolvedPrompt {
  stage: PromptStage;
  promptId: string;
  version: number;
  template: string;
}

const defaultPromptCatalog: Record<PromptStage, { promptId: string; version: number; template: string }> = {
  intent_classifier: {
    promptId: "intent_classifier",
    version: 1,
    template: `You are a Meridian Financial AI intent classifier for Kenyan SACCOs and financial institutions.

Analyze the user's request and classify it into a structured intent.

Return strict JSON with these keys:
- "intent": one of ["calculate_provisioning", "classify_loans", "generate_report", "analyze_portfolio", "validate_data", "compute_ratios", "forecast", "unknown"]
- "scope": one of ["single_cell", "column_range", "sheet_range", "unknown"]
- "regulation": "CBK" | "SASRA" | "IRA" | "RBA" | "CMA"
- "confidence": number 0.0 to 1.0

Use SASRA/CBK guidelines for Kenyan SACCOs. When uncertain, use the provided fallbackRegulator.`,
  },
  financial_planner: {
    promptId: "financial_planner",
    version: 1,
    template: `You are a Meridian Financial AI planning engine for Kenyan SACCOs and financial institutions.

Create a structured execution plan for spreadsheet operations.

CRITICAL RULES:
- Return ONLY formulas; NEVER compute numerical results yourself
- Each formula must be valid Excel/Google Sheets syntax
- Reference specific column names or cell ranges
- Include regulatory citations where applicable
- Plans must be executable deterministically by the engine

Return strict JSON with key "plan" containing an array of steps. Each step has:
- "step": number (1-indexed)
- "action": "read_column" | "write_formula" | "write_value"
- "target": string (column name, cell reference, or range)
- "formula": string (Excel formula, for write_formula actions)
- "value": string | number | boolean | null (for write_value actions)
- "reasoning": string (brief explanation of why this step)
- "regulationReference": string (optional, e.g., "CBK/PG/15 Section 4.2")

Use Kenyan SACCO regulatory guidelines (CBK, SASRA) for provisioning and compliance.`,
  },
  chat_assistant: {
    promptId: "chat_assistant",
    version: 1,
    template: `You are a Meridian Financial AI spreadsheet assistant for Kenyan SACCOs and financial institutions.

Provide clear, professional responses about spreadsheet data and financial operations.

GUIDELINES:
- Be concise and professional
- Reference specific columns, ranges, or cells when applicable
- Cite regulatory guidelines (CBK, SASRA, IRA, RBA, CMA) when relevant
- If file context is provided, base your answer on that data
- For calculations, explain the formula logic, not just the result

Return strict JSON: {"answer": "your response string"}`,
  },
  file_analyst: {
    promptId: "file_analyst",
    version: 1,
    template: `You are a Meridian Financial AI spreadsheet analyst for Kenyan SACCOs and financial institutions.

Analyze the provided spreadsheet data and provide structured insights.

GUIDELINES:
- Answer ONLY from the provided sheet context
- Reference specific column names, row ranges, or cell addresses
- Highlight anomalies, trends, or compliance issues where relevant
- If data is insufficient, clearly state what is missing
- For financial metrics, explain the calculation methodology
- Cite regulatory guidelines (CBK, SASRA) when applicable

Return strict JSON: {"answer": "your response string"}`,
  },
};

function renderTemplate(template: string, context?: Record<string, string | number | boolean | null | undefined>): string {
  if (!context) return template;
  return template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_m, key: string) => {
    const value = context[key];
    return value === undefined || value === null ? "" : String(value);
  });
}

export async function resolvePrompt(
  stage: PromptStage,
  context?: Record<string, string | number | boolean | null | undefined>
): Promise<ResolvedPrompt> {
  const fallback = defaultPromptCatalog[stage];
  if (!env.promptRegistryEnabled) {
    return {
      stage,
      promptId: fallback.promptId,
      version: fallback.version,
      template: renderTemplate(fallback.template, context),
    };
  }

  const supabase = getSupabase();
  if (!supabase) {
    return {
      stage,
      promptId: fallback.promptId,
      version: fallback.version,
      template: renderTemplate(fallback.template, context),
    };
  }

  const binding = await supabase
    .from("prompt_bindings")
    .select("active_prompt_version_id")
    .eq("stage", stage)
    .limit(1);
  if (binding.error || !binding.data || binding.data.length === 0) {
    return {
      stage,
      promptId: fallback.promptId,
      version: fallback.version,
      template: renderTemplate(fallback.template, context),
    };
  }

  const activeId = binding.data[0].active_prompt_version_id;
  const record = await supabase
    .from("prompt_registry")
    .select("prompt_id, version, template, status")
    .eq("id", activeId)
    .eq("status", "active")
    .limit(1);
  if (record.error || !record.data || record.data.length === 0) {
    return {
      stage,
      promptId: fallback.promptId,
      version: fallback.version,
      template: renderTemplate(fallback.template, context),
    };
  }

  const row = record.data[0];
  return {
    stage,
    promptId: row.prompt_id,
    version: row.version,
    template: renderTemplate(row.template, context),
  };
}
