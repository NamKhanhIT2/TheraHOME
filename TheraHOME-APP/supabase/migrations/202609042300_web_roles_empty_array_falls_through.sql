-- current_web_roles() coalesced web_access_contacts.roles -> profiles.account_type,
-- but an EMPTY array is not NULL, so a contact row whose roles were cleared to
-- '{}' stopped the chain and silently stripped the account of every role
-- (both Google owner contacts are in that state today). Treat empty as absent
-- so the account_type fallback still applies. No one gains a role from this:
-- those two accounts are account_type='normal' and stay role-less.
create or replace function public.current_web_roles()
 returns text[]
 language sql
 stable security definer
 set search_path to ''
as $function$
  select coalesce(
    (
      select nullif(roles, array[]::text[])
      from public.web_access_contacts
      where claimed_by_user_id = auth.uid()
        and disabled = false
        and nullif(roles, array[]::text[]) is not null
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
$function$;
