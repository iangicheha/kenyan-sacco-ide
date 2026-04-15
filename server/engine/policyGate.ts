import type { IntentResult, Regulator } from "../types.js";
import { getActivePolicy } from "./policyStore.js";

export interface PolicyInput {
  intent: IntentResult;
  regulator: Regulator;
}

export interface PolicyDecision {
  allowed: boolean;
  risk: "low" | "medium" | "high";
  reason: string;
  requiresApproval: boolean;
  policyVersion?: string;
  policyId?: string;
}

const HIGH_RISK_INTENTS = new Set(["calculate_provisioning", "generate_report", "validate_data"]);

export async function evaluatePolicyGate(input: PolicyInput): Promise<PolicyDecision> {
  if (input.intent.intent === "unknown") {
    return {
      allowed: false,
      risk: "low",
      reason: "Unknown intent cannot proceed to operational planning.",
      requiresApproval: false,
    };
  }

  const activePolicy = await getActivePolicy(input.regulator);
  if (activePolicy) {
    const highRiskIntents = new Set<string>(
      Array.isArray(activePolicy.rules?.highRiskIntents) ? (activePolicy.rules?.highRiskIntents as string[]) : []
    );
    const risk = highRiskIntents.has(input.intent.intent) ? "high" : "medium";
    const requiresApproval =
      typeof activePolicy.rules?.requiresApproval === "boolean" ? Boolean(activePolicy.rules.requiresApproval) : true;
    return {
      allowed: true,
      risk,
      reason: `Policy ${activePolicy.version} (${input.regulator}) evaluated successfully.`,
      requiresApproval,
      policyVersion: activePolicy.version,
      policyId: activePolicy.id,
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
    policyVersion: "static-fallback",
  };
}
