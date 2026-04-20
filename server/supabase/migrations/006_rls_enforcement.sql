-- Migration 006: Phase 4 RLS Enforcement
-- Enables Row Level Security on all core tables with tenant isolation policies

-- Core Phase 1/2 tables that need RLS
alter table public.pending_operations enable row level security;
alter table public.audit_log enable row level security;
alter table public.orchestrator_events enable row level security;
alter table public.workflow_transitions enable row level security;
alter table public.ai_requests enable row level security;
alter table public.async_jobs enable row level security;
alter table public.policies enable row level security;
alter table public.policy_rules enable row level security;

-- Helper function to get current tenant from session
-- This function is used in RLS policies to enforce tenant isolation
create or replace function public.current_tenant_id()
returns text as $$
begin
  return current_setting('app.tenant_id', true);
end;
$$ language plpgsql security definer;

-- Helper function to get current user role from session
create or replace function public.current_user_role()
returns text as $$
begin
  return current_setting('app.user_role', true);
end;
$$ language plpgsql security definer;

-- Helper function to check if user is admin
create or replace function public.is_admin()
returns boolean as $$
begin
  return current_setting('app.user_role', true) = 'admin';
end;
$$ language plpgsql security definer;

-- Pending operations RLS policies
drop policy if exists tenant_isolation_select_pending_operations on public.pending_operations;
drop policy if exists tenant_isolation_write_pending_operations on public.pending_operations;
drop policy if exists tenant_isolation_update_pending_operations on public.pending_operations;
drop policy if exists tenant_isolation_delete_pending_operations on public.pending_operations;

create policy tenant_isolation_select_pending_operations
  on public.pending_operations for select
  using (tenant_id::text = public.current_tenant_id());

create policy tenant_isolation_write_pending_operations
  on public.pending_operations for insert
  with check (tenant_id::text = public.current_tenant_id());

create policy tenant_isolation_update_pending_operations
  on public.pending_operations for update
  using (tenant_id::text = public.current_tenant_id())
  with check (tenant_id::text = public.current_tenant_id());

create policy tenant_isolation_delete_pending_operations
  on public.pending_operations for delete
  using (tenant_id::text = public.current_tenant_id());

-- Audit log RLS policies (read-only for app users, append-only)
drop policy if exists tenant_isolation_select_audit_log on public.audit_log;
drop policy if exists tenant_isolation_write_audit_log on public.audit_log;

create policy tenant_isolation_select_audit_log
  on public.audit_log for select
  using (tenant_id::text = public.current_tenant_id());

create policy tenant_isolation_write_audit_log
  on public.audit_log for insert
  with check (tenant_id::text = public.current_tenant_id());

-- Orchestrator events RLS policies (read-only for app users)
drop policy if exists tenant_isolation_select_orchestrator_events on public.orchestrator_events;
drop policy if exists tenant_isolation_write_orchestrator_events on public.orchestrator_events;

create policy tenant_isolation_select_orchestrator_events
  on public.orchestrator_events for select
  using (tenant_id::text = public.current_tenant_id());

create policy tenant_isolation_write_orchestrator_events
  on public.orchestrator_events for insert
  with check (tenant_id::text = public.current_tenant_id());

-- Workflow transitions RLS policies
drop policy if exists tenant_isolation_select_workflow_transitions on public.workflow_transitions;
drop policy if exists tenant_isolation_write_workflow_transitions on public.workflow_transitions;

create policy tenant_isolation_select_workflow_transitions
  on public.workflow_transitions for select
  using (tenant_id::text = public.current_tenant_id());

create policy tenant_isolation_write_workflow_transitions
  on public.workflow_transitions for insert
  with check (tenant_id::text = public.current_tenant_id());

-- AI requests RLS policies
drop policy if exists tenant_isolation_select_ai_requests on public.ai_requests;
drop policy if exists tenant_isolation_write_ai_requests on public.ai_requests;
drop policy if exists tenant_isolation_update_ai_requests on public.ai_requests;

create policy tenant_isolation_select_ai_requests
  on public.ai_requests for select
  using (tenant_id::text = public.current_tenant_id());

