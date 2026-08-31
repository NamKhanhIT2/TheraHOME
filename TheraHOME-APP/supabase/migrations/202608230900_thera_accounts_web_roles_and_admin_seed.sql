-- TheraHOME-account login for WEB admin/cskh (replaces Google-bound
-- web_access_contacts as the primary staff login) + a dedicated `cskh`
-- account type for mobile. See TheraHOME WEB/CLAUDE.md and
-- TheraHOME-APP/CLAUDE.md for the full picture.

-- 1. Plain username for TheraHOME-issued accounts (admin/cskh/admin_issued/
--    review/staff/partner/tester) — separate from `email`, which for these
--    accounts holds a synthetic `<username>@thera.local` address rather than
--    a real inbox.
alter table public.profiles add column if not exists username text;
create unique index if not exists profiles_username_unique_idx
  on public.profiles (lower(username)) where username is not null;

-- 2. Extend account_type to cover the two web-staff roles.
alter table public.profiles drop constraint if exists profiles_account_type_check;
alter table public.profiles add constraint profiles_account_type_check
  check (account_type in ('normal', 'admin_issued', 'review', 'staff', 'partner', 'tester', 'admin', 'cskh'));

-- 3. Hard guarantee: at most one row can ever be the singleton admin
-- account, matching "chỉ có 1 tài khoản admin duy nhất" as an enforced
-- invariant rather than just a UI convention (the create-account edge
-- function also refuses to issue account_type='admin').
create unique index if not exists profiles_single_admin_idx
  on public.profiles ((true)) where account_type = 'admin';

-- 4. current_web_roles(): keep the existing web_access_contacts lookup as
-- the first branch (unchanged), add a fallback that derives roles straight
-- from a TheraHOME-issued account's own account_type. This is the single
-- role source read by every RLS policy, admin-manage-account, and mobile's
-- useWebRoles/useIsStaff, so this one change threads through everywhere.
create or replace function public.current_web_roles()
returns text[]
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (
      select roles
      from public.web_access_contacts
      where claimed_by_user_id = auth.uid()
        and disabled = false
      limit 1
    ),
    (
      select case p.account_type
        when 'admin' then array['admin', 'cskh']::text[]
        when 'cskh' then array['cskh']::text[]
        else null
      end
      from public.profiles p
      where p.id = auth.uid()
        and coalesce(p.locked, false) = false
        and (p.expires_at is null or p.expires_at > now())
    ),
    array[]::text[]
  );
$$;

-- 5. Username -> email resolver, callable pre-session (login time). Only
-- ever resolves TheraHOME-issued accounts (account_type <> 'normal'), never
-- ordinary Google/Apple users, which limits the enumeration surface to the
-- small set of admin-created accounts.
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

revoke all on function public.resolve_thera_login_email(text) from public;
grant execute on function public.resolve_thera_login_email(text) to anon, authenticated;

-- 6. Seed the single admin account: TheraHOME / TheraHOME@/123. Inserting
-- directly into auth.users (pgcrypto is installed, so encrypted_password
-- matches GoTrue's own bcrypt hashing) fires the existing handle_new_user
-- trigger, which creates the base profiles row automatically; the matching
-- auth.identities row mirrors what auth.admin.createUser itself produces.
do $$
declare
  v_user_id uuid := gen_random_uuid();
  v_email text := 'therahome@thera.local';
begin
  if not exists (select 1 from public.profiles where username = 'therahome') then
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      confirmation_token, recovery_token, email_change_token_new, email_change,
      email_change_token_current, phone_change, phone_change_token, reauthentication_token,
      raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous, created_at, updated_at
    ) values (
      '00000000-0000-0000-0000-000000000000', v_user_id, 'authenticated', 'authenticated',
      v_email, crypt('TheraHOME@/123', gen_salt('bf')), now(),
      '', '', '', '', '', '', '', '',
      '{}'::jsonb, '{}'::jsonb, false, false, now(), now()
    );

    insert into auth.identities (
      id, provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at
    ) values (
      gen_random_uuid(), v_user_id::text, v_user_id,
      jsonb_build_object('sub', v_user_id::text, 'email', v_email, 'email_verified', true),
      'email', now(), now(), now()
    );

    update public.profiles
    set username = 'therahome',
        account_type = 'admin',
        access_level = 'admin_granted',
        full_name = 'TheraHOME Admin',
        onboarding_completed = true,
        country_confirmed = true,
        locked = false
    where id = v_user_id;
  end if;
end $$;

-- 7. Downgrade the two previously-Google-based admin contacts to plain
-- (roleless) contacts — access to WEB now goes through the TheraHOME
-- account above instead. Row kept (not deleted) so they remain valid
-- ordinary-customer contacts if/when the public web app phase needs them,
-- matching the shape already documented in TheraHOME WEB/CLAUDE.md.
update public.web_access_contacts
set roles = '{}'::text[]
where email in ('khanha1k59@gmail.com', 'hoankenny2002@gmail.com');
