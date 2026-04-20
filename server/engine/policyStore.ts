import { getSupabase } from "../lib/supabase.js";
import { randomUUID } from "crypto";
import { ServiceUnavailableError } from "../lib/serviceUnavailableError.js";
import type { Regulator } from "../types.js";

export type PolicyRecord = {
  id: string;
  regulator: Regulator;
  version: string;
  rulesJson: Record<string, unknown>;
  effectiveFrom: string;
  effectiveTo?: string;
  isActive: boolean;
  createdAt: string;
};

export function validatePolicyStructure(rulesJson: unknown): rulesJson is Record<string, unknown> {
  if (!rulesJson || typeof rulesJson !== "object" || Array.isArray(rulesJson)) return false;
  const record = rulesJson as Record<string, unknown>;
  if ("highRiskIntents" in record) {
    if (!Array.isArray(record.highRiskIntents)) return false;
    if (!record.highRiskIntents.every((item) => typeof item === "string")) return false;
  }
  if ("requiresApproval" in record && typeof record.requiresApproval !== "boolean") return false;
  return true;
}

function normalizePolicyRecord(row: Record<string, unknown>): PolicyRecord | null {
  const rulesJson = (row.rules_json ?? row.rules ?? {}) as unknown;
  if (!validatePolicyStructure(rulesJson)) return null;
  return {
    id: String(row.id),
    regulator: row.regulator as Regulator,
    version: String(row.version),
    rulesJson,
    effectiveFrom: String(row.effective_from),
    effectiveTo: row.effective_to ? String(row.effective_to) : undefined,
    isActive: row.is_active === undefined ? true : Boolean(row.is_active),
    createdAt: row.created_at ? String(row.created_at) : new Date().toISOString(),
  };
}

export async function getActivePolicy(regulator: Regulator, atIso = new Date().toISOString()): Promise<PolicyRecord | null> {
  const supabase = getSupabase();
  if (!supabase) {
    throw new ServiceUnavailableError("Failed to fetch active policy.", {
      store: "policies",
      reason: "supabase_unavailable",
    });
  }

  const { data, error } = await supabase
    .from("policies")
    .select("*")
    .eq("regulator", regulator)
    .eq("is_active", true)
    .lte("effective_from", atIso)
    .or(`effective_to.is.null,effective_to.gte.${atIso}`)
    .order("effective_from", { ascending: false })
    .limit(1);

  if (!error && data && data.length > 0) {
    const normalized = normalizePolicyRecord(data[0] as Record<string, unknown>);
    if (normalized) return normalized;
  }

  // Backward-compatible read path for legacy table naming.
  const legacy = await supabase
    .from("policy_rules")
    .select("*")
    .eq("regulator", regulator)
    .lte("effective_from", atIso)
    .or(`effective_to.is.null,effective_to.gte.${atIso}`)
    .order("effective_from", { ascending: false })
    .limit(1);

  if (!legacy.error && legacy.data && legacy.data.length > 0) {
    const normalized = normalizePolicyRecord(legacy.data[0] as Record<string, unknown>);
    if (normalized) return normalized;
  }

  if (error) {
    throw new ServiceUnavailableError("Failed to fetch active policy.", {
      store: "policies",
      reason: "supabase_query_failed",
    });
  }

  return null;
}

