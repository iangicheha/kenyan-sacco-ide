import type { NextFunction, Response } from "express";
import { describe, expect, it, vi } from "vitest";
import type { AuthenticatedRequest } from "./auth.js";
import { requireRoles, userHasAnyRole } from "./auth.js";

function createMockResponse() {
  const json = vi.fn();
  const status = vi.fn(() => ({ json }));
  return { status, json } as unknown as Response & { status: ReturnType<typeof vi.fn>; json: ReturnType<typeof vi.fn> };
}

describe("auth role guards", () => {
  it("detects role membership", () => {
    const req = {
      user: { email: "analyst@test.com", institutionType: "sacco", role: "analyst" },
    } as AuthenticatedRequest;
    expect(userHasAnyRole(req, ["admin"])).toBe(false);
    expect(userHasAnyRole(req, ["analyst", "reviewer"])).toBe(true);
  });

  it("blocks when user lacks required roles", () => {
    const middleware = requireRoles(["admin"]);
    const req = {
      user: { email: "reviewer@test.com", institutionType: "bank", role: "reviewer" },
    } as AuthenticatedRequest;
    const res = createMockResponse();
    const next = vi.fn() as unknown as NextFunction;

    middleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it("allows when user has required role", () => {
    const middleware = requireRoles(["reviewer", "admin"]);
    const req = {
      user: { email: "reviewer@test.com", institutionType: "bank", role: "reviewer" },
    } as AuthenticatedRequest;
    const res = createMockResponse();
    const next = vi.fn() as unknown as NextFunction;

    middleware(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
  });

  it("blocks when no authenticated user context exists", () => {
    const middleware = requireRoles(["analyst"]);
    const req = {} as AuthenticatedRequest;
    const res = createMockResponse();
    const next = vi.fn() as unknown as NextFunction;

    middleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });
});
