-- PushKit tokens, which are not Expo tokens.
--
-- iOS will not ring a locked phone from an ordinary notification. CallKit
-- needs a VoIP push, VoIP pushes come from PushKit, and PushKit issues its
-- own device token — a different value from the one `push_tokens` holds,
-- obtained from a different API, delivered to a different app callback, and
-- sent to a different APNs topic (`<bundle>.voip`). They cannot share a
-- column, and Expo's push service cannot send to this token at all: it has
-- no way to set `apns-push-type: voip`, so these pushes go straight to APNs
-- from an Edge Function that signs its own JWT.
--
-- Separate table rather than a column on `push_tokens` because the two have
-- different lifetimes: a PushKit token is reissued independently of the Expo
-- one, and a device can legitimately have one without the other (Android has
-- no PushKit at all; an iOS build older than this feature has no VoIP token).
create table if not exists public.voip_tokens (
  user_id uuid not null references auth.users (id) on delete cascade,
  -- The raw PushKit token, hex. Unique on its own: one physical device has
  -- exactly one, and if it moves to another account the row should move with
  -- it rather than leaving the old account able to ring that phone.
  token text not null,
  platform text not null default 'ios' check (platform in ('ios')),
  updated_at timestamptz not null default now(),
  primary key (token)
);

create index if not exists voip_tokens_user_idx on public.voip_tokens (user_id);

alter table public.voip_tokens enable row level security;

-- A client may register and re-register its own device, and nothing else.
-- Reading other people's tokens is never a client's business; the Edge
-- Function reads them with the service role.
drop policy if exists "own voip token insert" on public.voip_tokens;
create policy "own voip token insert"
  on public.voip_tokens for insert
  to authenticated
  with check (user_id = (select auth.uid()));

drop policy if exists "own voip token update" on public.voip_tokens;
create policy "own voip token update"
  on public.voip_tokens for update
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists "own voip token delete" on public.voip_tokens;
create policy "own voip token delete"
  on public.voip_tokens for delete
  to authenticated
  using (user_id = (select auth.uid()));

-- Deliberately NO select policy: a client never needs to read these back,
-- and the table is a list of "which phone belongs to whom".

-- The upsert the client performs on every launch has to be able to steal a
-- token from a previous owner — the same handset signed into a second
-- account must ring for the account that is actually signed in now, not the
-- old one. An insert policy alone cannot express that, so the move happens
-- here, in a definer function.
create or replace function public.register_voip_token(p_token text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null then
    raise exception 'auth_required' using errcode = '28000';
  end if;
  if p_token is null or length(trim(p_token)) = 0 then
    raise exception 'token_required' using errcode = '22023';
  end if;

  insert into voip_tokens (token, user_id, platform, updated_at)
  values (trim(p_token), v_user, 'ios', now())
  on conflict (token) do update
    set user_id = excluded.user_id,
        updated_at = now();
end;
$$;

revoke all on function public.register_voip_token(text) from public, anon;
grant execute on function public.register_voip_token(text) to authenticated;

-- Read by the VoIP sender with the service role only. `authenticated` is
-- named explicitly because a plain revoke from public/anon does not keep a
-- function off this project's REST API — see
-- 202610111030_voice_calls_revoke_janitor_from_clients.sql.
create or replace function public.voip_tokens_for(p_user_ids uuid[])
returns setof text
language sql
stable
security definer
set search_path = ''
as $$
  select v.token from public.voip_tokens v where v.user_id = any(p_user_ids);
$$;

revoke all on function public.voip_tokens_for(uuid[]) from public, anon, authenticated;
grant execute on function public.voip_tokens_for(uuid[]) to service_role;