create policy tenant_isolation_write_ai_requests
  on public.ai_requests for insert
  with check (tenant_id::text = public.current_tenant_id());

create policy tenant_isolation_update_ai_requests
  on public.ai_requests for update
  using (tenant_id::text = public.current_tenant_id())
  with check (tenant_id::text = public.current_tenant_id());

-- Async jobs RLS policies
drop policy if exists tenant_isolation_select_async_jobs on public.async_jobs;
drop policy if exists tenant_isolation_write_async_jobs on public.async_jobs;
drop policy if exists tenant_isolation_update_async_jobs on public.async_jobs;

create policy tenant_isolation_select_async_jobs
  on public.async_jobs for select
  using (tenant_id::text = public.current_tenant_id());

create policy tenant_isolation_write_async_jobs
  on public.async_jobs for insert
  with check (tenant_id::text = public.current_tenant_id());

create policy tenant_isolation_update_async_jobs
  on public.async_jobs for update
  using (tenant_id::text = public.current_tenant_id())
  with check (tenant_id::text = public.current_tenant_id());

-- Policies table RLS (admin can manage, all tenants can read active)
drop policy if exists tenant_isolation_select_policies on public.policies;
drop policy if exists tenant_isolation_write_policies on public.policies;

create policy tenant_isolation_select_policies
  on public.policies for select
  using (true); -- All tenants can read policies (they're shared configuration)

create policy tenant_isolation_write_policies
  on public.policies for all
  using (public.is_admin())
  with check (public.is_admin());

-- Policy rules table RLS
drop policy if exists tenant_isolation_select_policy_rules on public.policy_rules;
drop policy if exists tenant_isolation_write_policy_rules on public.policy_rules;

create policy tenant_isolation_select_policy_rules
  on public.policy_rules for select
  using (true);

create policy tenant_isolation_write_policy_rules
  on public.policy_rules for all
  using (public.is_admin())
  with check (public.is_admin());

-- Idempotency records RLS (no tenant_id column, use scope-based isolation)
-- Note: idempotency_records uses scope + key, no explicit tenant column
-- We'll keep it without RLS but with unique constraint on scope+key

-- Add tenant_id to idempotency_records for proper isolation
alter table public.idempotency_records
  add column if not exists tenant_id text not null default 'default';

alter table public.idempotency_records enable row level security;

drop policy if exists tenant_isolation_select_idempotency on public.idempotency_records;
drop policy if exists tenant_isolation_write_idempotency on public.idempotency_records;

create policy tenant_isolation_select_idempotency
  on public.idempotency_records for select
  using (tenant_id::text = public.current_tenant_id());

create policy tenant_isolation_write_idempotency
  on public.idempotency_records for insert
  with check (tenant_id::text = public.current_tenant_id());

-- Add tenant_id to uploads table if exists (for file uploads)
do $$
begin
  if exists (select 1 from information_schema.tables where table_name = 'uploads') then
    alter table public.uploads add column if not exists tenant_id text not null default 'default';
    alter table public.uploads enable row level security;

    drop policy if exists tenant_isolation_select_uploads on public.uploads;
    drop policy if exists tenant_isolation_write_uploads on public.uploads;

    create policy tenant_isolation_select_uploads
      on public.uploads for select
      using (tenant_id::text = public.current_tenant_id());

    create policy tenant_isolation_write_uploads
      on public.uploads for insert
      with check (tenant_id::text = public.current_tenant_id());
  end if;
end $$;

-- Create set_config wrapper for Supabase RPC compatibility
create or replace function public.set_config(
  key text,
  value text,
  is_local boolean default true
)
returns text as $$
begin
  return pg_catalog.set_config(key, value, is_local);
end;
$$ language plpgsql security definer;

-- Comments documenting RLS enforcement
comment on function public.current_tenant_id() is 'Returns the current tenant_id from session configuration. Used by RLS policies for tenant isolation.';
comment on function public.current_user_role() is 'Returns the current user role from session configuration. Used by RLS policies for role-based access.';
comment on function public.is_admin() is 'Returns true if current session user has admin role.';
comment on function public.set_config is 'Wrapper for pg_catalog.set_config to allow setting session variables via Supabase RPC.';
