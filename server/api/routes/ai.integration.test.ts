import { describe, it, expect, beforeAll, vi } from "vitest";
import request from "supertest";
import { createApp } from "../../index";
import { clearTablesForTests, upsertTable } from "../../data/tableStore";
import { issueDevToken } from "../../middleware/apiAuth";

describe("/api/ai/chat", () => {
  const app = createApp();
  const analystToken = issueDevToken("analyst-1", "analyst");
  const readOnlyToken = issueDevToken("reader-1", "read-only");
  const adminToken = issueDevToken("admin-1", "admin");

  beforeAll(() => {
    process.env.API_AUTH_ENABLED = "true";
    clearTablesForTests();
    upsertTable("demo::Sheet1", [{ revenue: 100 }, { revenue: 200 }, { revenue: 300 }]);
  });

  it("returns deterministic structured JSON contract", async () => {
    const res = await request(app)
      .post("/api/ai/chat")
      .set("Authorization", `Bearer ${analystToken}`)
      .send({
        message: "forecast revenue next 3 months with arima",
        tableName: "demo::Sheet1",
      });

    expect(res.status).toBe(200);
    expect(res.body.query).toBe("forecast revenue next 3 months with arima");
    expect(res.body.context).toBeTruthy();
    expect(res.body.context).toHaveProperty("relevantTables");
    expect(Array.isArray(res.body.plan)).toBe(true);
    expect(res.body.validation?.valid).toBe(true);
    expect(Array.isArray(res.body.execution?.steps)).toBe(true);
    expect(res.body.result).toStrictEqual(res.body.execution?.final);
    expect(res.body.error).toBeNull();
    expect(res.body).not.toHaveProperty("text");
    expect(res.body).not.toHaveProperty("message");
    expect(res.body).not.toHaveProperty("explanation");
    expect(res.body.execution).not.toHaveProperty("summary");
  });

  it("returns identical JSON for the same query", async () => {
    const payload = {
      message: "forecast revenue next 3 months with arima",
      tableName: "demo::Sheet1",
    };
    const [a, b] = await Promise.all([
      request(app).post("/api/ai/chat").set("Authorization", `Bearer ${analystToken}`).send(payload),
      request(app).post("/api/ai/chat").set("Authorization", `Bearer ${analystToken}`).send(payload),
    ]);
    expect(a.status).toBe(200);
    expect(b.status).toBe(200);
    expect(a.body).toStrictEqual(b.body);
  });

  it("returns contract-shaped error payload", async () => {
    const res = await request(app)
      .post("/api/ai/chat")
      .set("Authorization", `Bearer ${analystToken}`)
      .send({ message: "", tableName: "demo::Sheet1" });

    expect(res.status).toBe(400);
    expect(res.body).toStrictEqual({
      query: "",
      context: null,
      plan: null,
      validation: null,
      execution: null,
      result: null,
      error: "message is required",
    });
  });

  it("enforces role-based access for chat endpoint", async () => {
    const res = await request(app)
      .post("/api/ai/chat")
      .set("Authorization", `Bearer ${readOnlyToken}`)
      .send({ message: "sum revenue", tableName: "demo::Sheet1" });
    expect(res.status).toBe(401);
  });

  it("enforces role-based access for goal endpoint", async () => {
    const res = await request(app)
      .post("/api/ai/goal")
      .set("Authorization", `Bearer ${readOnlyToken}`)
      .send({ goal: "reduce defaults", tableName: "demo::Sheet1" });
    expect(res.status).toBe(401);
  });

  it("runs goal autonomy pipeline via POST /api/ai/goal", async () => {
    vi.stubEnv("OPENAI_API_KEY", "");
    vi.stubEnv("AI_MODEL_KEY", "");
    try {
      const res = await request(app)
        .post("/api/ai/goal")
        .set("Authorization", `Bearer ${analystToken}`)
        .send({
          goal: "reduce loan defaults and forecast outcomes",
          tableName: "demo::Sheet1",
        });
      expect(res.status).toBe(200);
      expect(res.body.goal).toBeTruthy();
      expect(Array.isArray(res.body.tasks)).toBe(true);
      expect(Array.isArray(res.body.strategies)).toBe(true);
      expect(Array.isArray(res.body.scenarios)).toBe(true);
      expect(res.body.report).toHaveProperty("summary");
      expect(res.body.report).toHaveProperty("recommendations");
      expect(res.body.objective.objective).toBe("minimize_default_rate");
      expect(res.body.metrics).toHaveProperty("totalMs");
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it("supports audit export in JSON/CSV/SQL for admin role", async () => {
    const jsonRes = await request(app)
      .get("/api/audit/export?format=json")
      .set("Authorization", `Bearer ${adminToken}`);
    expect(jsonRes.status).toBe(200);
    expect(Array.isArray(jsonRes.body.events)).toBe(true);

    const csvRes = await request(app)
      .get("/api/audit/export?format=csv")
      .set("Authorization", `Bearer ${adminToken}`);
    expect(csvRes.status).toBe(200);
    expect(String(csvRes.text)).toContain("timestamp");

    const sqlRes = await request(app)
      .get("/api/audit/export?format=sql")
      .set("Authorization", `Bearer ${adminToken}`);
    expect(sqlRes.status).toBe(200);
    expect(String(sqlRes.text)).toContain("CREATE TABLE IF NOT EXISTS audit_records");
  });
});
