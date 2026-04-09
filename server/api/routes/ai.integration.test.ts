import { describe, it, expect, beforeAll } from "vitest";
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

  it("returns structured JSON response", async () => {
    const res = await request(app)
      .post("/api/ai/chat")
      .set("Authorization", `Bearer ${analystToken}`)
      .send({
        message: "forecast revenue next 3 months with arima",
        tableName: "demo::Sheet1",
      });

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(Array.isArray(res.body.plan.steps)).toBe(true);
    expect(res.body.execution).toBeTruthy();
    expect(res.body).toHaveProperty("context");
    expect(res.body.context).toHaveProperty("confidence");
    expect(res.body).toHaveProperty("validation");
    expect(res.body.validation.valid).toBe(true);
    expect(res.body).toHaveProperty("retrievedContext");
    expect(res.body.retrievedContext).toHaveProperty("relevantTables");
    expect(res.body).toHaveProperty("result");
    expect(res.body.result).toStrictEqual(res.body.execution.result);
    expect(res.body.metrics).toHaveProperty("totalMs");
  });

  it("enforces role-based access for chat endpoint", async () => {
    const res = await request(app)
      .post("/api/ai/chat")
      .set("Authorization", `Bearer ${readOnlyToken}`)
      .send({ message: "sum revenue", tableName: "demo::Sheet1" });
    expect(res.status).toBe(401);
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
