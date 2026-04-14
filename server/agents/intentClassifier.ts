import { askRoutedJson } from "../lib/modelRouterClient.js";
import { buildRoutingInput } from "../model-router/catalog.js";
import { selectModelRoute } from "../model-router/router.js";
import type { IntentResult, Regulator } from "../types.js";

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
    system:
      "You are a financial spreadsheet intent classifier. Return only strict JSON with keys: intent, scope, regulation, confidence.",
    user: `Classify this user request: "${input}". Use regulation "${fallbackRegulator}" when uncertain.`,
  });
  if (llmResult?.intent && typeof llmResult.confidence === "number") {
    return {
      intent: llmResult.intent,
      scope: llmResult.scope ?? "unknown",
      regulation: llmResult.regulation ?? fallbackRegulator,
      confidence: llmResult.confidence,
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
