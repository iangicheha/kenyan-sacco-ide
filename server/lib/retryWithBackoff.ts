import { env } from "../config/env.js";
import type { FailureReason } from "./circuitBreaker.js";
import { canAttemptRequest, recordFailure, recordSuccess } from "./circuitBreaker.js";

export interface RetryConfig {
  maxAttempts?: number;
  baseDelayMs?: number;
  jitterMs?: number;
  operationName: string;
}

export type RetryResult<T> =
  | { success: true; data: T; attempts: number }
  | { success: false; error: string; attempts: number; failureReason: FailureReason };

function calculateJitter(jitterMs: number): number {
  return Math.floor(Math.random() * jitterMs);
}

function mapErrorToFailureReason(error: unknown): FailureReason {
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    if (message.includes("timeout") || message.includes("abort")) return "timeout";
    if (message.includes("network") || message.includes("fetch") || message.includes("connection")) return "network_error";
    if (message.includes("http") || message.includes("status") || message.includes("40") || message.includes("50")) return "http_error";
    if (message.includes("json") || message.includes("parse")) return "parse_error";
  }
  return "provider_error";
}

export async function retryWithBackoff<T>(
  operation: () => Promise<T>,
  config: RetryConfig
): Promise<RetryResult<T>> {
  const maxAttempts = config.maxAttempts ?? env.providerRetryCount;
  const baseDelayMs = config.baseDelayMs ?? 100;
  const jitterMs = config.jitterMs ?? env.providerRetryJitterMs;
  const operationName = config.operationName;

  let lastError: unknown;
  let failureReason: FailureReason = "provider_error";

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const result = await operation();
      return { success: true, data: result, attempts: attempt };
    } catch (error) {
      lastError = error;
      failureReason = mapErrorToFailureReason(error);

      if (attempt < maxAttempts) {
        const delay = baseDelayMs * Math.pow(2, attempt - 1) + calculateJitter(jitterMs);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  return {
    success: false,
    error: lastError instanceof Error ? lastError.message : String(lastError),
    attempts: maxAttempts,
    failureReason,
  };
}

export async function retryWithCircuitBreaker<T>(
  operation: () => Promise<T>,
  provider: string,
  model: string | undefined,
  config: RetryConfig
): Promise<RetryResult<T>> {
  const maxAttempts = config.maxAttempts ?? env.providerRetryCount;
  const baseDelayMs = config.baseDelayMs ?? 100;
  const jitterMs = config.jitterMs ?? env.providerRetryJitterMs;
  const operationName = config.operationName;

  const circuitCheck = canAttemptRequest(provider, model);
  if (!circuitCheck.allowed) {
    return {
      success: false,
      error: `Circuit breaker open for ${provider}:${model ?? "default"}`,
      attempts: 0,
      failureReason: "circuit_open",
    };
  }

  let lastError: unknown;
  let failureReason: FailureReason = "provider_error";

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const result = await operation();
      recordSuccess(provider, model);
      return { success: true, data: result, attempts: attempt };
    } catch (error) {
      lastError = error;
      failureReason = mapErrorToFailureReason(error);
      recordFailure(provider, model, failureReason);

      const circuitAfterFailure = canAttemptRequest(provider, model);
      if (!circuitAfterFailure.allowed && attempt < maxAttempts) {
        return {
          success: false,
          error: `Circuit breaker opened after ${attempt} attempt(s)`,
          attempts: attempt,
          failureReason,
        };
      }

      if (attempt < maxAttempts && circuitAfterFailure.allowed) {
        const delay = baseDelayMs * Math.pow(2, attempt - 1) + calculateJitter(jitterMs);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  return {
    success: false,
    error: lastError instanceof Error ? lastError.message : String(lastError),
    attempts: maxAttempts,
    failureReason,
  };
}
