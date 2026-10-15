-- Answer, timeout and hangup can reach Postgres simultaneously. Lock the
-- same row before deciding a transition, and write the chat trace once.
create or replace function public.answer_call(p_call_id uuid)
returns public.calls
language plpgsql security definer set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_is_staff boolean := 'admin' = any(public.current_web_roles()) or 'cskh' = any(public.current_web_roles());
  v_call public.calls;
begin
  if v_user is null then raise exception 'auth_required' using errcode = '28000'; end if;
  select * into v_call from calls where id = p_call_id for update;
  if v_call.id is null then raise exception 'call_not_found' using errcode = 'P0002'; end if;
  if v_call.caller_id = v_user then raise exception 'not_the_callee' using errcode = '42501'; end if;
  if not coalesce(((v_call.callee_id is null and v_is_staff) or v_call.callee_id = v_user), false) then
    raise exception 'not_the_callee' using errcode = '42501';
  end if;
  -- A native event may be replayed after the in-app answer completed.
  if v_call.status = 'accepted' and v_call.answered_by = v_user then return v_call; end if;
  if v_call.status <> 'ringing' then raise exception 'call_not_ringing' using errcode = 'P0002'; end if;
  if v_call.created_at <= now() - interval '45 seconds' then
    update calls set status = 'missed', end_reason = 'timeout', ended_at = now(), duration_seconds = 0
      where id = p_call_id returning * into v_call;
    perform public.log_call_to_thread(v_call);
    return v_call;
  end if;
  update calls set status = 'accepted', answered_by = v_user, answered_at = now()
    where id = p_call_id returning * into v_call;
  return v_call;
end;
$$;

create or replace function public.end_call(p_call_id uuid, p_status text default 'ended', p_reason text default 'hangup')
returns public.calls
language plpgsql security definer set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_is_staff boolean := 'admin' = any(public.current_web_roles()) or 'cskh' = any(public.current_web_roles());
  v_call public.calls;
  v_status text;
  v_reason text;
begin
  if v_user is null then raise exception 'auth_required' using errcode = '28000'; end if;
  if p_status is null or p_status not in ('declined', 'missed', 'ended') then
    raise exception 'bad_status' using errcode = '22023';
  end if;
  select * into v_call from calls where id = p_call_id for update;
  if v_call.id is null then raise exception 'call_not_found' using errcode = 'P0002'; end if;
  if not coalesce((v_call.caller_id = v_user or v_call.callee_id = v_user or v_call.answered_by = v_user
    or (v_call.callee_id is null and v_is_staff and v_call.answered_by is null)), false) then
    raise exception 'not_a_participant' using errcode = '42501';
  end if;
  if v_call.status in ('declined', 'missed', 'busy', 'ended') then return v_call; end if;
  -- A caller's stale ring timer must not end a call someone just answered.
  if p_status = 'missed' and p_reason = 'timeout' and v_call.status = 'accepted' then return v_call; end if;
  v_status := case when v_call.status = 'accepted' then 'ended' else p_status end;
  v_reason := case when v_call.status = 'accepted' and p_reason = 'declined' then 'hangup' else p_reason end;
  if v_call.status = 'ringing' and v_call.caller_id = v_user and p_status = 'ended' and p_reason = 'hangup' then
    v_status := 'missed';
    v_reason := 'cancelled';
  end if;
  update calls set status = v_status, end_reason = v_reason, ended_at = now(),
    duration_seconds = case when answered_at is null then 0
      else greatest(0, extract(epoch from (now() - answered_at))::integer) end
    where id = p_call_id returning * into v_call;
  perform public.log_call_to_thread(v_call);
  return v_call;
end;
$$;

create or replace function public.expire_stale_calls()
returns integer
language plpgsql security definer set search_path = public
as $$
declare
  v_count integer := 0;
  v_call public.calls;
begin
  for v_call in
    update calls set status = case when status = 'ringing' then 'missed' else 'ended' end,
      end_reason = 'timeout', ended_at = now(),
      duration_seconds = case when answered_at is null then 0
        else greatest(0, extract(epoch from (now() - answered_at))::integer) end
    where (status = 'ringing' and created_at <= now() - interval '45 seconds')
       or (status = 'accepted' and answered_at < now() - interval '2 hours')
    returning *
  loop
    perform public.log_call_to_thread(v_call);
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

revoke all on function public.answer_call(uuid) from public, anon;
revoke all on function public.end_call(uuid, text, text) from public, anon;
grant execute on function public.answer_call(uuid) to authenticated;
grant execute on function public.end_call(uuid, text, text) to authenticated;
revoke all on function public.expire_stale_calls() from public, anon, authenticated;

-- A killed caller cannot run its own timeout. pg_cron is already installed
-- by 202609031600; the next start_call still sweeps before claiming the line.
select cron.schedule('expire-stale-calls', '* * * * *', 'select public.expire_stale_calls()');
