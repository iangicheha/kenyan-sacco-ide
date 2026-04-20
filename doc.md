# Production Refactor Blueprint: Financial-Grade AI Platform

This design upgrades the current Express monolith without greenfield rewrite. It preserves your existing strengths (JWT+RBAC, policy gate, deterministic executor, model routing, audit/telemetry) and removes high-risk architecture flaws.

---

## 1) Asynchronous Architecture (Critical)

### Technology choices

- **Queue + workers**: `Redis Streams` (or `BullMQ` on Redis if you want faster adoption in Node).
  - Why for your system:
    - You already run Node/TypeScript and need quick adoption.
    - Built-in delayed retry/backoff patterns.
    - Consumer groups allow separate worker pools (AI/validation/execution).
    - Operationally simpler than Kafka for current size.
- **Event bus**: `NATS JetStream` for domain events (section 8).
  - Queue handles command jobs; event bus handles fan-out notifications.

### Job schema

Use one canonical envelope for all worker queues:

```json
{
  "job_id": "uuid",
  "job_type": "ai_plan|validate_plan|shadow_execute|commit_execute|notify",
  "tenant_id": "uuid",
  "session_id": "string",
  "operation_id": "uuid|null",
  "request_id": "uuid",
  "correlation_id": "uuid",
  "priority": 1,
  "attempt": 0,
  "max_attempts": 5,
  "scheduled_at": "timestamp",
  "payload": {},
  "created_by": "user_id",
  "created_at": "timestamp"
}
```

### Worker types

1. **AI Worker**
   - Reads `ai_plan` jobs.
   - Runs intent classifier + policy gate + planner through model router.
   - Writes plan to `operation_plans` and emits `operation_created`.
2. **Validation Worker**
   - Reads `validate_plan` jobs.
   - Runs schema validation + formula validation + policy constraints.
   - If pass -> enqueue `shadow_execute`; if fail -> mark operation `rejected_validation`.
3. **Execution Worker**
   - Reads `commit_execute` after human approval.
   - Replays approved plan against canonical dataset transactionally.
   - Writes `execution_results`, `workflow_transitions`, audit records.

### Exact flow

1. Client calls `POST /api/ai/requests`.
2. API does auth/RBAC/quota checks, writes `ai_requests` row (`status=queued`), enqueues `ai_plan`.
3. AI Worker consumes, persists structured plan, sets `status=planned`, enqueues `validate_plan`.
4. Validation Worker consumes, validates, sets `status=validated`, enqueues `shadow_execute`.
5. Shadow worker computes preview/diff, persists `shadow_runs`, sets `status=awaiting_approval`.
6. Client sees preview in realtime; reviewer approves/rejects.
7. On approve, API enqueues `commit_execute`.
8. Execution worker commits deterministic execution, sets `status=completed`, emits events.
9. Realtime gateway pushes updates to subscribed clients.

### Retry, DLQ, recovery

- Retry policy: exponential backoff (5s, 30s, 2m, 10m, 30m), `max_attempts=5`.
- Permanent failures -> move to `dead_letter_jobs`.
- DLQ row schema includes `failed_stage`, `error_code`, `error_message`, `stack`, `last_payload`.
- Recovery:
  - `POST /api/admin/jobs/{job_id}/replay` for controlled replay.
  - Replay requires admin role + reason + audit entry.
  - All replayed jobs get new `job_id`, original referenced as `parent_job_id`.

---

## 2) Remove In-Memory Critical State

### Current in-memory fallback areas to eliminate

- `uploadStore` (tenant/file/sheet cache)
- `pendingOps` fallback array
- `auditLogger` fallback array
- `orchestratorTelemetry` fallback storage
- `workflowState` fallback memory state
- `idempotencyStore` in-memory map fallback
- `policyStore` in-memory fallback

### Replacement plan

- **Database-only critical state** (Postgres/Supabase):
  - `uploads`, `upload_sheets`, `operation_plans`, `pending_operations`,
    `audit_log`, `orchestrator_events`, `workflow_transitions`, `idempotency_records`, `policies`.
- **Distributed cache** (`Redis`) for:
  - short-lived read models,
  - websocket session presence,
  - idempotency acceleration (source of truth still Postgres).

