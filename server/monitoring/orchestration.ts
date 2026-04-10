import { parseGoal } from "../autonomy/goalAgent";
import { runGoalPipeline } from "../autonomy/runGoalPipeline";
import { pushAlert } from "../alerts/notifier";
import { recordAudit } from "../audit/auditLogger";
import { buildGoalReport } from "../reporting/reportGenerator";
import type { FinancialStreamEvent } from "../types";

const TRIGGER_COOLDOWN_MS = Math.max(1000, Number(process.env.MONITORING_COOLDOWN_MS ?? 30_000));
let lastTriggerTs = 0;

export async function triggerAnomalyWorkflow(event: FinancialStreamEvent): Promise<void> {
  const now = Date.now();
  if (now - lastTriggerTs < TRIGGER_COOLDOWN_MS) return;
  lastTriggerTs = now;
  const goal = `Investigate anomaly from realtime stream (${event.id})`;
  const objective = parseGoal(goal);
  try {
    const run = await runGoalPipeline({ goal });
    const primary = run.strategies[0];
    const baseline = run.scenarios.find((s) => s.id === "baseline") ?? run.scenarios[0];
    const report = buildGoalReport({
      goalText: goal,
      objective,
      strategies: run.strategies,
      scenarios: run.scenarios,
    });
    recordAudit({
      user: "system:monitoring",
      input: goal,
      interpretation: {
        kind: "realtime_anomaly_trigger",
        eventId: event.id,
        topic: event.topic,
      },
      retrievedContext: run.retrievedContext,
      plan: primary.plan,
      validationResult: { valid: true },
      executionSteps:
        baseline?.execution.steps.map((s) => ({ action: s.step.action, output: s.output })) ?? [],
      executionResult: { report, baseline: baseline?.execution.result ?? null },
      agentPipeline: {
        retries: [],
        metrics: {
          dataAgentMs: run.dataAgent.latencyMs,
          planningAgentMs: primary.planning.latencyMs,
          validationAgentMs: primary.validation.latencyMs,
          executionMs: run.scenarios.reduce((acc, s) => acc + s.executionMs, 0),
          totalMs: run.audit.performance.totalMs,
        },
      },
    });
    pushAlert({
      level: "critical",
      title: "Anomaly workflow triggered",
      message: "Goal agent, simulation engine, and report generator completed.",
      metadata: {
        eventId: event.id,
        scenarios: run.scenarios.length,
        reportSummary: report.summary,
      },
    });
  } catch (error) {
    pushAlert({
      level: "warn",
      title: "Anomaly workflow failed",
      message: error instanceof Error ? error.message : "Unknown monitoring error",
      metadata: {
        eventId: event.id,
      },
    });
  }
}
