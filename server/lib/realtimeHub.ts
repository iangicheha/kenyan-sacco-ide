import { EventEmitter } from "node:events";
import { env } from "../config/env.js";
import { appendOutboxEvent, type DomainEventPayload } from "../engine/outboxStore.js";

export interface RealtimeEvent {
  tenantId: string;
  sessionId: string;
  correlationId: string;
  stage: string;
  status: "ok" | "failed" | "fallback";
  createdAt: string;
  details?: Record<string, unknown>;
}

const hub = new EventEmitter();
hub.setMaxListeners(200);

/**
 * Publishes a realtime event to both the local hub and the event bus (if enabled).
 * This enables horizontal scaling - multiple server instances can receive events.
 */
export async function publishRealtimeEvent(event: RealtimeEvent): Promise<void> {
  // Emit to local hub (for SSE/WebSocket subscribers on this instance)
  hub.emit(`tenant:${event.tenantId}`, event);
  hub.emit(`tenant:${event.tenantId}:session:${event.sessionId}`, event);

  // Emit to event bus for cross-instance distribution and audit trail
  if (env.eventBusEnabled) {
    try {
      const domainEvent: DomainEventPayload = {
        eventType: `orchestrator.${event.stage}`,
        tenantId: event.tenantId,
        sessionId: event.sessionId,
        correlationId: event.correlationId,
        payload: {
          stage: event.stage,
          status: event.status,
          details: event.details ?? {},
          timestamp: event.createdAt,
        },
      };
      await appendOutboxEvent(domainEvent);
    } catch (error) {
      // Log but don't fail - the event was still emitted locally
      console.warn("[realtimeHub] Failed to append to outbox:", error);
    }
  }
}

export function subscribeTenantEvents(
  tenantId: string,
  sessionId: string | undefined,
  listener: (event: RealtimeEvent) => void
): () => void {
  const channels = [`tenant:${tenantId}`];
  if (sessionId) channels.push(`tenant:${tenantId}:session:${sessionId}`);
  for (const channel of channels) {
    hub.on(channel, listener);
  }
  return () => {
    for (const channel of channels) {
      hub.off(channel, listener);
    }
  };
}

/**
 * Subscribe to all events (for audit projectors and alerting)
 */
export function subscribeToAllEvents(listener: (event: RealtimeEvent) => void): () => void {
  hub.on("tenant:*", listener);
  return () => {
    hub.off("tenant:*", listener);
  };
}