### Safe degradation strategy (DB unavailable)

- Hard rule: **No critical write falls back to memory**.
- Behavior:
  - API returns `503 SERVICE_UNAVAILABLE` for write commands.
  - Read-only endpoints may serve stale cache with `stale=true`.
  - Queue producers paused if DB healthcheck fails.
  - Circuit opens around DB writes to avoid cascade failure.
- Risk note: this reduces availability but protects consistency/auditability (correct tradeoff for finance).

---

## 3) Strong Multi-Tenant Isolation (DB-enforced)

### Tenant context injection

On each request, after JWT verification:

```sql
select set_config('app.tenant_id', :tenant_id, true);
select set_config('app.user_id', :user_id, true);
select set_config('app.user_role', :role, true);
```

All DB access for app traffic must use this request-scoped session context.

### RLS policies (example)

```sql
alter table operation_plans enable row level security;

create policy tenant_isolation_select_operation_plans
on operation_plans
for select
using (tenant_id::text = current_setting('app.tenant_id', true));

create policy tenant_isolation_write_operation_plans
on operation_plans
for insert
with check (tenant_id::text = current_setting('app.tenant_id', true));

create policy tenant_isolation_update_operation_plans
on operation_plans
for update
using (tenant_id::text = current_setting('app.tenant_id', true))
with check (tenant_id::text = current_setting('app.tenant_id', true));
```

Apply equivalent policies to all tenant-scoped tables.

### Prevent bypass

- Use two DB roles:
  - `app_user` (RLS enforced, used by API/workers),
  - `migration_admin` (RLS bypass, only for migrations).
- Forbid `service_role` usage in runtime request path except strict internal bootstrap.
- Add CI check that rejects any query path using bypass credentials.
- Add SQL test suite that verifies cross-tenant reads/writes fail.

---

## 4) Shadow Execution Layer (Very Important)

### Objective

Before approval, run proposed spreadsheet operations on a snapshot copy and show exact expected diff.

### Data flow

1. Validation worker enqueues `shadow_execute`.
2. Shadow worker creates immutable dataset snapshot reference:
   - `dataset_versions` table + object storage parquet/csv artifact.
3. Executes plan against shadow engine.
4. Produces:
   - row-level diff (`before_value`, `after_value`),
   - aggregate metrics delta,
   - validation flags (constraint violations).
5. Persists to `shadow_runs` + `shadow_diffs`.
6. UI presents "safe preview" for reviewer decision.

### Storage design

- `dataset_versions`:
  - `version_id`, `tenant_id`, `source_upload_id`, `checksum`, `storage_uri`, `created_at`.
- `shadow_runs`:
  - `shadow_run_id`, `operation_id`, `dataset_version_id`, `status`, `summary_json`.
- `shadow_diffs`:
  - `shadow_run_id`, `sheet`, `cell_ref`, `before`, `after`, `diff_type`.

### User presentation

- API endpoint: `GET /api/operations/{id}/shadow-preview`.
- Response includes:
  - impacted cells count,
  - high-risk diff flags,
  - downloadable diff artifact.
- Approval button disabled unless latest shadow status is `success` and no policy-blocking violations.

---

## 5) Prompt Management System

### Prompt registry schema

Table: `prompt_registry`

- `prompt_id` (text) e.g. `intent_classifier`
- `version` (int)
- `template` (text)
- `input_schema` (jsonb)
- `output_schema` (jsonb)
- `model_hints` (jsonb) e.g. preferred providers/models
- `status` (`draft|active|deprecated`)
- `created_by`, `created_at`, `change_note`

Unique key: `(prompt_id, version)`.

Table: `prompt_bindings`

- maps pipeline stage -> active prompt version.

### Versioning and rollback

- Activate new version by binding update (transactional).
- Rollback = rebind to previous active version.
- Every prompt invocation logs `(prompt_id, version, hash)` in `model_invocations`.

### Pipeline integration

- Replace inline strings in `intentClassifier` and `financialPlanner`.
- Add `PromptProvider` service:
  - reads bound prompt from DB,
  - renders template with stage payload,
  - validates input/output schema.

