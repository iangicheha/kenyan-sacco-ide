import path from "node:path";
import fs from "node:fs";
import { createRequire } from "node:module";
import type { AgentPipelineAudit, AuditRecord, RetrievedContext } from "../types";

const require = createRequire(import.meta.url);
const { DatabaseSync } = require("node:sqlite") as { DatabaseSync: new (path: string) => any };

const dbUrl = process.env.DATABASE_URL ?? `sqlite:${path.resolve(process.cwd(), "data", "meridian.db")}`;
const sqlitePath = dbUrl.startsWith("sqlite:") ? dbUrl.replace("sqlite:", "") : path.resolve(process.cwd(), "data", "meridian.db");
fs.mkdirSync(path.dirname(sqlitePath), { recursive: true });
const db = new DatabaseSync(sqlitePath) as {
  exec: (sql: string) => void;
  prepare: (sql: string) => { run: (...args: unknown[]) => void; all: () => Array<Record<string, string>> };
};

db.exec(`
CREATE TABLE IF NOT EXISTS audit_records (
  id TEXT PRIMARY KEY,
  timestamp TEXT NOT NULL,
  user TEXT NOT NULL,
  input TEXT NOT NULL,
  interpretation TEXT NOT NULL,
  plan TEXT NOT NULL,
  validation_result TEXT NOT NULL,
  execution_steps TEXT NOT NULL,
  execution_result TEXT NOT NULL
);
`);

try {
  db.exec(`ALTER TABLE audit_records ADD COLUMN retrieved_context TEXT;`);
} catch {
  /* column already exists */
}

try {
  db.exec(`ALTER TABLE audit_records ADD COLUMN agent_pipeline TEXT;`);
} catch {
  /* column already exists */
}

function createId(): string {
  return `audit_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function parseRetrievedContext(raw: string | undefined): RetrievedContext | undefined {
  if (!raw || raw === "null") return undefined;
  try {
    return JSON.parse(raw) as RetrievedContext;
  } catch {
    return undefined;
  }
}

function parseAgentPipeline(raw: string | undefined): AgentPipelineAudit | undefined {
  if (!raw || raw === "null") return undefined;
  try {
    return JSON.parse(raw) as AgentPipelineAudit;
  } catch {
    return undefined;
  }
}

export function recordAudit(payload: Omit<AuditRecord, "id" | "timestamp">): AuditRecord {
  const record: AuditRecord = {
    id: createId(),
    timestamp: new Date().toISOString(),
    ...payload,
  };
  const stmt = db.prepare(`
    INSERT INTO audit_records
    (id, timestamp, user, input, retrieved_context, interpretation, plan, validation_result, execution_steps, execution_result, agent_pipeline)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  stmt.run(
    record.id,
    record.timestamp,
    record.user,
    record.input,
    JSON.stringify(record.retrievedContext ?? {}),
    JSON.stringify(record.interpretation),
    JSON.stringify(record.plan),
    JSON.stringify(record.validationResult),
    JSON.stringify(record.executionSteps),
    JSON.stringify(record.executionResult),
    record.agentPipeline ? JSON.stringify(record.agentPipeline) : null
  );
  return record;
}

export function exportAuditLog(): AuditRecord[] {
  const rows = db
    .prepare(
      `SELECT id, timestamp, user, input, retrieved_context, interpretation, plan, validation_result, execution_steps, execution_result, agent_pipeline
       FROM audit_records ORDER BY timestamp ASC`
    )
    .all() as Array<Record<string, string>>;
  return rows.map((row) => ({
    id: row.id,
    timestamp: row.timestamp,
    user: row.user,
    input: row.input,
    retrievedContext: parseRetrievedContext(row.retrieved_context),
    interpretation: JSON.parse(row.interpretation),
    plan: JSON.parse(row.plan),
    validationResult: JSON.parse(row.validation_result),
    executionSteps: JSON.parse(row.execution_steps),
    executionResult: JSON.parse(row.execution_result),
    agentPipeline: parseAgentPipeline(row.agent_pipeline),
  }));
}

function escapeCsv(value: unknown): string {
  const str = typeof value === "string" ? value : JSON.stringify(value);
  return `"${String(str).replaceAll(`"`, `""`)}"`;
}

export function exportAuditCsv(): string {
  const records = exportAuditLog();
  const header = [
    "id",
    "timestamp",
    "user",
    "input",
    "retrievedContext",
    "interpretation",
    "plan",
    "validationResult",
    "executionSteps",
    "executionResult",
    "agentPipeline",
  ].join(",");
  const lines = records.map((r) =>
    [
      r.id,
      r.timestamp,
      r.user,
      r.input,
      r.retrievedContext,
      r.interpretation,
      r.plan,
      r.validationResult,
      r.executionSteps,
      r.executionResult,
      r.agentPipeline,
    ]
      .map(escapeCsv)
      .join(",")
  );
  return [header, ...lines].join("\n");
}

export function exportAuditSqlDump(): string {
  const records = exportAuditLog();
  const create = `CREATE TABLE IF NOT EXISTS audit_records (
  id TEXT PRIMARY KEY,
  timestamp TEXT NOT NULL,
  user TEXT NOT NULL,
  input TEXT NOT NULL,
  retrieved_context TEXT,
  interpretation TEXT NOT NULL,
  plan TEXT NOT NULL,
  validation_result TEXT NOT NULL,
  execution_steps TEXT NOT NULL,
  execution_result TEXT NOT NULL,
  agent_pipeline TEXT
);`;
  const inserts = records.map((r) => {
    const esc = (s: string) => s.replaceAll("'", "''");
    return `INSERT INTO audit_records (id, timestamp, user, input, retrieved_context, interpretation, plan, validation_result, execution_steps, execution_result, agent_pipeline) VALUES ('${esc(
      r.id
    )}', '${esc(r.timestamp)}', '${esc(r.user)}', '${esc(r.input)}', '${esc(
      JSON.stringify(r.retrievedContext ?? {})
    )}', '${esc(JSON.stringify(r.interpretation))}', '${esc(JSON.stringify(r.plan))}', '${esc(
      JSON.stringify(r.validationResult)
    )}', '${esc(JSON.stringify(r.executionSteps))}', '${esc(JSON.stringify(r.executionResult))}', '${esc(
      r.agentPipeline ? JSON.stringify(r.agentPipeline) : ""
    )}');`;
  });
  return [create, ...inserts].join("\n");
}
