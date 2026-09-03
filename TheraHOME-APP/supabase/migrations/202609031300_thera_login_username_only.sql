-- Reverts thera_login_accepts_email (202609031200) per explicit request
-- 2026-09-03: the TheraHOME login must match the USERNAME only, never the
-- email. Back to the original resolver. Apple review notes must therefore
-- hand the reviewer the username (app_review1), not the address.
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
  where p.username = lower(btrim(p_username))
    and p.account_type <> 'normal'
  limit 1;
$$;
