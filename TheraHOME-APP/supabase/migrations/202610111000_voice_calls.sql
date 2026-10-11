-- Gọi thoại CSKH — the signaling half of the voice-call feature.
--
-- LiveKit carries the audio; it does not carry "who is calling whom and did
-- they pick up". That state lives here, and Realtime on this table is what
-- makes the other side's phone light up. The split matters for cost: LiveKit
-- Cloud's free tier bills every minute a participant is CONNECTED to a room,
-- so neither side may join a room to wait. Waiting happens on this table
-- (free); a room is joined only once `status` reaches 'accepted'.
--
-- One line, one agent. TheraHOME has a single CSKH line, so at most one call
-- may be live at a time. That is not enforced by a read-then-insert in the
-- client — two customers tapping "Gọi" in the same second would both read
-- "free" and both get through. It is enforced by `calls_one_live_line` below,
-- a partial unique index over the rows that hold the line, so the second
-- insert loses to a unique violation inside the same transaction.
--
-- `holds_line` is what that index keys on rather than a constant, so a row
-- can be exempted from the single-line rule by setting it false. The only
-- caller that does is `start_call` for an App Review account, per the
-- standing rule that account_type 'review' bypasses every gate (see
-- 202609031100_review_accounts_unrestricted.sql). A reviewer must never be
-- told "đang bận" because a real customer happens to be on the line.

create table if not exists public.calls (
  id uuid primary key default gen_random_uuid(),
  -- The LiveKit room. Derived from `id` rather than reused across calls, so a
  -- participant that the media server has not finished timing out from the
  -- previous call cannot leak into the next one.
  room_name text not null unique,
  caller_id uuid not null references auth.users (id) on delete cascade,
  -- Which staff account answered. Null while ringing, and still null for a
  -- call nobody took.
  answered_by uuid references auth.users (id) on delete set null,
  -- The human thread this call belongs to, so a call can be shown in context
  -- and CSKH can read the conversation while the phone rings.
  thread_id uuid references public.chat_threads (id) on delete set null,
  status text not null default 'ringing'
    check (status in ('ringing', 'accepted', 'declined', 'missed', 'busy', 'ended')),
  -- False only for calls that are deliberately exempt from the one-line rule.
  holds_line boolean not null default true,
  -- Why it stopped, for the call log: 'hangup' (someone pressed end),
  -- 'timeout' (rang out), 'declined', 'busy', 'failed' (media never came up).
  end_reason text,
  created_at timestamptz not null default now(),
  answered_at timestamptz,
  ended_at timestamptz,
  duration_seconds integer
);

-- At most one row may hold the line. Unique over a single-valued column
-- restricted to exactly the rows that are live: ringing (the phone is
-- audibly busy) and accepted (someone is talking).
create unique index if not exists calls_one_live_line
  on public.calls (holds_line)
  where holds_line and status in ('ringing', 'accepted');

-- The CSKH list reads "today's calls, newest first"; the customer screen
-- reads one row by id (the primary key already covers that).
create index if not exists calls_recent_idx on public.calls (created_at desc);
create index if not exists calls_caller_idx on public.calls (caller_id, created_at desc);

alter table public.calls enable row level security;

-- A customer sees only their own calls. Staff see all of them — same shape as
-- the chat policies this sits next to.
drop policy if exists "caller or staff reads calls" on public.calls;
create policy "caller or staff reads calls"
  on public.calls for select
  to authenticated
  using (
    caller_id = (select auth.uid())
    or 'admin' = any (public.current_web_roles())
    or 'cskh' = any (public.current_web_roles())
  );

-- No INSERT or UPDATE policy on purpose. Every transition goes through the
-- three RPCs below, which own the state machine; a client that could write
-- this table directly could set itself 'accepted' without anyone answering,
-- or insert a row with holds_line = false and walk around the busy gate.

-- Realtime: both sides watch this table and nothing else. Without the
-- publication line the subscription joins, reports SUBSCRIBED and silently
-- receives nothing — the trap documented in CLAUDE.md that cost Phase 4 its
-- community realtime.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'calls'
  ) then
    alter publication supabase_realtime add table public.calls;
  end if;
end $$;

-- Realtime only delivers the columns the subscriber may read, and for an
-- UPDATE it needs the old row to evaluate that. Default REPLICA IDENTITY is
-- the primary key, which is enough for `postgres_changes` filters on id but
-- leaves `old_record` empty; the callers here compare against the new row
-- only, so the default is deliberately kept.

-- ---------------------------------------------------------------------------
-- start_call — the customer taps "Gọi CSKH".
--
-- Returns the created row, or a row with status 'busy' and no id when the
-- single line is already taken. Deliberately not an exception: "đang bận" is
-- an ordinary outcome the UI shows a friendly screen for, not an error.
-- ---------------------------------------------------------------------------
create or replace function public.start_call(p_thread_id uuid default null)
returns public.calls
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_holds_line boolean;
  v_id uuid := gen_random_uuid();
  v_call public.calls;
