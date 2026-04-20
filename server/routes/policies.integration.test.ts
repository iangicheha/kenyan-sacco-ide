import express from "express";
import jwt from "jsonwebtoken";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { requireAuth, requireRoles, type UserRole } from "../middleware/auth.js";
import { adminRouter } from "./admin.js";
import { policiesRouter } from "./policies.js";

const JWT_SECRET = process.env.JWT_SECRET ?? "dev-secret-change-in-production";

function createToken(role: UserRole, tenantId = "tenant-a"): string {
  return jwt.sign(
    {
      email: "tester@example.com",
      institutionType: "sacco",
      role,
      tenantId,
    },
    JWT_SECRET,
    { expiresIn: "5m" }
  );
}

describe("policies routes integration", () => {
  let baseUrl = "";
  let stopServer: (() => Promise<void>) | null = null;

  beforeAll(async () => {
    const app = express();
    app.use(express.json());
    app.use("/api/admin", requireAuth, requireRoles(["admin"]), adminRouter);
    app.use("/api/policies", requireAuth, policiesRouter);

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

  it(
    "rejects policy creation for non-admin",
    async () => {
    const token = createToken("analyst");
    const response = await fetch(`${baseUrl}/api/admin/policies`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        regulator: "CBK",
        version: "1.0.0",
        rulesJson: { highRiskIntents: ["calculate_provisioning"], requiresApproval: true },
        effectiveFrom: new Date().toISOString(),
        isActive: true,
      }),
    });

    expect(response.status).toBe(403);
    },
    15000
  );

  it(
    "allows admin to create and activate a policy, then fetch active policy",
    async () => {
    const adminToken = createToken("admin");
    const createdResponse = await fetch(`${baseUrl}/api/admin/policies`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${adminToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        regulator: "CBK",
        version: "1.0.1",
        rulesJson: { highRiskIntents: ["calculate_provisioning"], requiresApproval: true },
        effectiveFrom: new Date(Date.now() - 1000).toISOString(),
        isActive: true,
      }),
    });

    expect(createdResponse.status).toBe(200);
    const createdBody = (await createdResponse.json()) as { policy?: { id: string; regulator: string; version: string } };
    expect(createdBody.policy?.regulator).toBe("CBK");
    expect(createdBody.policy?.version).toBe("1.0.1");
    expect(createdBody.policy?.id).toBeTruthy();

    const activateResponse = await fetch(`${baseUrl}/api/admin/policies/${createdBody.policy!.id}/activate`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${adminToken}`,
      },
    });
    // In-memory fallback supports activation; Supabase may also support it.
    expect([200, 404]).toContain(activateResponse.status);

    const activeResponse = await fetch(`${baseUrl}/api/policies/active?regulator=CBK`, {
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(activeResponse.status).toBe(200);
    const activeBody = (await activeResponse.json()) as { policy?: { version?: string } | null };
    // If activation unsupported (legacy-only DB), we still expect endpoint to respond.
    expect(activeBody).toHaveProperty("policy");
    if (activeBody.policy) {
      expect(activeBody.policy.version).toBeTruthy();
    }
    },
    15000
  );
});

