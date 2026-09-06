-- Region decides which market's PRICES and product links a customer sees, so
-- being able to switch to VN is a way to buy through the cheaper Vietnamese
-- storefront. The app's Account screen no longer offers a picker, but the
-- REST API would still accept the change, so close it here too.
--
-- A customer may still set their region ONCE, at onboarding, which is the
-- write that flips `country_confirmed` from false to true. After that only
-- admin (or service_role) can change it — CSKH asks admin, who has the
-- picker in the user drawer.
create or replace function public.protect_privileged_profile_columns()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_admin boolean := 'admin' = any(public.current_web_roles());
  v_cskh boolean := 'cskh' = any(public.current_web_roles());
  v_self boolean := (select auth.uid()) = new.id;
  -- The onboarding write is the one that confirms the region for the first
  -- time; anything after that is a change, not a first choice.
  v_confirming boolean := coalesce(old.country_confirmed, false) = false;
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
     -- Region: settable by the owner only while still unconfirmed.
     or (new.country is distinct from old.country and not (v_self and v_confirming))
     or (new.country_confirmed is distinct from old.country_confirmed and not v_self)
     or (new.email is distinct from old.email and not v_self)
     -- locked: CSKH yes (moderation), everyone else no
     or (new.locked is distinct from old.locked and not v_cskh)
  then
    raise exception using errcode = '42501', message = 'privileged_profile_column_change_forbidden';
  end if;
  return new;
end;
$function$;
