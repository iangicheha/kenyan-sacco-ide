import { afterEach, describe, expect, it, vi } from "vitest";
import {
  cleanupExpiredIdempotencyRecords,
  getIdempotentResponse,
  saveIdempotentResponse,
} from "./idempotencyStore.js";

describe("idempotencyStore", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns cached response for same scope/key", async () => {
    await saveIdempotentResponse("spreadsheet.accept", "demo-key-1", {
      statusCode: 200,
      body: { status: "applied", operationId: "op-1" },
    });

    const cached = await getIdempotentResponse("spreadsheet.accept", "demo-key-1");
    expect(cached).not.toBeNull();
    expect(cached?.statusCode).toBe(200);
    expect(cached?.body).toEqual({ status: "applied", operationId: "op-1" });
  });

  it("isolates values by scope", async () => {
    await saveIdempotentResponse("spreadsheet.reject", "demo-key-2", {
      statusCode: 200,
      body: { status: "rejected", operationId: "op-2" },
    });

    const acceptScope = await getIdempotentResponse("spreadsheet.accept", "demo-key-2");
    const rejectScope = await getIdempotentResponse("spreadsheet.reject", "demo-key-2");

    expect(acceptScope).toBeNull();
    expect(rejectScope?.body).toEqual({ status: "rejected", operationId: "op-2" });
  });

  it("expires cached responses after ttl window", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));
    await saveIdempotentResponse("spreadsheet.accept", "ttl-key-1", {
      statusCode: 200,
      body: { status: "applied", operationId: "ttl-op" },
    });

    vi.setSystemTime(new Date("2026-01-03T00:00:01.000Z"));
    const cached = await getIdempotentResponse("spreadsheet.accept", "ttl-key-1");
    expect(cached).toBeNull();
  });

  it("cleanup removes expired memory records", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));
    await saveIdempotentResponse("spreadsheet.reject", "cleanup-key-1", {
      statusCode: 200,
      body: { status: "rejected", operationId: "cleanup-op" },
    });

    vi.setSystemTime(new Date("2026-01-03T00:00:01.000Z"));
    const cleaned = await cleanupExpiredIdempotencyRecords();
    expect(cleaned.deleted).toBeGreaterThanOrEqual(1);
    expect(cleaned.mode).toBe("memory");
  });
});
