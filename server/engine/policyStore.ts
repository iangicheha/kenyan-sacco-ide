import { env } from "../config/env.js";
import { getSupabase } from "../lib/supabase.js";
import type { Regulator } from "../types.js";

export type PolicyRecord = {
  id: string;
  regulator: Regulator;
  version: string;
  rules: Record<string, unknown>;
  effectiveFrom: string;
  effectiveTo?: string;
};

const inMemoryPolicies: PolicyRecord[] = [];

export async function getActivePolicy(regulator: Regulator, atIso = new Date().toISOString()): Promise<PolicyRecord | null> {
  const supabase = getSupabase();
  if (supabase) {
    const { data, error } = await supabase
      .from("policy_rules")
      .select("*")
      .eq("regulator", regulator)
      .lte("effective_from", atIso)
      .or(`effective_to.is.null,effective_to.gte.${atIso}`)
      .order("effective_from", { ascending: false })
      .limit(1);

    if (!error && data && data.length > 0) {
      const row = data[0];
      return {
        id: row.id,
        regulator: row.regulator as Regulator,
        version: row.version,
        rules: (row.rules as Record<string, unknown>) ?? {},
        effectiveFrom: row.effective_from,
        effectiveTo: row.effective_to ?? undefined,
      };
    }
  }

  if (!env.allowInMemoryFallback) return null;
  const nowMs = Date.parse(atIso);
  const eligible = inMemoryPolicies
    .filter((item) => item.regulator === regulator)
    .filter((item) => Date.parse(item.effectiveFrom) <= nowMs)
    .filter((item) => !item.effectiveTo || Date.parse(item.effectiveTo) >= nowMs)
    .sort((a, b) => Date.parse(b.effectiveFrom) - Date.parse(a.effectiveFrom));
  return eligible[0] ?? null;
}
