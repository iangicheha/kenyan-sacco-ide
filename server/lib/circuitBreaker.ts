import { env } from "../config/env.js";

export type CircuitState = "closed" | "open" | "half_open";
export type FailureReason =
  | "timeout"
  | "network_error"
  | "http_error"
  | "parse_error"
  | "provider_error"
  | "circuit_open"
  | "fallback_used";

interface CircuitEntry {
  state: CircuitState;
  failureCount: number;
  lastFailureAt?: string;
  openedAt?: string;
  successCount: number;
}

const circuits = new Map<string, CircuitEntry>();

function buildKey(provider: string, model?: string): string {
  return model ? `${provider}:${model}` : provider;
}

function getEntry(key: string): CircuitEntry {
  const existing = circuits.get(key);
  if (existing) return existing;
  const fresh: CircuitEntry = {
    state: "closed",
    failureCount: 0,
    successCount: 0,
  };
  circuits.set(key, fresh);
  return fresh;
}

export function getCircuitState(provider: string, model?: string): {
  state: CircuitState;
  failureCount: number;
  reason?: string;
} {
  const entry = getEntry(buildKey(provider, model));
  const reason = entry.state === "open" ? "circuit_open" : undefined;
  return { state: entry.state, failureCount: entry.failureCount, reason };
}

export function recordSuccess(provider: string, model?: string): void {
  const entry = getEntry(buildKey(provider, model));
  if (entry.state === "half_open") {
    entry.successCount += 1;
    if (entry.successCount >= 2) {
      entry.state = "closed";
      entry.failureCount = 0;
      entry.openedAt = undefined;
      entry.successCount = 0;
    }
  } else if (entry.state === "closed") {
    entry.failureCount = Math.max(0, entry.failureCount - 1);
  }
}

export function recordFailure(provider: string, model: string | undefined, reason: FailureReason): void {
  const entry = getEntry(buildKey(provider, model));
  entry.failureCount += 1;
  entry.lastFailureAt = new Date().toISOString();

  if (entry.state === "closed" && entry.failureCount >= env.providerCircuitFailureThreshold) {
    entry.state = "open";
    entry.openedAt = new Date().toISOString();
  }
}

export function canAttemptRequest(provider: string, model?: string): {
  allowed: boolean;
  state: CircuitState;
  reason?: string;
} {
  const entry = getEntry(buildKey(provider, model));
  const now = Date.now();

  if (entry.state === "closed") {
    return { allowed: true, state: "closed" };
  }

  if (entry.state === "open" && entry.openedAt) {
    const openDuration = now - Date.parse(entry.openedAt);
    if (openDuration >= env.providerCircuitCooldownMs) {
      entry.state = "half_open";
      entry.successCount = 0;
      return { allowed: true, state: "half_open" };
    }
    return {
      allowed: false,
      state: "open",
      reason: `circuit_open_retry_after_${Math.ceil((env.providerCircuitCooldownMs - openDuration) / 1000)}s`,
    };
  }

  return { allowed: entry.state === "half_open", state: entry.state };
}

export function resetCircuit(provider: string, model?: string): void {
  const key = buildKey(provider, model);
  circuits.delete(key);
}

export function getAllCircuitStates(): Record<
  string,
  {
    state: CircuitState;
    failureCount: number;
    lastFailureAt?: string;
    openedAt?: string;
  }
> {
  const result: Record<string, { state: CircuitState; failureCount: number; lastFailureAt?: string; openedAt?: string }> = {};
  for (const [key, entry] of circuits.entries()) {
    result[key] = {
      state: entry.state,
      failureCount: entry.failureCount,
      lastFailureAt: entry.lastFailureAt,
      openedAt: entry.openedAt,
    };
  }
  return result;
}
