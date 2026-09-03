-- The TheraHOME login screen asks for a username, but people handed
-- credentials (Apple's reviewer especially) often paste the full
-- <username>@thera.local address instead. Accept both — the resolver now
-- also matches the account's email, so either form signs in.
create or replace function public.resolve_thera_login_email(p_username text)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select u.email
  from public.profiles p
  join auth.users u on u.id = p.id
  where (p.username = lower(btrim(p_username))
         or u.email = lower(btrim(p_username)))
    and p.account_type <> 'normal'
  limit 1;
$$;
