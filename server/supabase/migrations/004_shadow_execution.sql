-- Migration 004: Phase 3 Shadow Execution Layer
-- Run this migration to add shadow execution tables and RLS policies

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

-- Operation plans table for tracking AI-generated plans
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

-- Enable RLS on all new tables
alter table public.dataset_versions enable row level security;
alter table public.shadow_runs enable row level security;
alter table public.shadow_diffs enable row level security;
alter table public.operation_plans enable row level security;
alter table public.dead_letter_jobs enable row level security;
alter table public.model_invocations enable row level security;
alter table public.prompt_registry enable row level security;
alter table public.prompt_bindings enable row level security;

-- Dataset versions RLS
drop policy if exists tenant_isolation_select_dataset_versions on public.dataset_versions;
drop policy if exists tenant_isolation_write_dataset_versions on public.dataset_versions;
create policy tenant_isolation_select_dataset_versions
  on public.dataset_versions for select
  using (tenant_id::text = current_setting('app.tenant_id', true));
create policy tenant_isolation_write_dataset_versions
  on public.dataset_versions for insert
  with check (tenant_id::text = current_setting('app.tenant_id', true));

-- Shadow runs RLS
drop policy if exists tenant_isolation_select_shadow_runs on public.shadow_runs;
drop policy if exists tenant_isolation_write_shadow_runs on public.shadow_runs;
drop policy if exists tenant_isolation_update_shadow_runs on public.shadow_runs;
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
drop policy if exists tenant_isolation_select_shadow_diffs on public.shadow_diffs;
drop policy if exists tenant_isolation_write_shadow_diffs on public.shadow_diffs;
create policy tenant_isolation_select_shadow_diffs
  on public.shadow_diffs for select
  using (tenant_id::text = current_setting('app.tenant_id', true));
create policy tenant_isolation_write_shadow_diffs
  on public.shadow_diffs for insert
  with check (tenant_id::text = current_setting('app.tenant_id', true));

-- Operation plans RLS
drop policy if exists tenant_isolation_select_operation_plans on public.operation_plans;
drop policy if exists tenant_isolation_write_operation_plans on public.operation_plans;
drop policy if exists tenant_isolation_update_operation_plans on public.operation_plans;
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
drop policy if exists tenant_isolation_select_dead_letter_jobs on public.dead_letter_jobs;
drop policy if exists tenant_isolation_write_dead_letter_jobs on public.dead_letter_jobs;
create policy tenant_isolation_select_dead_letter_jobs
  on public.dead_letter_jobs for select
  using (tenant_id::text = current_setting('app.tenant_id', true));
create policy tenant_isolation_write_dead_letter_jobs
  on public.dead_letter_jobs for insert
  with check (tenant_id::text = current_setting('app.tenant_id', true));

-- Model invocations RLS
drop policy if exists tenant_isolation_select_model_invocations on public.model_invocations;
drop policy if exists tenant_isolation_write_model_invocations on public.model_invocations;
create policy tenant_isolation_select_model_invocations
  on public.model_invocations for select
  using (tenant_id::text = current_setting('app.tenant_id', true));
create policy tenant_isolation_write_model_invocations
  on public.model_invocations for insert
  with check (tenant_id::text = current_setting('app.tenant_id', true));

-- Prompt registry RLS (read-only for app users)
drop policy if exists prompt_registry_select on public.prompt_registry;
create policy prompt_registry_select
  on public.prompt_registry for select
  using (true);

-- Prompt bindings RLS (read-only for app users)
drop policy if exists prompt_bindings_select on public.prompt_bindings;
create policy prompt_bindings_select
  on public.prompt_bindings for select
  using (true);

-- Admin replay function for dead letter jobs
create or replace function public.replay_dead_letter_job(
  p_job_id uuid,
  p_reason text,
  p_replayed_by text
)
returns uuid as $$
declare
  v_original_job record;
  v_new_job_id uuid;
