import { financialEventBus } from "./eventBus";
import { applyRealtimeEvent } from "../realtime/store";
import { evaluateAnomaly } from "../monitoring/anomalyAgent";
import { evaluateTrend } from "../monitoring/trendAgent";
import { evaluateRisk } from "../monitoring/riskAgent";
import { pushAlert } from "../alerts/notifier";
import type { FinancialStreamEvent } from "../types";

let started = false;

async function consumeEvent(event: FinancialStreamEvent): Promise<void> {
  applyRealtimeEvent(event);
  evaluateTrend(event);
  evaluateRisk(event);
  await evaluateAnomaly(event);
}

export function startStreamingConsumers(): void {
  if (started) return;
  started = true;
  financialEventBus.start();
  financialEventBus.subscribe("*", (event) => {
    void consumeEvent(event).catch((error) => {
      pushAlert({
        level: "warn",
        title: "Consumer error",
        message: error instanceof Error ? error.message : "Unknown consumer error",
        metadata: { eventId: event.id, topic: event.topic },
      });
    });
  });
}
