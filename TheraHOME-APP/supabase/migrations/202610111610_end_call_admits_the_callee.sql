-- `end_call` still used the one-way model: caller, or staff. In a call CSKH
-- placed TO a customer, the customer is the callee and is neither — so they
-- could answer and then have no way to hang up.
--
-- Caught by the two-way verification minutes after 202610111600 landed, not
-- by reading the code: the test impersonated the customer, answered, and the
-- RPC came back `42501 not_a_participant`.
--
-- Staff keep the right to end a call addressed to the support line
-- (`callee_id is null`), because that call is addressed to them collectively
-- — but not a private call between two other named people.
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

  if not (
    v_call.caller_id = v_user
    or v_call.callee_id = v_user
    or (v_call.callee_id is null and v_is_staff)
  ) then
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

revoke all on function public.end_call(uuid, text, text) from public, anon;
grant execute on function public.end_call(uuid, text, text) to authenticated;
