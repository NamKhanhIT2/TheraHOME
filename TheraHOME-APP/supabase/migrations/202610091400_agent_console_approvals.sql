-- Chờ duyệt — the Agent console's approval gate, made durable.
--
-- The console (TheraHOME-WEB `/agent`) exists for one rule: an agent may
-- PREPARE a change that spends advertising money or alters what customers are
-- told, but a person releases it. Until now that decision lived in React
-- state and was gone on reload, which made the gate a demonstration rather
-- than a control.
--
-- Shape: the whole proposal lives here, not just its verdict. Agents will
-- insert rows; the console reads and decides them. `evidence` is jsonb because
-- it is a short list of label/value pairs whose shape differs per proposal
-- (an ad spend and a CPA for a budget case, a phrase and a channel for a
-- content one) — modelling it as columns would mean a migration per new kind
-- of proposal.
--
-- `id` is text rather than a uuid so an agent can give a proposal a stable,
-- idempotent key (one "pause this campaign" row per campaign per day) and
-- re-running its analysis does not pile up duplicates.
--
-- Access: admin only. The console is admin-gated already, and `cskh` has no
-- business approving an advertising change — this is deliberately narrower
-- than the `admin or cskh` policies most tables here carry.
create table if not exists public.agent_approvals (
  id text primary key,
  kind text not null check (kind in ('budget', 'content')),
  title text not null,
  agent text not null,
  reason text not null,
  from_value text not null,
  to_value text not null,
  target text not null,
  evidence jsonb not null default '[]'::jsonb,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  decided_by uuid references auth.users(id) on delete set null,
  decided_at timestamptz,
  created_at timestamptz not null default now()
);

-- The console's only hot query is "what is still waiting", and the sidebar
-- badge runs it on every page load.
create index if not exists agent_approvals_pending_idx
  on public.agent_approvals (created_at desc)
  where status = 'pending';

alter table public.agent_approvals enable row level security;

drop policy if exists "web admin manages agent_approvals" on public.agent_approvals;
create policy "web admin manages agent_approvals"
  on public.agent_approvals for all
  to authenticated
  using ('admin' = any (current_web_roles()))
  with check ('admin' = any (current_web_roles()));

-- Who decided, and when, is recorded by the database rather than sent by the
-- client. An audit trail the client fills in is not an audit trail.
create or replace function public.agent_approvals_stamp_decision()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.status is distinct from old.status and new.status <> 'pending' then
    new.decided_by := auth.uid();
    new.decided_at := now();
  end if;
  return new;
end;
$$;

drop trigger if exists agent_approvals_stamp_decision on public.agent_approvals;
create trigger agent_approvals_stamp_decision
  before update on public.agent_approvals
  for each row execute function public.agent_approvals_stamp_decision();

-- No seed row here on purpose. The console's first proposal was written
-- straight into the table through the connector instead, because seeding it
-- from a migration would put this account's campaign spend and CPA into the
-- repository — the same reason the console's other figures live in
-- agent_metrics_* rather than in a source file. A demo proposal is data, not
-- schema, and a migration is the wrong place for it either way.
