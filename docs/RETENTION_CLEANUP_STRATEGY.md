# Retention Cleanup Strategy

This project stores operational safety records in:

- `idempotency_records` (dedupe response cache)
- `audit_log` (immutable execution trail)
- `orchestrator_events` (workflow stage telemetry)
- `workflow_transitions` (state lifecycle trace)

## Retention Policy

- `idempotency_records`: governed by `IDEMPOTENCY_TTL_SECONDS` (default `86400` / 24h)
- `audit_log`: governed by `RETENTION_DAYS_AUDIT` (default `365`)
- `orchestrator_events` + `workflow_transitions`: governed by `RETENTION_DAYS_TELEMETRY` (default `90`)

## Cleanup Script

Run cleanup manually:

```bash
pnpm cleanup:retention
```

The script:

1. Deletes expired rows from `idempotency_records` using `IDEMPOTENCY_TTL_SECONDS`
2. Deletes old rows from `audit_log` older than `RETENTION_DAYS_AUDIT`
3. Deletes old rows from telemetry tables (`orchestrator_events`, `workflow_transitions`) older than `RETENTION_DAYS_TELEMETRY`
4. Prints a JSON summary with deletion counts and mode (`supabase`, `memory`, or `none`)

## Scheduling

Recommended: run daily during off-peak hours.

Example cron (Linux):

```bash
0 2 * * * cd /path/to/kenyan-sacco-ide && pnpm cleanup:retention >> /var/log/kenyan-sacco-retention.log 2>&1
```

Example Windows Task Scheduler action:

- Program/script: `pnpm`
- Arguments: `cleanup:retention`
- Start in: `C:\Users\ADMIN\OneDrive\Desktop\kenyan-sacco-ide`

## Monitoring

- Alert if cleanup fails repeatedly
- Track trend of deleted rows per run
- Verify table growth remains stable over time
