-- Pending operations proposed by AI and reviewed by analyst
create table if not exists public.pending_operations (
  id uuid primary key,
  tenant_id text not null default 'default',
  session_id text not null,
  cell_ref text not null,
  kind text not null check (kind in ('formula', 'value')),
  formula text,
  value jsonb,
  old_value jsonb,
  new_value_preview text not null,
  reasoning text not null,
  regulation_reference text,
  confidence double precision not null,
  status text not null check (status in ('pending', 'accepted', 'rejected')),
  created_at timestamptz not null default now()
);

create index if not exists idx_pending_operations_session_status
  on public.pending_operations (tenant_id, session_id, status);

-- Immutable audit trail for accepted operations
create table if not exists public.audit_log (
  id bigserial primary key,
  tenant_id text not null default 'default',
  operation_id uuid not null,
  session_id text not null,
  cell_ref text not null,
  formula_applied text,
  values_written jsonb not null,
  analyst text not null,
  timestamp timestamptz not null,
  ai_reasoning text not null,
  correlation_id text
);

create index if not exists idx_audit_log_session_timestamp
  on public.audit_log (tenant_id, session_id, timestamp desc);

create index if not exists idx_audit_log_correlation_id
  on public.audit_log (correlation_id);

-- Orchestrator stage telemetry events
create table if not exists public.orchestrator_events (
  id bigserial primary key,
  tenant_id text not null default 'default',
  correlation_id text not null,
  session_id text not null,
  stage text not null,
  status text not null check (status in ('ok', 'failed', 'fallback')),
  duration_ms integer,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_orchestrator_events_session_created
  on public.orchestrator_events (tenant_id, session_id, created_at desc);

create index if not exists idx_orchestrator_events_correlation
  on public.orchestrator_events (correlation_id);

-- Workflow lifecycle state transitions
create table if not exists public.workflow_transitions (
  id bigserial primary key,
  tenant_id text not null default 'default',
  session_id text not null,
  operation_id uuid,
  correlation_id text not null,
  from_state text,
  to_state text not null check (
    to_state in ('draft', 'pending_review', 'accepted', 'rejected', 'executed', 'failed', 'closed')
  ),
  actor text not null,
  reason text,
  timestamp timestamptz not null default now()
);

create index if not exists idx_workflow_transitions_session_timestamp
  on public.workflow_transitions (tenant_id, session_id, timestamp desc);

create index if not exists idx_workflow_transitions_operation
  on public.workflow_transitions (operation_id, timestamp desc);

-- Idempotency records for mutation endpoints
create table if not exists public.idempotency_records (
  id bigserial primary key,
  scope text not null,
  idempotency_key text not null,
  status_code integer not null,
  response_body jsonb not null,
  created_at timestamptz not null default now(),
  unique (scope, idempotency_key)
);

create index if not exists idx_idempotency_records_created
  on public.idempotency_records (created_at desc);

-- Bring schema in sync with application-level policy/audit metadata.
alter table public.pending_operations
  add column if not exists policy_version text,
  add column if not exists policy_id uuid;

alter table public.audit_log
  add column if not exists policy_version text,
  add column if not exists policy_id uuid;

-- DB-driven policy engine with effective version ranges
create table if not exists public.policy_rules (
  id uuid primary key,
  regulator text not null check (regulator in ('CBK', 'SASRA', 'IRA', 'RBA', 'CMA')),
  version text not null,
  rules jsonb not null default '{}'::jsonb,
  effective_from timestamptz not null,
  effective_to timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_policy_rules_regulator_effective
  on public.policy_rules (regulator, effective_from desc);

-- Phase 2: Versioned policies table (preferred over policy_rules).
create table if not exists public.policies (
  id uuid primary key,
  regulator text not null check (regulator in ('CBK', 'SASRA', 'IRA', 'RBA', 'CMA')),
  version text not null,
  rules_json jsonb not null default '{}'::jsonb,
  effective_from timestamptz not null,
  effective_to timestamptz,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists idx_policies_regulator_effective
  on public.policies (regulator, effective_from desc);

create index if not exists idx_policies_regulator_active_effective
  on public.policies (regulator, is_active, effective_from desc);

-- Phase 1 async pipeline scaffolding
create table if not exists public.ai_requests (
  id uuid primary key,
  tenant_id text not null default 'default',
  session_id text not null,
  correlation_id text not null,
  prompt text not null,
  regulator text not null check (regulator in ('CBK', 'SASRA', 'IRA', 'RBA', 'CMA')),
  status text not null check (status in ('queued', 'processing', 'completed', 'failed')),
  created_at timestamptz not null default now()
);

create index if not exists idx_ai_requests_tenant_session_created
  on public.ai_requests (tenant_id, session_id, created_at desc);

create index if not exists idx_ai_requests_status_created
  on public.ai_requests (status, created_at desc);

create table if not exists public.async_jobs (
  id uuid primary key,
  tenant_id text not null default 'default',
  request_id uuid not null references public.ai_requests(id) on delete cascade,
  correlation_id text not null,
  session_id text not null,
  operation_id uuid,
  job_type text not null check (job_type in ('ai_plan', 'validate_plan', 'shadow_execute', 'commit_execute', 'notify')),
  status text not null check (status in ('queued', 'processing', 'completed', 'failed', 'dead_lettered')),
  priority integer not null default 1,
  attempt integer not null default 0,
  max_attempts integer not null default 5,
  scheduled_at timestamptz not null default now(),
  payload jsonb not null default '{}'::jsonb,
  created_by text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_async_jobs_status_scheduled
  on public.async_jobs (status, scheduled_at asc);

create index if not exists idx_async_jobs_request
  on public.async_jobs (request_id, created_at desc);

-- Phase 3: Shadow Execution Layer
-- Dataset version snapshots for shadow execution
create table if not exists public.dataset_versions (
  version_id uuid primary key,
  tenant_id text not null default 'default',
  source_upload_id uuid not null,
  sheet_name text not null,
  checksum text not null,
  storage_uri text not null,
  row_count integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists idx_dataset_versions_tenant_created
  on public.dataset_versions (tenant_id, created_at desc);

create index if not exists idx_dataset_versions_source
  on public.dataset_versions (source_upload_id);

-- Shadow execution runs
create table if not exists public.shadow_runs (
  shadow_run_id uuid primary key,
  tenant_id text not null default 'default',
  operation_id uuid not null,
  dataset_version_id uuid not null references public.dataset_versions(version_id) on delete cascade,
  status text not null check (status in ('pending', 'running', 'success', 'failed', 'blocked')),
  summary_json jsonb not null default '{}'::jsonb,
  error_message text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_shadow_runs_operation
  on public.shadow_runs (operation_id, created_at desc);

create index if not exists idx_shadow_runs_tenant_status
  on public.shadow_runs (tenant_id, status, created_at desc);

-- Shadow execution diffs (cell/row level changes)
create table if not exists public.shadow_diffs (
  id bigserial primary key,
  shadow_run_id uuid not null references public.shadow_runs(shadow_run_id) on delete cascade,
  tenant_id text not null default 'default',
  sheet text not null,
  cell_ref text,
  row_id uuid,
  column_name text,
  before_value jsonb,
  after_value jsonb,
  diff_type text not null check (diff_type in ('insert', 'update', 'delete', 'formula_change')),
  is_high_risk boolean not null default false,
  policy_violation boolean not null default false,
  policy_violation_reason text
);

create index if not exists idx_shadow_diffs_shadow_run
  on public.shadow_diffs (shadow_run_id);

create index if not exists idx_shadow_diffs_tenant
  on public.shadow_diffs (tenant_id, shadow_run_id);

create index if not exists idx_shadow_diffs_high_risk
  on public.shadow_diffs (tenant_id, is_high_risk, shadow_run_id)
  where is_high_risk = true;

-- Add shadow-related columns to operation_plans (if not exists)
create table if not exists public.operation_plans (
  id uuid primary key,
  tenant_id text not null default 'default',
  session_id text not null,
  request_id uuid not null,
  job_id uuid not null,
  correlation_id text not null,
  status text not null check (status in ('draft', 'validated', 'shadow_completed', 'awaiting_approval', 'approved', 'rejected', 'executed', 'failed')),
  plan_json jsonb not null default '{}'::jsonb,
  validation_result jsonb,
  shadow_run_id uuid references public.shadow_runs(shadow_run_id),
  approved_by text,
  approved_at timestamptz,
  executed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_operation_plans_tenant_status
  on public.operation_plans (tenant_id, status, created_at desc);

create index if not exists idx_operation_plans_request
  on public.operation_plans (request_id, created_at desc);

-- Dead letter queue for failed jobs
create table if not exists public.dead_letter_jobs (
  id uuid primary key,
  original_job_id uuid not null,
  tenant_id text not null default 'default',
  job_type text not null,
  failed_stage text not null,
  error_code text,
  error_message text not null,
  stack_trace text,
  last_payload jsonb not null default '{}'::jsonb,
  original_created_at timestamptz not null,
  dead_lettered_at timestamptz not null default now(),
  replay_parent_job_id uuid,
  replay_reason text,
  replayed_by text
);

create index if not exists idx_dead_letter_jobs_failed_stage
  on public.dead_letter_jobs (failed_stage, dead_lettered_at desc);

create index if not exists idx_dead_letter_jobs_tenant
  on public.dead_letter_jobs (tenant_id, dead_lettered_at desc);

-- Model governance tables
create table if not exists public.tenant_model_budgets (
  id uuid primary key,
  tenant_id text not null unique,
  monthly_budget_usd numeric(10,2) not null default 0,
  spent_usd numeric(10,2) not null default 0,
  reset_date date not null default (date_trunc('month', current_date) + interval '1 month'),
  updated_at timestamptz not null default now()
);

create index if not exists idx_tenant_model_budgets_tenant
  on public.tenant_model_budgets (tenant_id);

create table if not exists public.role_model_policies (
  id uuid primary key,
  role text not null,
  action_type text not null,
  allowed_models jsonb not null default '[]'::jsonb,
  max_input_tokens integer not null default 4096,
  max_output_tokens integer not null default 1024,
  created_at timestamptz not null default now()
);

create index if not exists idx_role_model_policies_role_action
  on public.role_model_policies (role, action_type);

create table if not exists public.model_invocations (
  id bigserial primary key,
  tenant_id text not null default 'default',
  session_id text not null,
  correlation_id text not null,
  prompt_id text not null,
  prompt_version integer not null,
  model_provider text not null,
  model_name text not null,
  input_tokens integer not null,
  output_tokens integer not null,
  total_tokens integer not null,
  cost_usd numeric(10,6) not null default 0,
  latency_ms integer not null,
  status text not null check (status in ('success', 'failed', 'timeout')),
  error_message text,
  created_at timestamptz not null default now()
);

create index if not exists idx_model_invocations_tenant_created
  on public.model_invocations (tenant_id, created_at desc);

create index if not exists idx_model_invocations_correlation
  on public.model_invocations (correlation_id);

-- Prompt registry tables
create table if not exists public.prompt_registry (
  id bigserial primary key,
  prompt_id text not null,
  version integer not null,
  template text not null,
  input_schema jsonb not null default '{}'::jsonb,
  output_schema jsonb not null default '{}'::jsonb,
  model_hints jsonb,
  status text not null check (status in ('draft', 'active', 'deprecated')) default 'draft',
  created_by text not null,
  created_at timestamptz not null default now(),
  change_note text
);

create unique index if not exists idx_prompt_registry_id_version
  on public.prompt_registry (prompt_id, version);

create index if not exists idx_prompt_registry_status
  on public.prompt_registry (status, prompt_id);

create table if not exists public.prompt_bindings (
  id uuid primary key,
  stage text not null unique,
  active_prompt_version_id bigint not null references public.prompt_registry(id),
  updated_by text not null,
  updated_at timestamptz not null default now()
);

create index if not exists idx_prompt_bindings_stage
  on public.prompt_bindings (stage);

create table if not exists public.outbox_events (
  id bigserial primary key,
  event_type text not null,
  tenant_id text not null default 'default',
  session_id text not null,
  correlation_id text not null,
  payload jsonb not null default '{}'::jsonb,
  status text not null check (status in ('pending', 'delivered', 'failed')) default 'pending',
  created_at timestamptz not null default now(),
  delivered_at timestamptz
);

create index if not exists idx_outbox_events_status_created
  on public.outbox_events (status, created_at asc);

create index if not exists idx_outbox_events_tenant_created
  on public.outbox_events (tenant_id, created_at desc);

-- RLS Policies for Shadow Execution tables
alter table public.dataset_versions enable row level security;
alter table public.shadow_runs enable row level security;
alter table public.shadow_diffs enable row level security;
alter table public.operation_plans enable row level security;
alter table public.dead_letter_jobs enable row level security;
alter table public.model_invocations enable row level security;
alter table public.prompt_registry enable row level security;
alter table public.prompt_bindings enable row level security;
alter table public.outbox_events enable row level security;

-- Dataset versions RLS
create policy tenant_isolation_select_dataset_versions
  on public.dataset_versions for select
  using (tenant_id::text = current_setting('app.tenant_id', true));

create policy tenant_isolation_write_dataset_versions
  on public.dataset_versions for insert
  with check (tenant_id::text = current_setting('app.tenant_id', true));

-- Shadow runs RLS
create policy tenant_isolation_select_shadow_runs
  on public.shadow_runs for select
  using (tenant_id::text = current_setting('app.tenant_id', true));

create policy tenant_isolation_write_shadow_runs
  on public.shadow_runs for insert
  with check (tenant_id::text = current_setting('app.tenant_id', true));

create policy tenant_isolation_update_shadow_runs
  on public.shadow_runs for update
  using (tenant_id::text = current_setting('app.tenant_id', true))
  with check (tenant_id::text = current_setting('app.tenant_id', true));

-- Shadow diffs RLS
create policy tenant_isolation_select_shadow_diffs
  on public.shadow_diffs for select
  using (tenant_id::text = current_setting('app.tenant_id', true));

create policy tenant_isolation_write_shadow_diffs
  on public.shadow_diffs for insert
  with check (tenant_id::text = current_setting('app.tenant_id', true));

-- Operation plans RLS
create policy tenant_isolation_select_operation_plans
  on public.operation_plans for select
  using (tenant_id::text = current_setting('app.tenant_id', true));

create policy tenant_isolation_write_operation_plans
  on public.operation_plans for insert
  with check (tenant_id::text = current_setting('app.tenant_id', true));

create policy tenant_isolation_update_operation_plans
  on public.operation_plans for update
  using (tenant_id::text = current_setting('app.tenant_id', true))
  with check (tenant_id::text = current_setting('app.tenant_id', true));

-- Dead letter jobs RLS
create policy tenant_isolation_select_dead_letter_jobs
  on public.dead_letter_jobs for select
  using (tenant_id::text = current_setting('app.tenant_id', true));

create policy tenant_isolation_write_dead_letter_jobs
  on public.dead_letter_jobs for insert
  with check (tenant_id::text = current_setting('app.tenant_id', true));

-- Model invocations RLS
create policy tenant_isolation_select_model_invocations
  on public.model_invocations for select
  using (tenant_id::text = current_setting('app.tenant_id', true));

create policy tenant_isolation_write_model_invocations
  on public.model_invocations for insert
  with check (tenant_id::text = current_setting('app.tenant_id', true));

-- Prompt registry RLS (read-only for app users)
create policy prompt_registry_select
  on public.prompt_registry for select
  using (true);

-- Prompt bindings RLS (read-only for app users)
create policy prompt_bindings_select
  on public.prompt_bindings for select
  using (true);

create policy tenant_isolation_select_outbox_events
  on public.outbox_events for select
  using (tenant_id::text = current_setting('app.tenant_id', true));

create policy tenant_isolation_write_outbox_events
  on public.outbox_events for insert
  with check (tenant_id::text = current_setting('app.tenant_id', true));

create policy tenant_isolation_update_outbox_events
  on public.outbox_events for update
  using (tenant_id::text = current_setting('app.tenant_id', true))
  with check (tenant_id::text = current_setting('app.tenant_id', true));
