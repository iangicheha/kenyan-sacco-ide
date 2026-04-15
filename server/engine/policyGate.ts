import type { IntentResult, Regulator } from "../types.js";

export interface PolicyInput {
  intent: IntentResult;
  regulator: Regulator;
}

export interface PolicyDecision {
  allowed: boolean;
  risk: "low" | "medium" | "high";
  reason: string;
  requiresApproval: boolean;
}

const HIGH_RISK_INTENTS = new Set(["calculate_provisioning", "generate_report", "validate_data"]);

export function evaluatePolicyGate(input: PolicyInput): PolicyDecision {
  if (input.intent.intent === "unknown") {
    return {
      allowed: false,
      risk: "low",
      reason: "Unknown intent cannot proceed to operational planning.",
      requiresApproval: false,
    };
  }

  const risk = HIGH_RISK_INTENTS.has(input.intent.intent) ? "high" : "medium";
  return {
    allowed: true,
    risk,
    reason:
      risk === "high"
        ? `High-risk intent under ${input.regulator} requires review approval.`
        : `Operational intent allowed under ${input.regulator} with standard review.`,
    requiresApproval: true,
  };
}
