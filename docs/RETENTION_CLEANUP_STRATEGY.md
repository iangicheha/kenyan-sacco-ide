# Retention Cleanup Strategy

This project stores operational safety records in:

- `idempotency_records` (dedupe response cache)
- `orchestrator_events` (workflow stage telemetry)

## Retention Policy

- `idempotency_records`: governed by `IDEMPOTENCY_TTL_SECONDS` (default `86400` / 24h)
- `orchestrator_events`: governed by `ORCHESTRATOR_RETENTION_DAYS` (default `30`)

## Cleanup Script

Run cleanup manually:

```bash
pnpm cleanup:retention
```

The script:

1. Deletes expired rows from `idempotency_records` using `IDEMPOTENCY_TTL_SECONDS`
2. Deletes old rows from `orchestrator_events` older than `ORCHESTRATOR_RETENTION_DAYS`
3. Prints a JSON summary with deletion counts and mode (`supabase`, `memory`, or `none`)

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
