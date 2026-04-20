# Phase 3 Implementation: Shadow Execution Layer

## Summary

Phase 3 has been successfully implemented. The shadow execution layer now runs AI-generated operation plans against dataset snapshots, computes cell/row-level diffs, and presents a "safe preview" for reviewer approval before any changes are committed to the canonical dataset.

---

## Files Created/Modified

### New Files

1. **`server/workers/shadowWorker.ts`**
   - Shadow execution worker that processes `shadow_execute` jobs
   - Creates dataset version snapshots
   - Executes plans against shadow copies
   - Computes and persists cell/row diffs to `shadow_diffs`
   - Enqueues `commit_execute` jobs after successful shadow runs

2. **`server/workers/executionWorker.ts`**
   - Execution worker that processes `commit_execute` jobs
   - Verifies operation approval status
   - Applies approved changes to canonical dataset
   - Writes audit log entries for each change
   - Updates workflow transitions

3. **`server/supabase/migrations/004_shadow_execution.sql`**
   - Complete migration for Phase 3 tables
   - RLS policies for tenant isolation
   - Admin RPC functions for approve/reject/replay

### Modified Files

1. **`server/index.ts`**
   - Added `startShadowWorker()` and `startExecutionWorker()` on startup
   - Added graceful shutdown for both workers

2. **`server/routes/ai.ts`**
   - Added `GET /api/ai/operations/:operationId/shadow-preview` endpoint
   - Returns shadow run status, summary, and diffs
   - Includes `canApprove` flag based on shadow status and policy violations

3. **`server/routes/admin.ts`**
   - Added `POST /api/admin/jobs/:jobId/replay` for DLQ replay
   - Added `POST /api/admin/operations/:operationId/approve`
   - Added `POST /api/admin/operations/:operationId/reject`
   - Added `GET /api/admin/dead-letters` to list DLQ jobs
   - Added `GET /api/admin/operations` to list all operations

4. **`server/engine/asyncJobs.ts`**
   - Added `enqueueCommitExecuteJob()` function
   - Added `moveToDeadLetter()` function

5. **`server/supabase/schema.sql`**
   - Full schema with all Phase 3 tables
   - RLS policies for all new tables
   - Model governance and prompt registry tables

6. **`doc.md`**
   - Added Section 12: Testing Strategy
   - Added Section 13: Backup & Disaster Recovery
   - Added Section 14: Secret Management
   - Added Section 15: Data Retention Policies
   - Updated "High-Risk Truths" with 2 new points

---

## Database Schema

### New Tables

| Table | Purpose |
|-------|---------|
| `dataset_versions` | Immutable snapshots of uploaded datasets for shadow execution |
| `shadow_runs` | Execution records for shadow runs with status and summary |
| `shadow_diffs` | Cell/row-level diffs showing before/after values |
| `operation_plans` | AI-generated plans with lifecycle status tracking |
| `dead_letter_jobs` | Failed jobs with error details for admin replay |
| `tenant_model_budgets` | Model cost budget tracking per tenant |
| `role_model_policies` | Allowed models per role + token limits |
| `model_invocations` | Detailed model invocation logs with cost |
| `prompt_registry` | Versioned prompt templates |
| `prompt_bindings` | Maps pipeline stages to active prompt versions |

### RLS Policies

All new tables have Row Level Security enabled with tenant isolation policies:
- `tenant_isolation_select_*` - Tenants can only read their own data
- `tenant_isolation_write_*` - Tenants can only write their own data
- `tenant_isolation_update_*` - Tenants can only update their own data

---

## Worker Flow

### Complete Async Pipeline

```
1. POST /api/ai/chat
   └─> enqueue ai_plan job

2. AI Worker (ai_plan)
   └─> run planning pipeline
   └─> create operation_plans row
   └─> enqueue validate_plan job

3. Validation Worker (validate_plan)
   └─> validate against policies
   └─> enqueue shadow_execute job

4. Shadow Worker (shadow_execute)
   └─> create dataset_versions snapshot
   └─> execute plan against shadow copy
   └─> compute diffs -> shadow_diffs
   └─> update operation_plans.status = 'shadow_completed'
   └─> enqueue commit_execute (if shadow success)

5. Client reviews preview
   └─> GET /api/ai/operations/:id/shadow-preview

6. Reviewer approves
   └─> POST /api/admin/operations/:id/approve

7. Execution Worker (commit_execute)
   └─> verify approval status
   └─> apply changes to canonical dataset
   └─> write audit_log entries
   └─> update operation_plans.status = 'executed'
```

