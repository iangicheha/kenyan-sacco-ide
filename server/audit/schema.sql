CREATE TABLE IF NOT EXISTS audit_records (
  id TEXT PRIMARY KEY,
  timestamp TEXT NOT NULL,
  "user" TEXT NOT NULL,
  input TEXT NOT NULL,
  retrieved_context TEXT,
  interpretation TEXT NOT NULL,
  plan TEXT NOT NULL,
  validation_result TEXT NOT NULL,
  execution_steps TEXT NOT NULL,
  execution_result TEXT NOT NULL
);
