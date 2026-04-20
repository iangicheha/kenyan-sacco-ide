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
      Array.isArray(activePolicy.rulesJson.highRiskIntents) ? (activePolicy.rulesJson.highRiskIntents as string[]) : []
    );
    const risk = highRiskIntents.has(input.intent.intent) ? "high" : "medium";
    const requiresApproval =
      typeof activePolicy.rulesJson.requiresApproval === "boolean" ? Boolean(activePolicy.rulesJson.requiresApproval) : true;
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
  if (risk === "high") {
    return {
      allowed: false,
      risk,
      reason: `No active policy found for ${input.regulator}; high-risk operations are blocked.`,
      requiresApproval: true,
    };
  }
  return {
    allowed: true,
    risk,
    reason: `No active policy found for ${input.regulator}; using conservative medium-risk default.`,
    requiresApproval: true,
  };
}
