-- `country` decides which market's prices, product links, program videos and
-- pinned posts a customer sees, and `email` is an identity field, yet the
-- CSKH profile-update policy (202609051500) left both editable on ANY row —
-- the guard trigger only enumerated account_type/access_level/expires_at/
-- app_role/created_by/notes. A mistake or a compromised CSKH session could
-- silently move a customer to another market's storefront.
--
-- Admin keeps full access (it returns early for admin and service_role), so
-- the Admin User tab's new "Quốc gia / Thị trường" picker still works.
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
     -- Market + identity: the owner may change their own; staff may not
     -- change anyone else's.
     or (new.country is distinct from old.country and not v_self)
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
