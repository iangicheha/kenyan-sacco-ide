import { askRoutedJson } from "../lib/modelRouterClient.js";
import { buildRoutingInput } from "../model-router/catalog.js";
import { selectModelRoute } from "../model-router/router.js";
import { z } from "zod";
import type { IntentResult, Regulator } from "../types.js";

const intentSchema = z.object({
  intent: z.enum([
    "calculate_provisioning",
    "classify_loans",
    "generate_report",
    "analyze_portfolio",
    "validate_data",
    "compute_ratios",
    "forecast",
    "unknown",
  ]),
  scope: z.enum(["single_cell", "column_range", "sheet_range", "unknown"]),
  regulation: z.enum(["CBK", "SASRA", "IRA", "RBA", "CMA"]),
  confidence: z.number().min(0).max(1),
});

export async function classifyIntent(input: string, fallbackRegulator: Regulator): Promise<IntentResult> {
  const route = selectModelRoute(
    buildRoutingInput({
      userQuery: input,
      taskType: "classification",
      mode: "auto",
      latencyPriority: "high",
    })
  );

  const llmResult = await askRoutedJson<IntentResult>({
    route,
    system: `You are a Meridian Financial AI intent classifier for Kenyan SACCOs and financial institutions.

Analyze the user's request and classify it into a structured intent.

Return strict JSON with these keys:
- "intent": one of ["calculate_provisioning", "classify_loans", "generate_report", "analyze_portfolio", "validate_data", "compute_ratios", "forecast", "unknown"]
- "scope": one of ["single_cell", "column_range", "sheet_range", "unknown"]
- "regulation": "CBK" | "SASRA" | "IRA" | "RBA" | "CMA"
- "confidence": number 0.0 to 1.0

Use SASRA/CBK guidelines for Kenyan SACCOs. When uncertain, use the provided fallbackRegulator.`,
    user: `Classify this request: "${input}". Use regulation "${fallbackRegulator}" when uncertain.`,
  });
  const parsed = intentSchema.safeParse(llmResult);
  if (parsed.success) {
    return {
      intent: parsed.data.intent,
      scope: parsed.data.scope,
      regulation: parsed.data.regulation,
      confidence: parsed.data.confidence,
    };
  }

  const text = input.toLowerCase();

  if (text.includes("provision")) {
    return {
      intent: "calculate_provisioning",
      scope: "column_range",
      regulation: fallbackRegulator,
      confidence: 0.97,
    };
  }

  return {
    intent: "unknown",
    scope: "unknown",
    regulation: fallbackRegulator,
    confidence: 0.5,
  };
}
