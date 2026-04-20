import { env } from "../config/env.js";
import { getSupabase } from "../lib/supabase.js";

export interface DomainEventPayload {
  eventType: string;
  tenantId: string;
  sessionId: string;
  correlationId: string;
  payload: Record<string, unknown>;
}

let natsClient: { publish: (subject: string, payload: Uint8Array) => void; closed: () => Promise<void> } | null = null;

async function getNatsClient(): Promise<typeof natsClient> {
  if (!env.natsUrl) return null;
  if (natsClient) return natsClient;
  try {
    const module = (await import("nats")) as unknown as {
      connect: (input: { servers: string }) => Promise<{ publish: (subject: string, payload: Uint8Array) => void; closed: () => Promise<void> }>;
      StringCodec: () => { encode: (value: string) => Uint8Array };
    };
    natsClient = await module.connect({ servers: env.natsUrl });
    return natsClient;
  } catch {
    return null;
  }
}

export async function appendOutboxEvent(event: DomainEventPayload): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) return;
  await supabase.from("outbox_events").insert({
    event_type: event.eventType,
    tenant_id: event.tenantId,
    session_id: event.sessionId,
    correlation_id: event.correlationId,
    payload: event.payload,
    status: "pending",
  });
}

export async function dispatchPendingOutboxEvents(): Promise<number> {
  if (!env.eventBusEnabled) return 0;
  const supabase = getSupabase();
  if (!supabase) return 0;
  const nats = await getNatsClient();
  const codec = await (async () => {
    try {
      const module = (await import("nats")) as unknown as { StringCodec: () => { encode: (value: string) => Uint8Array } };
      return module.StringCodec();
    } catch {
      return null;
    }
  })();
  const pending = await supabase
    .from("outbox_events")
    .select("*")
    .eq("status", "pending")
    .order("created_at", { ascending: true })
    .limit(100);
  if (pending.error || !pending.data || pending.data.length === 0) return 0;

  let delivered = 0;
  for (const event of pending.data) {
    let deliveredToBus = false;
    if (nats && codec) {
      try {
        nats.publish(event.event_type, codec.encode(JSON.stringify(event.payload ?? {})));
        deliveredToBus = true;
      } catch {
        deliveredToBus = false;
      }
    }
    const update = await supabase
      .from("outbox_events")
      .update({
        status: deliveredToBus ? "delivered" : "failed",
        delivered_at: deliveredToBus ? new Date().toISOString() : null,
      })
      .eq("id", event.id);
    if (!update.error && deliveredToBus) delivered += 1;
  }
  return delivered;
}

export async function closeOutboxDispatcher(): Promise<void> {
  if (!natsClient) return;
  const active = natsClient;
  natsClient = null;
  await active.closed().catch(() => undefined);
}
