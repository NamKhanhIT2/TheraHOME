-- A device that changes hands can never update its push token.
--
-- `push_tokens` is protected by one policy, `user_id = auth.uid()`, for every
-- command. The client upserts on the token itself (`onConflict:
-- expo_push_token`), which is right — a device has ONE Expo token and it must
-- not accumulate a row per account. But an upsert that lands on an existing
-- row is an UPDATE, and the USING clause of that policy is evaluated against
-- the row ALREADY THERE. If it belongs to whoever used the handset last, the
-- update is refused.
--
-- Nothing surfaced. PostgREST returns the refusal in `error`, and the client
-- never looked at it, so a device that had registered under one account
-- silently never registered under the next one.
--
-- Measured on 2026-10-11: zero push tokens for ANY staff account, on an
-- emulator that had registered earlier the same evening under a test patient
-- account ("android 36", 20:43). Which is to say: the staff-shell fix that
-- was supposed to give CSKH a push token could not have worked on the one
-- device being used to test it.
--
-- This is the same problem `register_voip_token` already solved for PushKit,
-- and the same solution: one SECURITY DEFINER function that keys on the
-- token and REASSIGNS it to whoever is signed in now. Ownership follows the
-- handset, which is what makes a shared phone ring for its current user.

create or replace function public.register_push_token(
  p_token text,
  p_device text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  if p_token is null or length(trim(p_token)) = 0 then
    raise exception 'token_required' using errcode = '22023';
  end if;

  insert into public.push_tokens (user_id, expo_push_token, device_info)
  values (v_user, p_token, p_device)
  on conflict (expo_push_token) do update
    set user_id = excluded.user_id,
        device_info = coalesce(excluded.device_info, public.push_tokens.device_info);
end;
$$;

-- Only a signed-in client may call it, and it can only ever write the
-- caller's own id — `auth.uid()` is read inside the function, never passed
-- in, so there is no way to claim someone else's device.
revoke all on function public.register_push_token(text, text) from public, anon;
grant execute on function public.register_push_token(text, text) to authenticated;
