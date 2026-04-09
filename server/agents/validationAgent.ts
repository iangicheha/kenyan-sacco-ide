import { validatePlan } from "../ai/validator";
import type { AiExecutionPlan, PlanStep, ValidationAgentOutput, ValidationDecision } from "../types";

const ALLOW_EXTERNAL = process.env.ALLOW_EXTERNAL_FETCH === "true";

function collectSteps(steps: PlanStep[]): PlanStep[] {
  const out: PlanStep[] = [];
  for (const s of steps) {
    out.push(s);
    if (s.action === "batch_execute" && s.steps) {
      out.push(...collectSteps(s.steps));
    }
  }
  return out;
}

function unsafeStepDecisions(plan: AiExecutionPlan): ValidationDecision[] {
  const decisions: ValidationDecision[] = [];
  const all = collectSteps(plan.steps);
  for (const step of all) {
    if (step.action === "fetch_external_rate") {
      decisions.push({
        code: "external_fetch",
        detail: "fetch_external_rate is blocked unless ALLOW_EXTERNAL_FETCH=true",
        severity: "error",
      });
    }
  }
  return decisions;
}

/**
 * Validates plan shape, schema binding, and safety. Does not execute.
 * Agents must not compute financial results — this only checks structure and references.
 */
export function validate(plan: AiExecutionPlan): ValidationAgentOutput {
  const started = Date.now();
  const decisions: ValidationDecision[] = [];

  if (!ALLOW_EXTERNAL) {
    decisions.push(...unsafeStepDecisions(plan));
    const blocked = decisions.filter((d) => d.severity === "error");
    if (blocked.length > 0) {
      return {
        valid: false,
        message: blocked.map((d) => d.detail).join("; "),
        decisions,
        latencyMs: Date.now() - started,
      };
    }
  }

  try {
    validatePlan(plan);
    return {
      valid: true,
      decisions,
      latencyMs: Date.now() - started,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Validation failed";
    decisions.push({
      code: "validation_error",
      detail: msg,
      severity: "error",
    });
    return {
      valid: false,
      message: msg,
      decisions,
      latencyMs: Date.now() - started,
    };
  }
}
