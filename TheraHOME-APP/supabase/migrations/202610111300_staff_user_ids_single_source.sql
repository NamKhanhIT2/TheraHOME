-- Who is staff, answered in ONE place.
--
-- There were two answers to that question and they disagreed:
--
--   `current_web_roles()` (the RPC every RLS policy and the staff shell use)
--     → a `web_access_contacts` row with non-empty roles, FALLING BACK to
--       `profiles.account_type` in ('admin','cskh').
--
--   `dispatch-push` (the Edge Function that rings staff phones)
--     → `web_access_contacts` rows with non-empty roles. No fallback.
--
-- On this project every enabled, claimed `web_access_contacts` row has an
-- EMPTY roles array, and all three real staff accounts are staff only by way
-- of `profiles.account_type`. So the push function resolved **zero**
-- recipients: staff have not been receiving the "Tin nhắn hỗ trợ mới" push
-- since that path shipped, and the voice-call push inherited the same bug by
-- copying the same query.
--
-- Verified 2026-10-11: dispatch-push would ring 0 accounts; 3 accounts can
-- actually answer.
--
-- Fix: one function, mirroring `current_web_roles()`'s own two sources, that
-- both the RPC layer and the Edge Function read. A future change to what
-- "staff" means now has a single place to happen.
create or replace function public.staff_user_ids()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  -- Source 1: an explicit web_access_contacts grant.
  select w.claimed_by_user_id
  from public.web_access_contacts w
  where w.disabled = false
    and w.claimed_by_user_id is not null
    and exists (select 1 from unnest(w.roles) r where r in ('admin', 'cskh'))
  union
  -- Source 2: the account type itself, same conditions current_web_roles()
  -- applies — a locked or expired staff account is not staff.
  select p.id
  from public.profiles p
  where p.account_type in ('admin', 'cskh')
    and coalesce(p.locked, false) = false
    and (p.expires_at is null or p.expires_at > now())
    and p.deleted_at is null;
$$;

-- Read by the service-role client inside dispatch-push. Not granted to
-- `authenticated`: the list of staff accounts is not something a customer's
-- client needs, and (as 202610111030 recorded) a plain revoke from
-- public/anon is not enough on this project to keep a function off the REST
-- API — `authenticated` must be named.
revoke all on function public.staff_user_ids() from public, anon, authenticated;
grant execute on function public.staff_user_ids() to service_role;
