import express from "express";
import jwt from "jsonwebtoken";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { requireAuth, requireRoles, type UserRole } from "../middleware/auth.js";
import { adminRouter } from "./admin.js";
import { reportsRouter } from "./reports.js";

const JWT_SECRET = process.env.JWT_SECRET ?? "dev-secret-change-in-production";

function createToken(role: UserRole): string {
  return jwt.sign(
    {
      email: "tester@example.com",
      institutionType: "sacco",
      role,
    },
    JWT_SECRET,
    { expiresIn: "5m" }
  );
}

describe("route auth integration", () => {
  let baseUrl = "";
  let stopServer: (() => Promise<void>) | null = null;

  beforeAll(async () => {
    const app = express();
    app.use(express.json());
    app.use("/api/admin", requireAuth, requireRoles(["admin"]), adminRouter);
    app.use("/api/reports", requireAuth, requireRoles(["analyst", "reviewer", "admin"]), reportsRouter);

    await new Promise<void>((resolve) => {
      const server = app.listen(0, "127.0.0.1", () => {
        const address = server.address();
        if (!address || typeof address === "string") {
          throw new Error("Failed to resolve test server address.");
        }
        baseUrl = `http://127.0.0.1:${address.port}`;
        stopServer = async () =>
          await new Promise<void>((closeResolve, closeReject) => {
            server.close((error) => {
              if (error) closeReject(error);
              else closeResolve();
            });
          });
        resolve();
      });
    });
  });

  afterAll(async () => {
    if (stopServer) await stopServer();
  });

  it("returns 401 when bearer token is missing", async () => {
    const response = await fetch(`${baseUrl}/api/admin/setup`);
    const body = (await response.json()) as { error?: string };

    expect(response.status).toBe(401);
    expect(body.error).toContain("Missing bearer token");
  });

  it("returns 401 when bearer token is invalid", async () => {
    const response = await fetch(`${baseUrl}/api/admin/setup`, {
      headers: {
        authorization: "Bearer invalid-token",
      },
    });
    const body = (await response.json()) as { error?: string };

    expect(response.status).toBe(401);
    expect(body.error).toContain("Invalid or expired token");
  });

  it("returns 403 when authenticated user lacks admin role", async () => {
    const analystToken = createToken("analyst");
    const response = await fetch(`${baseUrl}/api/admin/setup`, {
      headers: {
        authorization: `Bearer ${analystToken}`,
      },
    });
    const body = (await response.json()) as { error?: string };

    expect(response.status).toBe(403);
    expect(body.error).toContain("Forbidden");
  });

  it("returns 403 on reports route when user role is not allowed", async () => {
    const readOnlyToken = createToken("read-only");
    const response = await fetch(`${baseUrl}/api/reports/health`, {
      headers: {
        authorization: `Bearer ${readOnlyToken}`,
      },
    });
    const body = (await response.json()) as { error?: string };

    expect(response.status).toBe(403);
    expect(body.error).toContain("Forbidden");
  });

  it("returns 200 on reports route for allowed role", async () => {
    const analystToken = createToken("analyst");
    const response = await fetch(`${baseUrl}/api/reports/health`, {
      headers: {
        authorization: `Bearer ${analystToken}`,
      },
    });
    const body = (await response.json()) as { status?: string };

    expect(response.status).toBe(200);
    expect(body.status).toBe("ok");
  });
});