export async function createPolicy(input: {
  regulator: Regulator;
  version: string;
  rulesJson: Record<string, unknown>;
  effectiveFrom: string;
  effectiveTo?: string;
  isActive?: boolean;
}): Promise<PolicyRecord> {
  if (!validatePolicyStructure(input.rulesJson)) {
    throw new Error("Invalid policy rules_json structure.");
  }

  const record: PolicyRecord = {
    id: randomUUID(),
    regulator: input.regulator,
    version: input.version,
    rulesJson: input.rulesJson,
    effectiveFrom: input.effectiveFrom,
    effectiveTo: input.effectiveTo,
    isActive: input.isActive ?? true,
    createdAt: new Date().toISOString(),
  };

  const supabase = getSupabase();
  if (!supabase) {
    throw new ServiceUnavailableError("Failed to create policy.", {
      store: "policies",
      reason: "supabase_unavailable",
    });
  }

  const insert = await supabase
    .from("policies")
    .insert({
      id: record.id,
      regulator: record.regulator,
      version: record.version,
      rules_json: record.rulesJson,
      effective_from: record.effectiveFrom,
      effective_to: record.effectiveTo ?? null,
      is_active: record.isActive,
      created_at: record.createdAt,
    })
    .select("*")
    .limit(1);

  if (!insert.error && insert.data && insert.data.length > 0) {
    const normalized = normalizePolicyRecord(insert.data[0] as Record<string, unknown>);
    if (normalized) return normalized;
  }

  // Backward-compatible write path if policies table isn't available.
  const legacyInsert = await supabase
    .from("policy_rules")
    .insert({
      id: record.id,
      regulator: record.regulator,
      version: record.version,
      rules: record.rulesJson,
      effective_from: record.effectiveFrom,
      effective_to: record.effectiveTo ?? null,
      created_at: record.createdAt,
    })
    .select("*")
    .limit(1);

  if (!legacyInsert.error && legacyInsert.data && legacyInsert.data.length > 0) {
    const normalized = normalizePolicyRecord(legacyInsert.data[0] as Record<string, unknown>);
    if (normalized) return normalized;
  }

  throw new ServiceUnavailableError("Failed to create policy.", {
    store: "policies",
    reason: "supabase_insert_failed",
  });
}

export async function listPolicyHistory(regulator: Regulator): Promise<PolicyRecord[]> {
  const supabase = getSupabase();
  if (!supabase) {
    throw new ServiceUnavailableError("Failed to list policy history.", {
      store: "policies",
      reason: "supabase_unavailable",
    });
  }

  const primary = await supabase.from("policies").select("*").eq("regulator", regulator).order("effective_from", { ascending: false });
  if (!primary.error && primary.data) {
    const normalized = primary.data
      .map((row) => normalizePolicyRecord(row as Record<string, unknown>))
      .filter((item): item is PolicyRecord => Boolean(item));
    if (normalized.length > 0) return normalized;
  }

  const legacy = await supabase.from("policy_rules").select("*").eq("regulator", regulator).order("effective_from", { ascending: false });
  if (!legacy.error && legacy.data) {
    return legacy.data
      .map((row) => normalizePolicyRecord(row as Record<string, unknown>))
      .filter((item): item is PolicyRecord => Boolean(item));
  }

  throw new ServiceUnavailableError("Failed to list policy history.", {
    store: "policies",
    reason: "supabase_query_failed",
  });
}

export async function activatePolicy(policyId: string): Promise<{ status: "ok" } | { status: "not_found" }> {
  const supabase = getSupabase();
  if (!supabase) {
    throw new ServiceUnavailableError("Failed to activate policy.", {
      store: "policies",
      reason: "supabase_unavailable",
    });
  }

  const found = await supabase.from("policies").select("*").eq("id", policyId).limit(1);
  if (!found.error && found.data && found.data.length > 0) {
    const policy = normalizePolicyRecord(found.data[0] as Record<string, unknown>);
    if (!policy) return { status: "not_found" };

    await supabase.from("policies").update({ is_active: false }).eq("regulator", policy.regulator);
    const activated = await supabase.from("policies").update({ is_active: true }).eq("id", policyId);
    if (!activated.error) return { status: "ok" };
  }

  // If only legacy table exists, activation isn't supported (no is_active).
  if (found.error) {
    throw new ServiceUnavailableError("Failed to activate policy.", {
      store: "policies",
      reason: "supabase_update_failed",
    });
  }

  return { status: "not_found" };
}
