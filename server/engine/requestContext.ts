import { randomUUID } from "node:crypto";
import type { Request } from "express";

export interface RequestContext {
  correlationId: string;
  idempotencyKey?: string;
}

export function getRequestContext(req: Request): RequestContext {
  const correlationHeader = req.header("x-correlation-id")?.trim();
  const idempotencyHeader = req.header("idempotency-key")?.trim();

  return {
    correlationId: correlationHeader && correlationHeader.length > 0 ? correlationHeader : randomUUID(),
    idempotencyKey: idempotencyHeader && idempotencyHeader.length > 0 ? idempotencyHeader : undefined,
  };
}
