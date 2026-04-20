import { askRoutedJson } from "../lib/modelRouterClient.js";
import { resolvePrompt } from "../lib/promptProvider.js";
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

export async function classifyIntent(
  input: string,
  fallbackRegulator: Regulator,
  context?: { tenantId?: string; sessionId?: string; correlationId?: string; role?: "read-only" | "analyst" | "reviewer" | "admin" }
): Promise<IntentResult & { failureReason?: string; attempts?: number }> {
  const route = selectModelRoute(
    buildRoutingInput({
      userQuery: input,
      taskType: "classification",
      mode: "auto",
      latencyPriority: "high",
    })
  );

  const prompt = await resolvePrompt("intent_classifier", { fallbackRegulator });
  const llmResult = await askRoutedJson<IntentResult>({
    route,
    system: prompt.template,
    user: `Classify this request: "${input}". Use regulation "${fallbackRegulator}" when uncertain.`,
    operationName: "intent_classifier",
    governance: context
      ? {
          tenantId: context.tenantId ?? "default",
          sessionId: context.sessionId ?? "unknown",
          correlationId: context.correlationId ?? "unknown",
          role: context.role ?? "analyst",
          actionType: "classification",
          promptId: prompt.promptId,
          promptVersion: prompt.version,
        }
      : undefined,
  });
  const parsed = intentSchema.safeParse(llmResult.data);
  if (parsed.success) {
    return {
      intent: parsed.data.intent,
      scope: parsed.data.scope,
      regulation: parsed.data.regulation,
      confidence: parsed.data.confidence,
      failureReason: llmResult.failureReason,
      attempts: llmResult.attempts,
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
