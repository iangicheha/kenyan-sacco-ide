-- Pending operations proposed by AI and reviewed by analyst
create table if not exists public.pending_operations (
  id uuid primary key,
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
  on public.pending_operations (session_id, status);

-- Immutable audit trail for accepted operations
create table if not exists public.audit_log (
  id bigserial primary key,
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
  on public.audit_log (session_id, timestamp desc);

create index if not exists idx_audit_log_correlation_id
  on public.audit_log (correlation_id);

-- Orchestrator stage telemetry events
create table if not exists public.orchestrator_events (
  id bigserial primary key,
  correlation_id text not null,
  session_id text not null,
  stage text not null,
  status text not null check (status in ('ok', 'failed', 'fallback')),
  duration_ms integer,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_orchestrator_events_session_created
  on public.orchestrator_events (session_id, created_at desc);

create index if not exists idx_orchestrator_events_correlation
  on public.orchestrator_events (correlation_id);

-- Workflow lifecycle state transitions
create table if not exists public.workflow_transitions (
  id bigserial primary key,
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
  on public.workflow_transitions (session_id, timestamp desc);

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
