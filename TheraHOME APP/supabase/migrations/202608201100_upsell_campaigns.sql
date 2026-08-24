-- Scheduled marketing / upsell campaigns created from the Admin website.
-- Delivery is performed by the dispatch-upsell-campaigns Edge Function; this
-- table is deliberately separate from notifications, whose rows are each a
-- recipient's inbox item rather than a campaign record.
create table if not exists public.upsell_campaigns (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(trim(title)) between 1 and 120),
  body text not null check (char_length(trim(body)) between 1 and 500),
  target text not null default 'all',
  scheduled_for timestamptz not null,
  status text not null default 'scheduled' check (status in ('scheduled', 'processing', 'sent', 'cancelled')),
  processing_started_at timestamptz,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  recipient_count integer not null default 0 check (recipient_count >= 0)
);

create index if not exists upsell_campaigns_due_idx
  on public.upsell_campaigns (status, scheduled_for)
  where status = 'scheduled';

-- A run can be interrupted after creating inbox rows but before completing
-- its push request. Retain the campaign id on those rows so a later retry is
-- idempotent and never shows the same Upsale twice in the in-app bell.
alter table public.notifications
  add column if not exists upsell_campaign_id uuid references public.upsell_campaigns(id) on delete set null;

create unique index if not exists notifications_user_upsell_campaign_unique
  on public.notifications (user_id, upsell_campaign_id)
  where upsell_campaign_id is not null;

-- `now()` cannot be used in a CHECK constraint, so enforce the 30-day
-- product requirement in a trigger whenever a schedule is set or changed.
create or replace function public.validate_upsell_campaign_schedule()
returns trigger
language plpgsql
as $$
begin
  if new.scheduled_for < now() - interval '5 minutes' then
    raise exception 'scheduled_for must be in the future';
  end if;
  if new.scheduled_for > now() + interval '30 days' then
    raise exception 'Upsell campaigns may be scheduled at most 30 days ahead';
  end if;
  return new;
end;
$$;

drop trigger if exists validate_upsell_campaign_schedule on public.upsell_campaigns;
create trigger validate_upsell_campaign_schedule
before insert or update of scheduled_for on public.upsell_campaigns
for each row execute function public.validate_upsell_campaign_schedule();

alter table public.upsell_campaigns enable row level security;

drop policy if exists "web admin manage upsell campaigns" on public.upsell_campaigns;
create policy "web admin manage upsell campaigns"
on public.upsell_campaigns for all to authenticated
using ('admin' = any(public.current_web_roles()))
with check ('admin' = any(public.current_web_roles()));
