import { pushAlert } from "../alerts/notifier";
import { incrementAnomalyCounter } from "../realtime/store";
import { triggerAnomalyWorkflow } from "./orchestration";
import type { FinancialStreamEvent } from "../types";

const AMOUNT_THRESHOLD = Number(process.env.ANOMALY_AMOUNT_THRESHOLD ?? 1_000_000);
const RISK_THRESHOLD = Number(process.env.ANOMALY_RISK_THRESHOLD ?? 0.9);

export async function evaluateAnomaly(event: FinancialStreamEvent): Promise<void> {
  if (event.topic !== "transactions") return;
  const amount = Number(event.payload.amount ?? 0);
  const riskScore = Number(event.payload.riskScore ?? 0);
  const isAnomaly =
    (Number.isFinite(amount) && amount >= AMOUNT_THRESHOLD) ||
    (Number.isFinite(riskScore) && riskScore >= RISK_THRESHOLD);
  if (!isAnomaly) return;
  incrementAnomalyCounter();
  pushAlert({
    level: "critical",
    title: "Transaction anomaly detected",
    message: "Threshold breach in transaction stream.",
    metadata: {
      eventId: event.id,
      amount,
      riskScore,
    },
  });
  await triggerAnomalyWorkflow(event);
}