begin
  -- Get original job details
  select * into v_original_job
  from public.dead_letter_jobs
  where id = p_job_id;

  if not found then
    raise exception 'Dead letter job not found: %', p_job_id;
  end if;

  -- Generate new job ID
  v_new_job_id := gen_random_uuid();

  -- Insert replayed job into async_jobs
  insert into public.async_jobs (
    id, tenant_id, request_id, correlation_id, session_id,
    operation_id, job_type, status, priority, attempt,
    max_attempts, scheduled_at, payload, created_by, created_at
  ) values (
    v_new_job_id,
    v_original_job.tenant_id,
    v_original_job.tenant_id, -- request_id fallback
    v_original_job.tenant_id, -- correlation_id fallback
    v_original_job.tenant_id, -- session_id fallback
    null, -- operation_id to be determined by worker
    v_original_job.job_type,
    'queued',
    1,
    0,
    5,
    now(),
    v_original_job.last_payload,
    p_replayed_by,
    now()
  );

  -- Update dead letter record
  update public.dead_letter_jobs
  set
    replay_parent_job_id = v_new_job_id,
    replay_reason = p_reason,
    replayed_by = p_replayed_by
  where id = p_job_id;

  -- Log audit event
  insert into public.audit_log (
    tenant_id, operation_id, session_id, cell_ref, formula_applied,
    values_written, analyst, timestamp, ai_reasoning, correlation_id
  ) values (
    v_original_job.tenant_id,
    null,
    'admin_replay',
    'dead_letter_replay',
    null,
    jsonb_build_object('original_job_id', p_job_id, 'new_job_id', v_new_job_id),
    p_replayed_by,
    now(),
    p_reason,
    v_original_job.tenant_id
  );

  return v_new_job_id;
end;
$$ language plpgsql security definer;

-- Admin function to approve operation
create or replace function public.approve_operation(
  p_operation_id uuid,
  p_approved_by text
)
returns boolean as $$
declare
  v_operation record;
  v_shadow_status text;
begin
  -- Get operation with shadow run
  select op.*, sr.status as shadow_status
  into v_operation
  from public.operation_plans op
  left join public.shadow_runs sr on op.shadow_run_id = sr.shadow_run_id
  where op.id = p_operation_id;

  if not found then
    raise exception 'Operation not found: %', p_operation_id;
  end if;

  -- Check shadow status
  if v_operation.shadow_status is distinct from 'success' then
    raise exception 'Cannot approve: shadow execution status is %', v_operation.shadow_status;
  end if;

  -- Check for policy violations
  if exists (
    select 1 from public.shadow_diffs sd
    where sd.shadow_run_id = v_operation.shadow_run_id
    and sd.policy_violation = true
  ) then
    raise exception 'Cannot approve: operation has policy violations';
  end if;

  -- Update operation status
  update public.operation_plans
  set
    status = 'approved',
    approved_by = p_approved_by,
    approved_at = now(),
    updated_at = now()
  where id = p_operation_id;

  -- Log workflow transition
  insert into public.workflow_transitions (
    tenant_id, session_id, operation_id, correlation_id,
    from_state, to_state, actor, reason, timestamp
  ) values (
    v_operation.tenant_id,
    v_operation.session_id,
    p_operation_id,
    v_operation.correlation_id,
    'awaiting_approval',
    'approved',
    p_approved_by,
    'Manual approval by reviewer',
    now()
  );

  return true;
end;
$$ language plpgsql security definer;

-- Admin function to reject operation
create or replace function public.reject_operation(
  p_operation_id uuid,
  p_rejected_by text,
  p_reason text
)
returns boolean as $$
declare
  v_operation record;
begin
  -- Get operation
  select * into v_operation
  from public.operation_plans
  where id = p_operation_id;

  if not found then
    raise exception 'Operation not found: %', p_operation_id;
  end if;

  -- Update operation status
  update public.operation_plans
  set
    status = 'rejected',
    approved_by = p_rejected_by,
    approved_at = now(),
    updated_at = now()
  where id = p_operation_id;

  -- Log workflow transition
  insert into public.workflow_transitions (
    tenant_id, session_id, operation_id, correlation_id,
    from_state, to_state, actor, reason, timestamp
  ) values (
    v_operation.tenant_id,
    v_operation.session_id,
    p_operation_id,
    v_operation.correlation_id,
    'awaiting_approval',
    'rejected',
    p_rejected_by,
    p_reason,
    now()
  );

  return true;
end;
$$ language plpgsql security definer;
