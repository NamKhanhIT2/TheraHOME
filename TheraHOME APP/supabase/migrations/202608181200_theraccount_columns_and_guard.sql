-- TheraHOME-issued accounts (Apple/App-Review/staff/partner/tester logins
-- created directly by an Admin, no OAuth). Extends profiles rather than
-- creating a parallel table — see TheraHOME WEB/CLAUDE.md and
-- TheraHOME APP/CLAUDE.md for the surrounding access model.
--
-- `profiles.locked` (added in an earlier phase) is reused as `is_active`
-- (inverted). `profiles.full_name` is reused as `display_name`. Neither is
-- duplicated here.

alter table public.profiles
  add column if not exists account_type text not null default 'normal'
    check (account_type in ('normal', 'admin_issued', 'review', 'staff', 'partner', 'tester')),
  add column if not exists access_level text not null default 'free'
    check (access_level in ('free', 'premium', 'admin_granted')),
  add column if not exists expires_at timestamptz,
  -- Defaults true so every existing row and every future Google/Apple
  -- signup is unaffected — only Admin-issued accounts are ever created with
  -- this false.
  add column if not exists onboarding_completed boolean not null default true,
  add column if not exists created_by uuid references auth.users(id) on delete set null,
  add column if not exists notes text,
  add column if not exists last_login_at timestamptz;

-- The existing "update own profile" policy (auth.uid() = id, no column
-- restriction) already let any signed-in user rewrite their own app_role/
-- locked — a pre-existing gap. Close it here rather than let the new,
-- higher-stakes columns inherit the same hole. Admin (via current_web_roles)
-- and the service-role context (the new admin-manage-account Edge Function)
-- are still allowed to change these.
create or replace function public.protect_privileged_profile_columns()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (
    new.account_type is distinct from old.account_type
    or new.access_level is distinct from old.access_level
    or new.expires_at is distinct from old.expires_at
    or new.app_role is distinct from old.app_role
    or new.locked is distinct from old.locked
    or new.created_by is distinct from old.created_by
    or new.notes is distinct from old.notes
  )
  and not ('admin' = any(public.current_web_roles()))
  and auth.role() <> 'service_role'
  then
    raise exception using errcode = '42501', message = 'privileged_profile_column_change_forbidden';
  end if;
  return new;
end;
$$;

drop trigger if exists protect_privileged_profile_columns on public.profiles;
create trigger protect_privileged_profile_columns
before update on public.profiles
for each row execute function public.protect_privileged_profile_columns();

-- Called once per new session (any of the 3 login methods) from
-- RootNavigator; lets "Lần đăng nhập cuối" in the Admin UI mean something.
create or replace function public.touch_last_login()
returns void
language sql
security definer
set search_path = ''
as $$
  update public.profiles set last_login_at = now() where id = auth.uid();
$$;

revoke all on function public.touch_last_login() from public, anon;
grant execute on function public.touch_last_login() to authenticated;
