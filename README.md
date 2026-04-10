# Meridian Financial AI IDE

Production-ready financial AI workspace with deterministic execution, immutable auditing, role-based APIs, and versioned spreadsheet tables.

## Architecture

```text
Frontend Spreadsheet UI
        |
        v
Interpreter (intent only, no math)
        |
        v
Planner (JSON plan + schema version)
        |
        v
Validator (schema + action safety)
        |
        v
Execution Engine (deterministic models/calculations)
        |
        v
Data Layer (versioned table store)
        |
        v
Audit Layer (immutable SQLite records + exports)
```

## Layer Responsibilities

- AI (`interpreter`) parses natural language into structured intent only.
- Planner (`planner`) emits JSON execution plans with action variants and `schemaVersion`.
- Validator (`validator`) enforces schema compatibility, allowed actions, and column existence.
- Execution (`executionEngine`) performs deterministic numeric operations and forecasting.
- Data (`tableStore`) stores and versions parsed sheet data, supports rollback.
- Audit (`auditLogger`) records immutable execution traces to SQLite and exports JSON/CSV/SQL.

## Deterministic Design

- The AI never computes financial results.
- AI returns intent and planning metadata only.
- All numerical outputs are computed in deterministic TypeScript model functions.
- Identical dataset + identical plan always produces identical output.
- `/api/ai/chat` returns a strict structured JSON contract (no conversational text).

## `/api/ai/chat` Response Contract

All successful chat responses are standardized to:

```json
{
  "query": "string",
  "context": {},
  "plan": [],
  "validation": {},
  "execution": {
    "steps": [],
    "final": "any"
  },
  "result": "any",
  "error": null
}
```

Error responses are standardized to:

```json
{
  "query": "string",
  "context": null,
  "plan": null,
  "validation": null,
  "execution": null,
  "result": null,
  "error": "error message"
}
```

Contract enforcement rules:

- No `text`, `message`, or `explanation` fields in main chat response.
- LLM output is JSON-parsed with retry (up to 2 retries) before fallback logic.
- `result` is sourced only from the execution engine (`execution.final`), never from model prose.

## API Endpoints and Roles

- `GET /api/health` (`read-only`, `analyst`, `admin`) -> service health JSON.
- `POST /api/upload` (`admin`) -> upload workbook(s) and parse sheet previews.
- `GET /api/upload/preview` (`read-only`, `analyst`, `admin`) -> paginated preview rows.
- `POST /api/ai/chat` (`analyst`, `admin`) -> deterministic structured JSON contract.
- `GET /api/audit/export?format=json|csv|sql` (`admin`) -> immutable audit export.
- `GET /api/tables/:tableName/versions` (`read-only`, `analyst`, `admin`) -> table versions.
- `POST /api/tables/:tableName/rollback` (`admin`) -> rollback to a historical version.

## JWT Authentication

All protected routes require:

```http
Authorization: Bearer <JWT>
```

Token payload must include:

- `sub` (user ID)
- `role` (`read-only` | `analyst` | `admin`)

PowerShell example to call analyst route:

```powershell
$token = "<ANALYST_JWT>"
Invoke-RestMethod -Method Post -Uri "http://localhost:3001/api/ai/chat" `
  -Headers @{ Authorization = "Bearer $token" } `
  -ContentType "application/json" `
  -Body '{"message":"forecast revenue next 3 months with arima","tableName":"demo::Sheet1"}'
```

Unauthorized access always returns:

```json
{ "error": "Unauthorized" }
```

Generate local JWTs quickly:

```bash
pnpm token:generate -- --role analyst --sub analyst-1
pnpm token:generate -- --role read-only --sub reader-1
pnpm token:generate -- --role admin --sub admin-1
```

Optional flags:

- `--expiresIn` (default `1d`)
- uses `JWT_SECRET` from environment (falls back to `dev-secret`)

Generate all three development roles at once:

```bash
pnpm token:generate:dev
```

Optional positional args for the dev generator:

```bash
pnpm token:generate:dev -- 12h qa
```

- first arg: expiry (e.g. `12h`)
- second arg: base subject prefix (e.g. `qa`)

## Forecast Models

Supported deterministic forecast variants in `apply_model`:

- `moving_average`
- `forecast` (moving-average final projection)
- `holt_winters`
- `linear_regression`
- `exponential_smoothing`
- `arima`

## Environment Variables

Required:

- `DATABASE_URL` (e.g. `sqlite:./data/meridian.db`)
- `JWT_SECRET`
- `AI_MODEL_KEY`
- `PORT`

Optional:

- `API_AUTH_ENABLED` (`true` or `false`, default `true`)

## Local Development

```bash
pnpm install
cp .env.example .env
pnpm test
pnpm check
pnpm dev
```

## Team One-Liners

Use either GNU Make (macOS/Linux) or the PowerShell wrapper (Windows).

Make:

```bash
make check
make test
make token ROLE=admin SUB=admin-local
make token-dev EXPIRY=12h PREFIX=qa
make docker-up
```

PowerShell:

```powershell
.\scripts\dev-tools.ps1 -Task check
.\scripts\dev-tools.ps1 -Task test
.\scripts\dev-tools.ps1 -Task token -Role admin -Sub admin-local
.\scripts\dev-tools.ps1 -Task token-dev -Expiry 12h -Prefix qa
.\scripts\dev-tools.ps1 -Task docker-up
```

## Continuous Integration

GitHub Actions workflow: `.github/workflows/ci.yml`

- Runs on push to `main` / `master` and on every pull request
- Installs dependencies with `pnpm install --frozen-lockfile`
- Executes:
  - `pnpm check`
  - `pnpm test`

## Docker Deployment

```bash
docker compose up --build
```

This starts:

- `app` (API server on `:3001`)
- `db` (Postgres on `:5432`, available for future DB migration)

Default app storage uses SQLite path from `DATABASE_URL`.

## Postgres Migration Path (Audit Records)

The app is SQLite-first by default, with Postgres provided via Docker Compose.

Migration workflow:

1. Export from app using `GET /api/audit/export?format=sql`
2. Apply `server/audit/schema.sql` in Postgres
3. Import exported SQL dump
4. Set `DATABASE_URL` to your Postgres URL

Detailed steps: `docs/POSTGRES_MIGRATION.md`.

## Testing

The server test suite covers:

- Interpreter deterministic behavior
- Planner forecast/model variants + schema versioning
- Execution engine model coverage + stale schema rejection + rollback
- API integration for role enforcement, audit export formats, and deterministic chat contract invariants