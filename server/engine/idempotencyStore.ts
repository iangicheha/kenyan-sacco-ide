import { ServiceUnavailableError } from "../lib/serviceUnavailableError.js";
import { getSupabase } from "../lib/supabase.js";
import { env } from "../config/env.js";

type IdempotentValue = {
  statusCode: number;
  body: unknown;
  createdAt: string;
};

function isExpired(createdAt: string): boolean {
  const createdMs = Date.parse(createdAt);
  if (!Number.isFinite(createdMs)) return true;
  return Date.now() - createdMs > env.idempotencyTtlSeconds * 1000;
}

function getExpiryIsoThreshold(): string {
  const ttlMs = env.idempotencyTtlSeconds * 1000;
  const retentionMs = env.retentionDaysIdempotency * 24 * 60 * 60 * 1000;
  return new Date(Date.now() - Math.max(ttlMs, retentionMs)).toISOString();
}

export async function getIdempotentResponse(scope: string, key: string): Promise<IdempotentValue | null> {
  const supabase = getSupabase();
  if (!supabase) {
    throw new ServiceUnavailableError("Failed to check idempotency record.", {
      store: "idempotency_records",
      reason: "supabase_unavailable",
    });
  }

  const { data, error } = await supabase
    .from("idempotency_records")
    .select("*")
    .eq("scope", scope)
    .eq("idempotency_key", key)
    .single();

  if (error) {
    // Not found is expected for new requests
    if (error.code === "PGRST116") return null;
    throw new ServiceUnavailableError("Failed to check idempotency record.", {
      store: "idempotency_records",
      reason: "supabase_query_failed",
    });
  }

  if (!data) return null;

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
  if (!supabase) {
    throw new ServiceUnavailableError("Failed to persist idempotency record.", {
      store: "idempotency_records",
      reason: "supabase_unavailable",
    });
  }

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

  if (error) {
    throw new ServiceUnavailableError("Failed to persist idempotency record.", {
      store: "idempotency_records",
      reason: "supabase_upsert_failed",
    });
  }
}

export async function cleanupExpiredIdempotencyRecords(): Promise<{ deleted: number; mode: "supabase" | "none" }> {
  const supabase = getSupabase();
  if (!supabase) {
    throw new ServiceUnavailableError("Failed to cleanup idempotency records.", {
      store: "idempotency_records",
      reason: "supabase_unavailable",
    });
  }

  const thresholdIso = getExpiryIsoThreshold();
  const { data, error } = await supabase
    .from("idempotency_records")
    .delete()
    .lt("created_at", thresholdIso)
    .select("id");

  if (error) {
    throw new ServiceUnavailableError("Failed to cleanup idempotency records.", {
      store: "idempotency_records",
      reason: "supabase_delete_failed",
    });
  }

  return { deleted: data?.length ?? 0, mode: "supabase" };
}
