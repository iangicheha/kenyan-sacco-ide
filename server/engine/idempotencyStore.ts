import { env } from "../config/env.js";
import { getSupabase } from "../lib/supabase.js";

type IdempotentValue = {
  statusCode: number;
  body: unknown;
  createdAt: string;
};

const idempotencyStore = new Map<string, IdempotentValue>();

function buildKey(scope: string, key: string): string {
  return `${scope}:${key}`;
}

function isExpired(createdAt: string): boolean {
  const createdMs = Date.parse(createdAt);
  if (!Number.isFinite(createdMs)) return true;
  return Date.now() - createdMs > env.idempotencyTtlSeconds * 1000;
}

function getExpiryIsoThreshold(): string {
  return new Date(Date.now() - env.idempotencyTtlSeconds * 1000).toISOString();
}

export async function getIdempotentResponse(scope: string, key: string): Promise<IdempotentValue | null> {
  const supabase = getSupabase();
  if (supabase) {
    const { data, error } = await supabase
      .from("idempotency_records")
      .select("*")
      .eq("scope", scope)
      .eq("idempotency_key", key)
      .single();

    if (!error && data) {
      const record = {
        statusCode: data.status_code,
        body: data.response_body,
        createdAt: data.created_at,
      };
      if (isExpired(record.createdAt)) {
        await supabase.from("idempotency_records").delete().eq("scope", scope).eq("idempotency_key", key);
        return null;
      }
      return record;
    }
  }

  const item = idempotencyStore.get(buildKey(scope, key));
  if (!item) return null;
  if (isExpired(item.createdAt)) {
    idempotencyStore.delete(buildKey(scope, key));
    return null;
  }
  if (!env.allowInMemoryFallback) return null;
  return item;
}

export async function saveIdempotentResponse(
  scope: string,
  key: string,
  value: Omit<IdempotentValue, "createdAt">
): Promise<void> {
  const record = {
    ...value,
    createdAt: new Date().toISOString(),
  };

  const supabase = getSupabase();
  if (supabase) {
    const { error } = await supabase.from("idempotency_records").upsert(
      {
        scope,
        idempotency_key: key,
        status_code: record.statusCode,
        response_body: record.body,
        created_at: record.createdAt,
      },
      {
        onConflict: "scope,idempotency_key",
      }
    );

    if (!error) return;
  }

  if (!env.allowInMemoryFallback) {
    throw new Error("Failed to persist idempotency record and in-memory fallback is disabled.");
  }

  idempotencyStore.set(buildKey(scope, key), record);
}

export async function cleanupExpiredIdempotencyRecords(): Promise<{ deleted: number; mode: "supabase" | "memory" | "none" }> {
  const supabase = getSupabase();
  if (supabase) {
    const thresholdIso = getExpiryIsoThreshold();
    const { data, error } = await supabase
      .from("idempotency_records")
      .delete()
      .lt("created_at", thresholdIso)
      .select("id");

    if (!error) {
      return { deleted: data?.length ?? 0, mode: "supabase" };
    }
  }

  if (!env.allowInMemoryFallback) {
    return { deleted: 0, mode: "none" };
  }

  let deleted = 0;
  for (const [key, value] of idempotencyStore.entries()) {
    if (isExpired(value.createdAt)) {
      idempotencyStore.delete(key);
      deleted += 1;
    }
  }
  return { deleted, mode: "memory" };
}
