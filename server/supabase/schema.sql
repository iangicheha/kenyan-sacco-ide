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
  ai_reasoning text not null
);

create index if not exists idx_audit_log_session_timestamp
  on public.audit_log (session_id, timestamp desc);
