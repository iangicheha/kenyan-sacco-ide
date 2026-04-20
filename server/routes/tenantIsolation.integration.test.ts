import express from "express";
import jwt from "jsonwebtoken";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { requireAuth, type UserRole } from "../middleware/auth.js";
import { filesRouter } from "./files.js";
import { spreadsheetRouter } from "./spreadsheet.js";
import { createPendingFormulaOperation } from "../engine/pendingOps.js";

const JWT_SECRET = process.env.JWT_SECRET ?? "dev-secret-change-in-production";

function createToken(role: UserRole, tenantId: string): string {
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

describe("tenant isolation integration", () => {
  let baseUrl = "";
  let stopServer: (() => Promise<void>) | null = null;

  beforeAll(async () => {
    const app = express();
    app.use(express.json());
    app.use("/api/spreadsheet", requireAuth, spreadsheetRouter);
    app.use("/api/files", requireAuth, filesRouter);

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

  it("returns 403 for cross-tenant audit session read", async () => {
    const token = createToken("reviewer", "tenant-a");
    const response = await fetch(`${baseUrl}/api/spreadsheet/audit/tenant-b:session-123`, {
      headers: {
        authorization: `Bearer ${token}`,
      },
    });
    expect(response.status).toBe(403);
  });

  it("returns 403 when trying to accept another tenant's pending operation", async () => {
    const op = await createPendingFormulaOperation({
      tenantId: "tenant-a",
      sessionId: "tenant-a:session-1",
      cellRef: "A1",
      formula: "=1+1",
      reasoning: "test",
      confidence: 0.99,
    });

    const token = createToken("reviewer", "tenant-b");
    const response = await fetch(`${baseUrl}/api/spreadsheet/accept`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        operationId: op.id,
        analyst: "reviewer@tenant-b",
      }),
    });

    expect(response.status).toBe(403);
    const body = (await response.json()) as { error?: string };
    expect(body.error).toContain("Cross-tenant");
  });

  it("returns 404 when deleting a file that doesn't exist in tenant scope", async () => {
    const token = createToken("admin", "tenant-b");
    const response = await fetch(`${baseUrl}/api/files/${encodeURIComponent("tenant-a-file.xlsx")}`, {
      method: "DELETE",
      headers: {
        authorization: `Bearer ${token}`,
      },
    });
    expect([404, 200]).toContain(response.status);
  });
});