begin
  if v_user is null then
    raise exception 'auth_required' using errcode = '28000';
  end if;

  -- Review accounts never hold the line, so they are never refused and never
  -- refuse anyone else.
  select account_type <> 'review' into v_holds_line from profiles where id = v_user;
  v_holds_line := coalesce(v_holds_line, true);

  -- Anything still marked live but older than the ring timeout is a client
  -- that died mid-call — a force-quit, a dead battery, a tunnel. Clear those
  -- first, or one of them holds the line for everybody forever.
  perform public.expire_stale_calls();

  begin
    insert into calls (id, room_name, caller_id, thread_id, holds_line)
    values (v_id, 'call_' || replace(v_id::text, '-', ''), v_user, p_thread_id, v_holds_line)
    returning * into v_call;
  exception when unique_violation then
    -- The line is taken. Record the attempt so CSKH can see a call was
    -- missed while they were busy, and hand the UI a 'busy' row.
    insert into calls (room_name, caller_id, thread_id, status, holds_line, end_reason, ended_at)
    values ('call_' || replace(gen_random_uuid()::text, '-', ''), v_user, p_thread_id, 'busy', false, 'busy', now())
    returning * into v_call;
  end;

  return v_call;
end;
$$;

-- ---------------------------------------------------------------------------
-- answer_call — CSKH picks up. Staff only, and only while it is still ringing
-- (a call the caller already gave up on must not snap into 'accepted' after
-- the fact and start billing a room nobody is in).
-- ---------------------------------------------------------------------------
create or replace function public.answer_call(p_call_id uuid)
returns public.calls
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_call public.calls;
begin
  if not ('admin' = any (public.current_web_roles()) or 'cskh' = any (public.current_web_roles())) then
    raise exception 'staff_required' using errcode = '42501';
  end if;

  update calls
     set status = 'accepted', answered_by = v_user, answered_at = now()
   where id = p_call_id and status = 'ringing'
  returning * into v_call;

  if v_call.id is null then
    raise exception 'call_not_ringing' using errcode = 'P0002';
  end if;
  return v_call;
end;
$$;

-- ---------------------------------------------------------------------------
-- end_call — hang up, decline, or ring out. Either participant may call it,
-- which is why the terminal status is an argument: the customer's timer
-- reports 'missed', CSKH's decline button reports 'declined', and both hang-up
-- buttons report 'ended'.
--
-- Idempotent. A call already in a terminal state is returned unchanged rather
-- than raising, because both sides race to end the same call every time (one
-- presses the button, the other's screen unmounts).
-- ---------------------------------------------------------------------------
create or replace function public.end_call(p_call_id uuid, p_status text default 'ended', p_reason text default 'hangup')
returns public.calls
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_is_staff boolean := 'admin' = any (public.current_web_roles()) or 'cskh' = any (public.current_web_roles());
  v_call public.calls;
begin
  if p_status not in ('declined', 'missed', 'ended') then
    raise exception 'bad_status' using errcode = '22023';
  end if;

  select * into v_call from calls where id = p_call_id;
  if v_call.id is null then
    raise exception 'call_not_found' using errcode = 'P0002';
  end if;
  if not (v_is_staff or v_call.caller_id = v_user) then
    raise exception 'not_a_participant' using errcode = '42501';
  end if;
  if v_call.status in ('declined', 'missed', 'busy', 'ended') then
    return v_call;
  end if;

  update calls
     set status = p_status,
         end_reason = p_reason,
         ended_at = now(),
         duration_seconds = case
           when answered_at is not null then greatest(0, extract(epoch from (now() - answered_at))::integer)
           else 0
         end
   where id = p_call_id
  returning * into v_call;

  return v_call;
end;
$$;

-- ---------------------------------------------------------------------------
-- expire_stale_calls — the janitor that keeps the one line from being held by
-- a phone that is no longer there.
--
-- Two different timeouts, because the two states fail differently. A ringing
-- call that nobody answered within RING_TIMEOUT is simply missed. An accepted
-- call has no natural end — if the app was force-quit, no client will ever
-- send a hangup — so it is cut off after a generous ceiling. The ceiling is
-- long (2 hours) because the only cost of being wrong is one stuck row, while
-- cutting a real conversation short is a support incident.
--
-- Called at the top of `start_call`, so the line self-heals on the next
-- attempt without needing a cron job on the free plan.
-- ---------------------------------------------------------------------------
create or replace function public.expire_stale_calls()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  with expired as (
    update calls
       set status = case when status = 'ringing' then 'missed' else 'ended' end,
           end_reason = 'timeout',
           ended_at = now(),
           duration_seconds = case
             when answered_at is not null then greatest(0, extract(epoch from (now() - answered_at))::integer)
             else 0
           end
     where (status = 'ringing' and created_at < now() - interval '90 seconds')
        or (status = 'accepted' and answered_at < now() - interval '2 hours')
    returning 1
  )
  select count(*) into v_count from expired;
  return v_count;
end;
$$;

revoke all on function public.start_call(uuid) from public, anon;
revoke all on function public.answer_call(uuid) from public, anon;
revoke all on function public.end_call(uuid, text, text) from public, anon;
revoke all on function public.expire_stale_calls() from public, anon;
grant execute on function public.start_call(uuid) to authenticated;
grant execute on function public.answer_call(uuid) to authenticated;
grant execute on function public.end_call(uuid, text, text) to authenticated;
-- The janitor is meant to run only inside start_call's definer context, so it
-- is deliberately NOT granted to `authenticated` here. NOTE: the revoke above
-- is not sufficient on this project — a default privilege re-grants EXECUTE on
-- new public functions to `authenticated`, so it stayed exposed until
-- 202610111030_voice_calls_revoke_janitor_from_clients.sql revoked it from
-- that role by name.
