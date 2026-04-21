import type { IntentResult, Regulator } from "../types.js";
import { getActivePolicy } from "./policyStore.js";

export interface PolicyInput {
  intent: IntentResult;
  regulator: Regulator;
  userContext?: {
    role: string;
    tenantId: string;
  };
}

export interface PolicyDecision {
  allowed: boolean;
  risk: "low" | "medium" | "high";
  reason: string;
  requiresApproval: boolean;
  policyVersion?: string;
  policyId?: string;
  matchedRuleId?: string;
}

/**
 * A simple expression evaluator for policy rules.
 * Supports basic logic: AND, OR, EQUALS, IN.
 */
function evaluateExpression(expression: any, context: any): boolean {
  if (typeof expression !== "object" || expression === null) return false;

  const { op, args } = expression;
  if (!op || !Array.isArray(args)) return false;

  switch (op) {
    case "AND":
      return args.every(arg => evaluateExpression(arg, context));
    case "OR":
      return args.some(arg => evaluateExpression(arg, context));
    case "EQUALS": {
      const [path, value] = args;
      return getPathValue(context, path) === value;
    }
    case "IN": {
      const [path, values] = args;
      const val = getPathValue(context, path);
      return Array.isArray(values) && values.includes(val);
    }
    default:
      return false;
  }
}

function getPathValue(obj: any, path: string): any {
  return path.split('.').reduce((acc, part) => acc && acc[part], obj);
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
  const context = {
    intent: input.intent.intent,
    confidence: input.intent.confidence,
    regulator: input.regulator,
    user: input.userContext ?? { role: "analyst", tenantId: "unknown" },
    time: { hour: new Date().getHours() }
  };

  if (activePolicy) {
    const rules = Array.isArray(activePolicy.rulesJson.rules) ? activePolicy.rulesJson.rules : [];
    
    // Check for explicit deny rules first
    for (const rule of rules) {
      if (rule.action === "deny" && evaluateExpression(rule.condition, context)) {
        return {
          allowed: false,
          risk: rule.risk || "high",
          reason: rule.reason || `Action denied by policy rule: ${rule.id}`,
          requiresApproval: true,
          policyVersion: activePolicy.version,
          policyId: activePolicy.id,
          matchedRuleId: rule.id
        };
      }
    }

    // Check for explicit allow rules
    for (const rule of rules) {
      if (rule.action === "allow" && evaluateExpression(rule.condition, context)) {
        return {
          allowed: true,
          risk: rule.risk || "medium",
          reason: rule.reason || `Action allowed by policy rule: ${rule.id}`,
          requiresApproval: rule.requiresApproval ?? true,
          policyVersion: activePolicy.version,
          policyId: activePolicy.id,
          matchedRuleId: rule.id
        };
      }
    }

    // Fallback within active policy
    const highRiskIntents = new Set<string>(
      Array.isArray(activePolicy.rulesJson.highRiskIntents) ? (activePolicy.rulesJson.highRiskIntents as string[]) : []
    );
    const risk = highRiskIntents.has(input.intent.intent) ? "high" : "medium";
    const requiresApproval =
      typeof activePolicy.rulesJson.requiresApproval === "boolean" ? Boolean(activePolicy.rulesJson.requiresApproval) : true;
    
    return {
      allowed: true,
      risk,
      reason: `Policy ${activePolicy.version} (${input.regulator}) evaluated successfully (default fallback).`,
      requiresApproval,
      policyVersion: activePolicy.version,
      policyId: activePolicy.id,
    };
  }

  // Hard-coded fallback if no policy exists
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
