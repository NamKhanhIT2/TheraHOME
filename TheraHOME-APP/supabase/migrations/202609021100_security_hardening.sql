-- Security hardening pass (2026-09-02) — findings from the 20-point audit.

-- 1. CRITICAL: "update own profile" had no column restrictions, so any
--    user could set their own account_type='admin' (current_web_roles()
--    falls back to profiles.account_type) = full web-admin escalation.
--    A BEFORE UPDATE trigger now freezes privileged columns unless the
--    caller is service-role/postgres or a web admin. (BEFORE trigger reads
--    see the pre-update row, so the current_web_roles() fallback still
--    sees the OLD account_type — no self-referential loophole.)
create or replace function public.protect_profile_privileged_columns()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.role()) is distinct from 'authenticated' then
    return new; -- service_role / postgres (migrations, Edge Functions)
  end if;
  if 'admin' = any(public.current_web_roles()) then
    return new;
  end if;
  if new.account_type is distinct from old.account_type
     or new.access_level is distinct from old.access_level
     or new.locked is distinct from old.locked
     or new.expires_at is distinct from old.expires_at
     or new.username is distinct from old.username
     or new.created_by is distinct from old.created_by then
    raise exception using errcode = '42501', message = 'privileged_profile_fields';
  end if;
  return new;
end;
$$;

drop trigger if exists z_protect_profile_privileged_columns on public.profiles;
create trigger z_protect_profile_privileged_columns
before update on public.profiles
for each row execute function public.protect_profile_privileged_columns();

-- 2. HIGH: "own user_programs" was FOR ALL — a user could INSERT their own
--    user_programs row for any product, bypassing activation entirely.
--    Clients only ever read; all provisioning goes through SECURITY
--    DEFINER RPCs / the service role.
drop policy if exists "own user_programs" on public.user_programs;
create policy "own user_programs select"
  on public.user_programs for select
  to authenticated
  using (user_id = (select auth.uid()));

-- 3. HIGH: legacy order RPCs let any signed-in user probe orders by any
--    phone/email (PII enumeration) and activate ANOTHER person's order for
--    themselves. The app moved to claim_user_access_contact /
--    activate_product_by_contact long ago — nothing calls these.
revoke execute on function public.lookup_order(text, text) from public, anon, authenticated;
revoke execute on function public.lookup_order_by_code(text) from public, anon, authenticated;
revoke execute on function public.activate_order(uuid) from public, anon, authenticated;
revoke execute on function public.activate_orders_by_contact(text, text) from public, anon, authenticated;

-- 4. Hygiene: trigger functions and internal helpers should not be exposed
--    as PostgREST RPCs at all.
revoke execute on function public.auto_claim_product_activation_contact() from public, anon, authenticated;
revoke execute on function public.normalize_product_activation_contact() from public, anon, authenticated;
revoke execute on function public.notify_official_post_inbox() from public, anon, authenticated;
revoke execute on function public.protect_chat_message_read_update() from public, anon, authenticated;
revoke execute on function public.provision_new_product_for_claimed_users() from public, anon, authenticated;
revoke execute on function public.provision_new_program_day_for_claimed_users() from public, anon, authenticated;
revoke execute on function public.protect_profile_privileged_columns() from public, anon, authenticated;
revoke execute on function public.get_default_product_for_contact() from public, anon;

-- 5. Pin search_path on the two flagged functions (SECURITY DEFINER-adjacent
--    helpers must not resolve objects through a caller-controlled path).
alter function public.normalize_phone_vn(text) set search_path = 'public';
alter function public.validate_upsell_campaign_schedule() set search_path = 'public';