---

## API Endpoints

### Shadow Preview

**`GET /api/ai/operations/:operationId/shadow-preview`**

Response:
```json
{
  "correlationId": "uuid",
  "operationId": "uuid",
  "shadowRunId": "uuid",
  "status": "success|failed|blocked",
  "completedAt": "timestamp",
  "errorMessage": "string|null",
  "summary": {
    "impactedCellsCount": 42,
    "highRiskCount": 3,
    "policyViolationCount": 0,
    "rowsAffected": 15
  },
  "diffs": [...],
  "canApprove": true
}
```

### Admin Operations

**`POST /api/admin/operations/:operationId/approve`**
- Body: `{ "approvedBy": "user@example.com" }`
- Requires: `admin` role
- Validates: shadow status = 'success', no policy violations

**`POST /api/admin/operations/:operationId/reject`**
- Body: `{ "rejectedBy": "user@example.com", "reason": "string" }`
- Requires: `admin` role

**`POST /api/admin/jobs/:jobId/replay`**
- Body: `{ "replayedBy": "user@example.com", "reason": "string" }`
- Requires: `admin` role
- Creates new job with `replay_parent_job_id` reference

**`GET /api/admin/dead-letters?limit=50&offset=0`**
- Lists failed jobs for review

**`GET /api/admin/operations?limit=50&offset=0&status=shadow_completed`**
- Lists operations with optional status filter

---

## Feature Flags

Phase 3 requires these environment variables:

```env
ASYNC_PIPELINE_ENABLED=true
ASYNC_WORKER_ENABLED=true
ASYNC_WORKER_EXECUTION_ENABLED=true
ASYNC_WORKER_POLL_MS=500
ASYNC_WORKER_BATCH_SIZE=5
```

---

## Migration Steps

1. **Run database migration:**
   ```bash
   npx supabase db push ./server/supabase/migrations/004_shadow_execution.sql
   ```
   Or apply via Supabase dashboard SQL editor.

2. **Enable feature flags** in `.env`:
   ```
   ASYNC_PIPELINE_ENABLED=true
   ASYNC_WORKER_ENABLED=true
   ASYNC_WORKER_EXECUTION_ENABLED=true
   ```

3. **Restart server** to load new workers:
   ```bash
   npm run dev
   ```

4. **Verify workers started:**
   ```
   [startup] providers: claude=true groq=true openrouter=true supabase=true
   ```

5. **Test shadow execution:**
   - Upload a file via `/api/files`
   - Send AI request via `/api/ai/chat`
   - Check operation status: `GET /api/ai/operations/:id/shadow-preview`

---

## Next Steps (Phase 4+)

- **Phase 4: RLS Enforcement**
  - Backfill `tenant_id` in all existing rows
  - Enable RLS in report-only mode (log denials)
  - Switch runtime DB user to non-bypass role
  - Turn on hard RLS enforcement

- **Phase 5: Prompt Registry + Model Governance**
  - Migrate inline prompts to registry
  - Add budget/token/model policy checks
  - Enforce quotas tenant by tenant

- **Phase 6: Event Bus + Realtime**
  - Implement outbox dispatcher
  - Deploy NATS JetStream
  - WebSocket gateway for client subscriptions

- **Phase 7: Full Async Cutover**
  - Remove synchronous AI execution path
  - Remove in-memory critical fallbacks
  - Decommission deprecated endpoints

---

## Testing Checklist

- [ ] Shadow worker creates dataset version on `shadow_execute` job
- [ ] Shadow diffs computed correctly for cell updates
- [ ] High-risk diffs flagged with `is_high_risk: true`
- [ ] Policy violations block approval (`canApprove: false`)
- [ ] Shadow preview endpoint returns complete diff data
- [ ] Admin approve endpoint validates shadow status
- [ ] Admin reject endpoint logs workflow transition
- [ ] Execution worker applies changes and writes audit log
- [ ] Dead letter jobs can be replayed via admin endpoint
- [ ] RLS policies prevent cross-tenant reads
