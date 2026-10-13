-- "Chương trình tặng xu" (owner 2026-10-13): Plus and above earn 10 xu for
-- each training day they finish and claim, 10 more at each milestone, and at
-- 100 xu they can claim one physical gift, once in their life.
--
-- A LEDGER, not a balance column. Three reasons, all of which bite the column
-- version: the app has to show where the xu came from, a claim must be
-- impossible to repeat (which is a unique index on the ledger, not a race on
-- an UPDATE), and support has to be able to audit a claim without a story.

create table if not exists public.coin_settings (
  id boolean primary key default true check (id),
  active boolean not null default true,
  coins_per_day integer not null default 10,
  coins_per_streak integer not null default 10,
  streak_milestones integer[] not null default '{7,14}',
  gift_threshold integer not null default 100,
  -- Which plans may take part. Edited here rather than hardcoded so the
  -- programme can be opened to Premium without a migration.
  plan_codes text[] not null default '{premium_plus,premium_lifetime}',
  updated_at timestamptz not null default now()
);
insert into public.coin_settings (id) values (true) on conflict (id) do nothing;

comment on table public.coin_settings is
  'One row. The numbers behind the xu programme, so tuning the threshold is an UPDATE rather than a migration.';

alter table public.coin_settings enable row level security;
create policy "anyone reads coin_settings" on public.coin_settings
  for select to authenticated using (true);
create policy "web admin writes coin_settings" on public.coin_settings
  for all to authenticated
  using ('admin' = any (public.current_web_roles()))
  with check ('admin' = any (public.current_web_roles()));

create table if not exists public.coin_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  amount integer not null,
  kind text not null check (kind in ('day', 'streak', 'admin')),
  user_program_id uuid references public.user_programs(id) on delete cascade,
  program_day_id uuid references public.program_days(id) on delete cascade,
  streak_milestone integer,
  note text,
  created_at timestamptz not null default now()
);

comment on table public.coin_entries is
  'Every xu ever granted, one row each. Balance is the sum; nothing stores a running total.';

-- The two indexes that make a double claim impossible rather than unlikely.
create unique index if not exists coin_entries_day_once
  on public.coin_entries (user_id, program_day_id) where kind = 'day';
create unique index if not exists coin_entries_streak_once
  on public.coin_entries (user_id, user_program_id, streak_milestone) where kind = 'streak';
create index if not exists coin_entries_user_idx on public.coin_entries (user_id, created_at desc);

alter table public.coin_entries enable row level security;
create policy "read own coin_entries" on public.coin_entries
  for select to authenticated
  using (user_id = (select auth.uid())
         or 'admin' = any (public.current_web_roles())
         or 'cskh' = any (public.current_web_roles()));
-- No INSERT policy: every row comes from a SECURITY DEFINER claim function,
-- because a client that could insert could mint its own xu.

create table if not exists public.coin_gift_claims (
  -- The primary key IS the rule: one gift per person, for ever, enforced by
  -- the database rather than by whoever is reading the spreadsheet.
  user_id uuid primary key references auth.users(id) on delete cascade,
  claimed_at timestamptz not null default now(),
  balance_at_claim integer not null,
  fulfilled_at timestamptz,
  fulfilled_by uuid references auth.users(id) on delete set null,
  note text
);

alter table public.coin_gift_claims enable row level security;
create policy "read own coin_gift_claims" on public.coin_gift_claims
  for select to authenticated
  using (user_id = (select auth.uid())
         or 'admin' = any (public.current_web_roles())
         or 'cskh' = any (public.current_web_roles()));
create policy "web staff fulfil coin_gift_claims" on public.coin_gift_claims
  for update to authenticated
  using ('admin' = any (public.current_web_roles()) or 'cskh' = any (public.current_web_roles()))
  with check ('admin' = any (public.current_web_roles()) or 'cskh' = any (public.current_web_roles()));

create or replace function public.coin_programme_eligible()
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.coin_settings s
     where s.id
       and s.active
       and (
         -- App Review sees every feature it did not buy, same rule as every
         -- other gate in this schema.
         exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.account_type = 'review')
         or public.active_plan_code() = any (s.plan_codes)
       )
  );
$$;

comment on function public.coin_programme_eligible() is
  'Does this account take part in the xu programme? Plus and above by default, plus App Review, which sees every feature it did not buy.';

create or replace function public.coin_balance()
returns integer
language sql stable security definer set search_path = public
as $$
  select coalesce(sum(amount), 0)::integer from public.coin_entries where user_id = (select auth.uid());
$$;

revoke execute on function public.coin_programme_eligible(), public.coin_balance() from public, anon;
grant execute on function public.coin_programme_eligible(), public.coin_balance() to authenticated;