---

## 6) Model Governance Layer

### Controls required

1. **Cost controls**
   - Track token in/out and USD per invocation in `model_invocations`.
   - Enforce tenant budget via `tenant_model_budget` table.
2. **Token limits**
   - Hard max input/output tokens per stage and per tenant tier.
3. **Model allowlists**
   - `role_model_policy` table: allowed models by role + action type.
4. **Rate limiting**
   - Redis token bucket:
     - per user,
     - per tenant,
     - per endpoint.

### Integration with existing model router

Pre-router guard sequence:

1. `QuotaGuard` (budget + rate checks)
2. `PolicyGuard` (role/model allowlist)
3. `TokenGuard` (estimated token size and truncation/reject)
4. Router candidate selection

If guard fails, request is rejected before provider call and logged as governance denial.

---

## 7) Observability Upgrade (Production Grade)

### OpenTelemetry tracing

Trace spans:

- `http.request`
- `auth.verify`
- `job.enqueue`
- `worker.consume`
- `model.route`
- `model.invoke`
- `policy.evaluate`
- `shadow.execute`
- `execution.commit`
- `event.publish`
- `ws.push`

Carry `trace_id` + `correlation_id` end-to-end (HTTP -> queue -> worker -> DB).

### Structured JSON logging

Log format fields:

- `timestamp`, `level`, `service`, `env`, `trace_id`, `correlation_id`,
  `tenant_id`, `user_id`, `job_id`, `operation_id`, `event_type`, `message`, `error`.

No free-form multiline logs in production pipeline.

### Metrics

- API: p50/p95/p99 latency by endpoint.
- Queue: queue depth, job age, retries, DLQ count.
- Model: invocation count, latency, error rate, cost USD, token usage.
- Workflow: approval lead time, shadow run duration, execution success rate.
- Security: auth failures, RBAC denials, RLS violations.

### Dashboards

1. **Operations health**: queue lag, worker throughput, DLQ.
2. **Model governance**: cost by tenant/model, deny reasons.
3. **Execution safety**: shadow failures, policy blocks, approval/reject ratios.
4. **Tenant isolation**: cross-tenant denied attempts and anomalies.

---

## 8) Event-Driven Architecture

### Broker choice

- `NATS JetStream` for domain event streaming:
  - low-latency, lightweight ops, replay support, strong fit for Node services.

### Core events

- `ai.requested`
- `operation.created`
- `operation.validated`
- `operation.shadow_completed`
- `operation.approved`
- `operation.rejected`
- `execution.started`
- `execution.completed`
- `execution.failed`
- `audit.recorded`

### Publish/consume model

- Workers publish events after state transitions (outbox pattern below).
- Realtime gateway consumes and pushes to clients.
- Audit projector consumes and materializes compliance views.

### Delivery reliability

- Use **Transactional Outbox**:
  - write domain state + outbox event in same DB transaction.
  - outbox dispatcher publishes to NATS and marks delivered.
- Prevents "state committed but event lost" failure mode.

---

## 9) Replace Polling with Realtime

### Transport

- Use **WebSockets** for bidirectional and future control channels.
- Keep SSE fallback only for restricted network environments.

### Backend push design

- `Realtime Gateway` service subscribes to JetStream events.
- Routes events to tenant/user channels:
  - `tenant:{tenant_id}`
  - `tenant:{tenant_id}:session:{session_id}`
  - `user:{user_id}`

### Client subscription model

- On login, client opens WS with JWT.
- Server authorizes and binds subscriptions to tenant/user scopes.
- UI updates in response to event types:
  - pending operation created,
  - shadow preview ready,
  - approval status changed,
  - execution completed/failed.

Security rule: never allow client-declared tenant channel; derive from JWT claims only.

---

## 10) Updated Architecture Diagram (Mandatory)

