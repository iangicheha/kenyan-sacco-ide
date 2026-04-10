import { createHash } from "node:crypto";
import { financialEventBus } from "./eventBus";
import type { FinancialStreamEvent, FinancialStreamTopic } from "../types";

function buildEventId(topic: FinancialStreamTopic, payload: Record<string, unknown>, source: string): string {
  const key = JSON.stringify({ topic, payload, source, t: Date.now() });
  return createHash("sha256").update(key).digest("hex").slice(0, 24);
}

export function ingestEvent(
  topic: FinancialStreamTopic,
  payload: Record<string, unknown>,
  source = "api"
): FinancialStreamEvent {
  const event: FinancialStreamEvent = {
    id: buildEventId(topic, payload, source),
    topic,
    createdAt: new Date().toISOString(),
    source,
    payload,
  };
  financialEventBus.publish(event);
  return event;
}

export function ingestTransaction(payload: Record<string, unknown>, source?: string): FinancialStreamEvent {
  return ingestEvent("transactions", payload, source);
}

export function ingestMarketData(payload: Record<string, unknown>, source?: string): FinancialStreamEvent {
  return ingestEvent("market_data", payload, source);
}

export function ingestFinancialEvent(payload: Record<string, unknown>, source?: string): FinancialStreamEvent {
  return ingestEvent("financial_events", payload, source);
}
