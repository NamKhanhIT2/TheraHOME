-- Self-service registration: the sign-up form collects a username alongside
-- the email and password, but nothing carried it into the profile row, so a
-- brand-new account arrived with `username` null and could never sign in by
-- name afterwards.
--
-- `profiles_username_unique_idx` is already `unique (lower(username))`, so
-- uniqueness is case-insensitive and enforced by the database. What was
-- missing is a readable failure: hitting that index from inside the trigger
-- aborts the auth user creation with a raw Postgres error the app cannot map
-- to "that name is taken". Both checks below therefore raise their own coded
-- exception, and the client maps those the way it maps every other RPC error.

-- Shape rule, kept deliberately narrow: it has to survive being typed on a
-- phone keyboard, read back over the phone to support, and used in a URL.
create or replace function public.username_is_wellformed(p_username text)
returns boolean
language sql
immutable
set search_path to ''
as $function$
  select btrim(coalesce(p_username, '')) ~ '^[A-Za-z0-9][A-Za-z0-9._-]{2,29}$';
$function$;

-- Lets the sign-up screen say "that name is taken" while the person is still
-- typing, instead of after they have filled in the whole form. Only reveals
-- whether a name is free — which any registration form reveals anyway — and
-- never an email address.
create or replace function public.is_username_available(p_username text)
returns boolean
language sql
stable
security definer
set search_path to ''
as $function$
  select public.username_is_wellformed(p_username)
     and not exists (
       select 1 from public.profiles
       where lower(username) = lower(btrim(p_username))
     );
$function$;

revoke all on function public.is_username_available(text) from public;
grant execute on function public.is_username_available(text) to anon, authenticated;

-- Runs for EVERY new auth user, including Google and Apple sign-ins, which
-- carry no username in their metadata — those take the null path and behave
-- exactly as before.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_username text := nullif(btrim(new.raw_user_meta_data->>'username'), '');
begin
  if v_username is not null then
    if not public.username_is_wellformed(v_username) then
      raise exception using errcode = '22023', message = 'username_invalid';
    end if;
    -- Checked here rather than left to the unique index so the client gets a
    -- message it can translate. The index still guards the race between this
    -- check and the insert.
    if exists (select 1 from public.profiles where lower(username) = lower(v_username)) then
      raise exception using errcode = '23505', message = 'username_taken';
    end if;
  end if;

  insert into public.profiles (id, email, full_name, avatar_url, username)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'),
    new.raw_user_meta_data->>'avatar_url',
    v_username
  );
  return new;
end;
$function$;
