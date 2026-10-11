-- A call that nobody answered must not vanish.
--
-- The hole this closes: a customer rings the support line, CSKH is away from
-- the phone, the call times out — and nothing anywhere records that it
-- happened. The `calls` row exists, but no screen reads it, so for everyone
-- involved the attempt simply never occurred. On a one-person support line
-- that is the most likely outcome of a call, not an edge case.
--
-- Where the trace goes: the customer's human chat thread. Not the
-- `notifications` table — the staff shell's "Thông báo" tab is a broadcast
-- composer, not an inbox, so a row there would be written and never seen. The
-- Chat tab is where CSKH actually looks, it already sorts by last activity
-- and already counts unread, so a line in the thread surfaces the missed call
-- at the top of their list with no new UI at all.
--
-- Attributed to the customer (`sender_type = 'user'`) because the customer is
-- who performed the action, and because that is what makes it count as unread
-- for staff. It is written from a SECURITY DEFINER function, so the
-- "clients may only insert their own 'user' rows" policy does not apply.
--
-- Deliberately no push: CSKH was already rung by `dispatch-push` when the
-- call came in, and the customer watched it fail on their own screen. A
-- second notification for the same event would be noise.

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
begin
  -- A call placed outside a chat thread has nowhere to leave a trace. Not an
  -- error: the only caller today always passes one, and a future entry point
  -- that does not should still be able to place a call.
  if p_call.thread_id is null then
    return;
  end if;

  if p_call.status = 'ended' and coalesce(p_call.duration_seconds, 0) > 0 then
    v_minutes := p_call.duration_seconds / 60;
    v_seconds := p_call.duration_seconds % 60;
    v_body := format('📞 Cuộc gọi thoại · %s:%s',
                     lpad(v_minutes::text, 2, '0'),
                     lpad(v_seconds::text, 2, '0'));
  elsif p_call.status = 'declined' then
    v_body := '📞 Cuộc gọi đã bị từ chối';
  elsif p_call.status = 'busy' then
    v_body := '📞 Khách gọi khi tổng đài đang bận';
  elsif p_call.status = 'missed' then
    v_body := '📞 Cuộc gọi nhỡ';
  else
    -- 'ended' with no duration: answered and hung up before audio, or a call
    -- that failed to connect. Still worth a line — it is an attempt.
    v_body := '📞 Cuộc gọi không thành công';
  end if;

  insert into chat_messages (thread_id, sender_type, sender_id, body)
  values (p_call.thread_id, 'user', p_call.caller_id, v_body);
end;
$$;

revoke all on function public.log_call_to_thread(public.calls) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Both places a call can reach a terminal state now write the trace.
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
  -- Already finished. Returned unchanged AND without a second trace: both
  -- sides race to end every call, and two "Cuộc gọi nhỡ" lines for one call
  -- would be worse than none.
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

  perform public.log_call_to_thread(v_call);
  return v_call;
end;
$$;

create or replace function public.expire_stale_calls()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer := 0;
  v_call public.calls;
begin
  -- Row by row rather than one UPDATE ... RETURNING, because each expired
  -- call now needs its own trace written. The set is at most a handful of
  -- rows (one live line, plus whatever a crash left behind), so the loop
  -- costs nothing.
  for v_call in
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
    returning *
  loop
    perform public.log_call_to_thread(v_call);
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

-- `start_call` writes the 'busy' row directly, so it logs that one itself.
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

  select account_type <> 'review' into v_holds_line from profiles where id = v_user;
  v_holds_line := coalesce(v_holds_line, true);

  perform public.expire_stale_calls();

  begin
    insert into calls (id, room_name, caller_id, thread_id, holds_line)
    values (v_id, 'call_' || replace(v_id::text, '-', ''), v_user, p_thread_id, v_holds_line)
    returning * into v_call;
  exception when unique_violation then
    insert into calls (room_name, caller_id, thread_id, status, holds_line, end_reason, ended_at)
    values ('call_' || replace(gen_random_uuid()::text, '-', ''), v_user, p_thread_id, 'busy', false, 'busy', now())
    returning * into v_call;
    -- A customer who got "đang bận" is a customer who wanted to talk and
    -- could not. That belongs in the thread too.
    perform public.log_call_to_thread(v_call);
  end;

  return v_call;
end;
$$;

revoke all on function public.expire_stale_calls() from public, anon, authenticated;
revoke all on function public.start_call(uuid) from public, anon;
revoke all on function public.end_call(uuid, text, text) from public, anon;
grant execute on function public.start_call(uuid) to authenticated;
grant execute on function public.end_call(uuid, text, text) to authenticated;
