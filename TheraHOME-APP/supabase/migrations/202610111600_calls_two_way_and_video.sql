-- Calls both ways, and with video.
--
-- What the first cut got wrong: it modelled "a customer rings the support
-- line" rather than "a call". So `caller_id` was always the customer, the
-- ringing side was always staff, and CSKH had no way to call a customer back
-- — which is half of what a support line does, and the first thing the owner
-- noticed was missing.
--
-- `callee_id` is the fix, and its NULL carries meaning:
--   NULL  → the call is to THE SUPPORT LINE. Any staff may answer. This is
--           the customer-initiated direction, unchanged.
--   set   → the call is to THAT PERSON. Only they may answer. This is how
--           CSKH calls a customer back.
--
-- `media` is 'audio' or 'video'. On LiveKit Cloud this does NOT change the
-- per-minute price — it bills connection minutes regardless — it changes
-- bandwidth, which is the other free-tier limit. Recorded on the row anyway
-- because the token grant is built from it: an audio call must not be able
-- to turn into a video one by a client deciding to publish a camera.

alter table public.calls
  add column if not exists callee_id uuid references auth.users (id) on delete cascade,
  add column if not exists media text not null default 'audio';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'calls_media_check') then
    alter table public.calls add constraint calls_media_check check (media in ('audio', 'video'));
  end if;
end $$;

-- The customer's phone now has to find "calls ringing for me" the same way
-- staff find "calls ringing for the line".
create index if not exists calls_callee_ringing_idx
  on public.calls (callee_id, created_at desc)
  where status = 'ringing';

-- A customer must be able to READ a call placed TO them, or their phone can
-- never ring. The original policy only admitted the caller and staff.
drop policy if exists "caller or staff reads calls" on public.calls;
create policy "participants or staff read calls"
  on public.calls for select
  to authenticated
  using (
    caller_id = (select auth.uid())
    or callee_id = (select auth.uid())
    or 'admin' = any (public.current_web_roles())
    or 'cskh' = any (public.current_web_roles())
  );

-- ---------------------------------------------------------------------------
-- start_call — now takes a direction and a media type.
-- ---------------------------------------------------------------------------
create or replace function public.start_call(
  p_thread_id uuid default null,
  p_callee_id uuid default null,
  p_media text default 'audio'
)
returns public.calls
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_is_staff boolean := 'admin' = any (public.current_web_roles()) or 'cskh' = any (public.current_web_roles());
  v_holds_line boolean;
  v_thread_owner uuid;
  v_id uuid := gen_random_uuid();
  v_call public.calls;
begin
  if v_user is null then
    raise exception 'auth_required' using errcode = '28000';
  end if;
  if p_media not in ('audio', 'video') then
    raise exception 'bad_media' using errcode = '22023';
  end if;

  -- Calling a named person is a staff-only move, and only ever the customer
  -- whose thread this is. Without the second check a staff account could
  -- ring any user id it liked.
  if p_callee_id is not null then
    if not v_is_staff then
      raise exception 'staff_required' using errcode = '42501';
    end if;
    select user_id into v_thread_owner from chat_threads where id = p_thread_id;
    if v_thread_owner is null or v_thread_owner <> p_callee_id then
      raise exception 'callee_not_in_thread' using errcode = '42501';
    end if;
  end if;

  select account_type <> 'review' into v_holds_line from profiles where id = v_user;
  v_holds_line := coalesce(v_holds_line, true);

  perform public.expire_stale_calls();

  begin
    insert into calls (id, room_name, caller_id, callee_id, thread_id, holds_line, media)
    values (v_id, 'call_' || replace(v_id::text, '-', ''), v_user, p_callee_id, p_thread_id, v_holds_line, p_media)
    returning * into v_call;
  exception when unique_violation then
    insert into calls (room_name, caller_id, callee_id, thread_id, status, holds_line, media, end_reason, ended_at)
    values ('call_' || replace(gen_random_uuid()::text, '-', ''), v_user, p_callee_id, p_thread_id,
            'busy', false, p_media, 'busy', now())
    returning * into v_call;
    perform public.log_call_to_thread(v_call);
  end;

  return v_call;
end;
$$;

-- The old 1-argument version must GO, and that is what keeps the already
-- shipped app working rather than breaking it. `create or replace` above made
-- a new function with a new signature; it did not replace the old one. Leaving
-- both would make `start_call(p_thread_id => ...)` — exactly what build 24 and
-- the installed Release build send — ambiguous, and Postgres would reject it.
-- With only the 3-arg version present, PostgREST resolves that same named call
-- against it and the two new parameters take their defaults: an audio call to
-- the support line, which is precisely what the old client meant.
drop function if exists public.start_call(uuid);

-- ---------------------------------------------------------------------------
-- answer_call — whoever the call is FOR may answer it.
-- ---------------------------------------------------------------------------
create or replace function public.answer_call(p_call_id uuid)
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
  select * into v_call from calls where id = p_call_id;
  if v_call.id is null then
    raise exception 'call_not_found' using errcode = 'P0002';
  end if;

  -- A call to the line is answered by any staff; a call to a person is
  -- answered only by that person.
  if v_call.callee_id is null then
    if not v_is_staff then
      raise exception 'staff_required' using errcode = '42501';
    end if;
  elsif v_call.callee_id <> v_user then
    raise exception 'not_the_callee' using errcode = '42501';
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
-- The trace line now reads from the right side.
--
-- A call CSKH placed is attributed to 'specialist', so the customer sees it
-- as support reaching out and it does not sit in the staff list as an unread
-- customer message. A call the customer placed stays 'user'.
-- ---------------------------------------------------------------------------
create or replace function public.log_call_to_thread(p_call public.calls)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_body text;
  v_minutes integer;
  v_seconds integer;
  v_kind text;
  v_sender text;
  v_thread_owner uuid;
begin
  if p_call.thread_id is null then
    return;
  end if;
  select user_id into v_thread_owner from chat_threads where id = p_call.thread_id;

  v_sender := case when p_call.caller_id = v_thread_owner then 'user' else 'specialist' end;
  v_kind := case when p_call.media = 'video' then 'Cuộc gọi video' else 'Cuộc gọi thoại' end;

  if p_call.status = 'ended' and coalesce(p_call.duration_seconds, 0) > 0 then
    v_minutes := p_call.duration_seconds / 60;
    v_seconds := p_call.duration_seconds % 60;
    v_body := format('📞 %s · %s:%s', v_kind,
                     lpad(v_minutes::text, 2, '0'), lpad(v_seconds::text, 2, '0'));
  elsif p_call.status = 'declined' then
    v_body := format('📞 %s đã bị từ chối', v_kind);
  elsif p_call.status = 'busy' then
    v_body := '📞 Khách gọi khi tổng đài đang bận';
  elsif p_call.status = 'missed' then
    v_body := format('📞 %s nhỡ', v_kind);
  else
    v_body := format('📞 %s không thành công', v_kind);
  end if;

  insert into chat_messages (thread_id, sender_type, sender_id, body)
  values (p_call.thread_id, v_sender, p_call.caller_id, v_body);
end;
$$;

revoke all on function public.log_call_to_thread(public.calls) from public, anon, authenticated;
revoke all on function public.start_call(uuid, uuid, text) from public, anon;
revoke all on function public.answer_call(uuid) from public, anon;
grant execute on function public.start_call(uuid, uuid, text) to authenticated;
grant execute on function public.answer_call(uuid) to authenticated;