```text
[Client: React IDE]
  - Upload, prompt, review, approvals
  - WebSocket subscription
        |
        v
[API Gateway: Express]
  - JWT auth + RBAC + rate limit
  - Tenant context injection
  - Request validation
  - Command endpoints only
        |
        v
[Command Queue: Redis Streams/BullMQ]
  - ai_plan
  - validate_plan
  - shadow_execute
  - commit_execute
  - notify
        |
        v
[Worker Pool]
  ├── [AI Worker]
  |     - classify + policy + plan
  |     - prompt registry + model governance + router
  |
  ├── [Validation Worker]
  |     - schema/formula/policy validation
  |     - enqueue shadow execution
  |
  ├── [Shadow Worker]
  |     - execute on snapshot dataset
  |     - compute row/cell diffs
  |
  └── [Execution Worker]
        - deterministic commit execution
        - idempotent state transitions
        - audit + workflow writes
        |
        v
[Database: Postgres/Supabase]
  - RLS enforced tenant isolation
  - operations, plans, shadow_runs, audit, telemetry, idempotency
  - prompt registry, model invocations, governance tables
        |
        +--> [Outbox Table] -> [Outbox Dispatcher]
                                   |
                                   v
                             [Event Bus: NATS JetStream]
                                   |
                                   +--> [Realtime Gateway]
                                   |       -> WS push to client
                                   |
                                   +--> [Audit Projector/Analytics]
                                   |
                                   +--> [Alerting/Notification Service]
        |
        +--> [Redis Cache]
              - rate limit buckets
              - websocket presence
              - short-lived read cache

[Observability Stack]
  - OpenTelemetry traces
  - JSON logs
  - Metrics + dashboards + alerts
```

---

## 11) Migration Strategy (No Greenfield Rewrite)

### Phase 0: Safety rails first (1-2 weeks)

- Add feature flags:
  - `ASYNC_PIPELINE_ENABLED`
  - `WS_REALTIME_ENABLED`
  - `RLS_ENFORCED`
  - `PROMPT_REGISTRY_ENABLED`
- Remove memory fallback writes for highest-risk tables first (`pending_operations`, `audit_log`, `idempotency_records`).
- Add DB health-gated 503 behavior for command writes.

### Phase 1: Introduce queue and dual-write orchestration (2-3 weeks)

- Keep existing synchronous endpoint contract.
- Behind flag, endpoint enqueues job and optionally still runs sync path (mirror mode).
- Compare sync result vs async result in background; emit mismatch alerts.

### Phase 2: Worker extraction (2-4 weeks)

- Move classifier/planner into AI worker.
- Move formula validation into validation worker.
- Keep execution still API-triggered initially.
- Enable DLQ + replay tooling.

### Phase 3: Shadow execution mandatory (2 weeks)

- Add shadow tables + worker.
- Require successful shadow run before approval.
- UI preview diff rollout to reviewers.

### Phase 4: RLS enforcement (2 weeks)

- Backfill tenant_id in all rows.
- Enable RLS in report-only mode first (log denials).
- Switch runtime DB user to non-bypass role.
- Turn on hard RLS enforcement flag.

### Phase 5: Prompt registry + model governance (2-3 weeks)

- Migrate inline prompts to registry with binding map.
- Add budget/token/model policy checks before router invocation.
- Enforce quotas tenant by tenant.

### Phase 6: Event bus + realtime replacement (2 weeks)

- Implement outbox dispatcher and NATS publish.
- Deploy realtime gateway and WS client subscriptions.
- Decommission frontend polling paths.

### Phase 7: Full async cutover and cleanup (1-2 weeks)

- Remove synchronous AI execution path.
- Remove all remaining in-memory critical fallback logic.
- Decommission deprecated endpoints and dead code.

### Downtime avoidance

- Use expand-migrate-contract DB migrations.
- All behavior switches behind tenant-scoped feature flags.
- Blue/green worker deployment with queue drain checks.
- Keep old endpoints operational until parity SLO met for 2 weeks.

---

## High-Risk Truths (Brutally Honest)

1. If you keep in-memory critical fallbacks, your audit trail remains non-authoritative and non-compliant.
2. Without DB-level RLS, your tenant isolation is one bug away from cross-tenant exposure.
3. Without async workers and DLQ, transient model/provider faults will continue to hit user-facing latency and reliability.
4. Without shadow execution, approval decisions are still partially blind for high-impact spreadsheet operations.
5. Without governance controls, model cost and policy risk will eventually become unbounded in multi-tenant scale.
 