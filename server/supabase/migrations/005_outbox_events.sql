-- Add transactional outbox events table
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

alter table public.outbox_events enable row level security;

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
