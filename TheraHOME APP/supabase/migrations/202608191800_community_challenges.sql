-- Phase 3 of the Community expansion: challenges. Completion is
-- self-declared once the user's streak reaches target_streak_days (checked
-- client-side against user_programs.streak, which already exists) rather
-- than detected by a server-side job — simplest correct thing for V1.
create table if not exists public.challenges (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  icon text not null default '🔥',
  start_date date not null default current_date,
  end_date date,
  target_streak_days integer not null default 7,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null
);

alter table public.challenges enable row level security;

drop policy if exists "public read active challenges" on public.challenges;
create policy "public read active challenges"
on public.challenges for select to authenticated
using (active = true or 'admin' = any(public.current_web_roles()));

drop policy if exists "web admin manage challenges" on public.challenges;
create policy "web admin manage challenges"
on public.challenges for all to authenticated
using ('admin' = any(public.current_web_roles()))
with check ('admin' = any(public.current_web_roles()));

create table if not exists public.challenge_participants (
  id uuid primary key default gen_random_uuid(),
  challenge_id uuid not null references public.challenges(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  joined_at timestamptz not null default now(),
  completed_at timestamptz,
  unique (challenge_id, user_id)
);

alter table public.challenge_participants enable row level security;

drop policy if exists "users read own participation" on public.challenge_participants;
create policy "users read own participation"
on public.challenge_participants for select to authenticated
using (user_id = (select auth.uid()) or 'admin' = any(public.current_web_roles()));

drop policy if exists "users join challenges" on public.challenge_participants;
create policy "users join challenges"
on public.challenge_participants for insert to authenticated
with check (user_id = (select auth.uid()));

-- Marking completion is still self-declared, but restricted to the
-- streak actually being long enough at the time of the update (mirrors the
-- 7/14/21/28 thresholds complete_day already checks) — a client can't just
-- set completed_at without having earned it.
drop policy if exists "users mark own completion" on public.challenge_participants;
create policy "users mark own completion"
on public.challenge_participants for update to authenticated
using (user_id = (select auth.uid()))
with check (
  user_id = (select auth.uid())
  and exists (
    select 1 from public.user_programs program
    where program.user_id = (select auth.uid())
      and program.streak >= (select target_streak_days from public.challenges c where c.id = challenge_participants.challenge_id)
  )
);

create index if not exists challenge_participants_challenge_idx on public.challenge_participants(challenge_id);

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'challenge_participants'
  ) then
    alter publication supabase_realtime add table public.challenge_participants;
  end if;
end $$;
