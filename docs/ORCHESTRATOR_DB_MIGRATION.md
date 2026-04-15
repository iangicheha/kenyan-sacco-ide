# Orchestrator DB Migration

This guide applies the persistence schema needed for production orchestration features:

- correlation-aware audit entries
- orchestrator stage telemetry
- workflow lifecycle transitions
- idempotency records

## 1) Apply Schema

Run the SQL in:

- `server/supabase/schema.sql`

If you are using Supabase SQL editor:

1. Open SQL editor.
2. Paste the schema file contents.
3. Execute and verify no errors.

## 2) Verify Tables

Use the setup endpoint:

- `GET /api/admin/setup`

Expected checks to be `true`:

- `pendingOperationsTable`
- `auditLogTable`
- `orchestratorEventsTable`
- `workflowTransitionsTable`
- `idempotencyRecordsTable`

## 3) Runtime Config

For production-like behavior set:

- `ALLOW_IN_MEMORY_FALLBACK=false`

This forces failures when persistence is unavailable and prevents silent in-memory drift.

## 4) New Operational Endpoints

- `GET /api/spreadsheet/workflow/:sessionId`
- `GET /api/spreadsheet/events/:sessionId`
- `GET /api/spreadsheet/metrics/:sessionId`

These support operational debugging and traceability per session.

Role access summary:

- `pending` -> `analyst`, `reviewer`, `admin`
- `accept/reject` -> `reviewer`, `admin`
- `audit/workflow/events/metrics` -> `reviewer`, `admin`

## 5) Idempotency Cleanup

You can trigger cleanup of expired idempotency records with:

- `POST /api/admin/cleanup/idempotency`

Notes:

- Endpoint requires an `admin` role.
- Expiration is controlled by `IDEMPOTENCY_TTL_SECONDS`.
