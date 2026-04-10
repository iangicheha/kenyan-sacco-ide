import { pushAlert } from "../alerts/notifier";
import type { FinancialStreamEvent } from "../types";

const EXPOSURE_WARN_THRESHOLD = Number(process.env.EXPOSURE_WARN_THRESHOLD ?? 5_000_000);
let latestExposure = 0;

export function evaluateRisk(event: FinancialStreamEvent): void {
  if (event.topic !== "financial_events") return;
  const exposure = Number(event.payload.exposure ?? event.payload.amount ?? 0);
  if (!Number.isFinite(exposure)) return;
  latestExposure = exposure;
  if (latestExposure < EXPOSURE_WARN_THRESHOLD) return;
  pushAlert({
    level: "warn",
    title: "Risk exposure threshold reached",
    message: "Portfolio exposure exceeded configured threshold.",
    metadata: {
      eventId: event.id,
      exposure: latestExposure,
    },
  });
}
