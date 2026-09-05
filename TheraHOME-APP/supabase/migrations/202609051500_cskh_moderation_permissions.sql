-- Audit 2026-09-05: with Community + Reports now CSKH surfaces, three
-- moderation actions the UI offers to CSKH were still admin-only in RLS:
--   1. hide / delete a member COMMENT (ReportsView, CommunityView)
--   2. lock a reported post's AUTHOR (ReportsView "Khoá tác giả")
-- Same class of bug fixed twice earlier today (post delete, challenges).

-- 1. Comments: widen the two admin-only policies to staff.
drop policy if exists "web admin update any comment" on public.post_comments;
create policy "web staff update any comment" on public.post_comments
  for update to authenticated
  using ('admin' = any(public.current_web_roles()) or 'cskh' = any(public.current_web_roles()))
  with check ('admin' = any(public.current_web_roles()) or 'cskh' = any(public.current_web_roles()));

drop policy if exists "web admin delete any comment" on public.post_comments;
create policy "web staff delete any comment" on public.post_comments
  for delete to authenticated
  using ('admin' = any(public.current_web_roles()) or 'cskh' = any(public.current_web_roles()));

-- 2. Profiles: CSKH may update profiles, but the privileged-column triggers
--    keep account_type / access_level / expires_at / app_role / username /
--    created_by / notes admin-only. `locked` is the ONE privileged column
--    CSKH may flip — it is the moderation lever behind "Khoá tác giả".
create policy "web cskh update any profile" on public.profiles
  for update to authenticated
  using ('cskh' = any(public.current_web_roles()))
  with check ('cskh' = any(public.current_web_roles()));

create or replace function public.protect_privileged_profile_columns()
returns trigger language plpgsql security definer set search_path to ''
as $function$
declare
  v_admin boolean := 'admin' = any(public.current_web_roles());
  v_cskh boolean := 'cskh' = any(public.current_web_roles());
begin
  if auth.role() = 'service_role' or v_admin then
    return new;
  end if;
  if new.account_type is distinct from old.account_type
     or new.access_level is distinct from old.access_level
     or new.expires_at is distinct from old.expires_at
     or new.app_role is distinct from old.app_role
     or new.created_by is distinct from old.created_by
     or new.notes is distinct from old.notes
     -- locked: CSKH yes (moderation), everyone else no
     or (new.locked is distinct from old.locked and not v_cskh)
  then
    raise exception using errcode = '42501', message = 'privileged_profile_column_change_forbidden';
  end if;
  return new;
end;
$function$;

create or replace function public.protect_profile_privileged_columns()
returns trigger language plpgsql security definer set search_path to ''
as $function$
declare
  v_cskh boolean := 'cskh' = any(public.current_web_roles());
begin
  if (select auth.role()) is distinct from 'authenticated' then
    return new;
  end if;
  if 'admin' = any(public.current_web_roles()) then
    return new;
  end if;
  if new.account_type is distinct from old.account_type
     or new.access_level is distinct from old.access_level
     or (new.locked is distinct from old.locked and not v_cskh)
     or new.expires_at is distinct from old.expires_at
     or new.username is distinct from old.username
     or new.created_by is distinct from old.created_by then
    raise exception using errcode = '42501', message = 'privileged_profile_fields';
  end if;
  return new;
end;
$function$;

-- 3. Security advisor: the 5-arg set_official_post_pinned overload survived
--    today's CREATE OR REPLACE with a new signature (Postgres overloads on
--    argument lists) and is callable by anon. Drop it. profile_language and
--    notification_copy are internal helpers — no REST caller needs them.
drop function if exists public.set_official_post_pinned(uuid, boolean, text, text, text);
revoke execute on function public.set_official_post_pinned(uuid, boolean, text, text, text, text[], text, text, text, text, text, text) from anon;
revoke execute on function public.profile_language(uuid) from anon, authenticated;
revoke execute on function public.notification_copy(text, text, integer) from anon, authenticated;
