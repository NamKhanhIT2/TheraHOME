-- Only App Review accounts keep automatic full-catalog access (2026-09-01,
-- per explicit request). Every other TheraHOME-issued type (admin_issued,
-- tester, staff, partner) now goes through the per-product activation gate
-- like a real customer — their contact must be listed in the WEB "Kích
-- hoạt" tab (product_activation_contacts). Pairs with admin-manage-account
-- v23 (only 'review' auto-provisions at creation).

-- New-product trigger: auto-provision future products only for claimed
-- web staff and 'admin'/'review' account types (was: every thera-issued
-- type — see 202609011000_per_product_activation.sql).
create or replace function public.provision_new_product_for_claimed_users()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.user_programs (user_id, product_id, order_id)
  select u.user_id, new.id, null
  from (
    select w.claimed_by_user_id as user_id
    from public.web_access_contacts w
    where w.claimed_by_user_id is not null and w.disabled = false
    union
    select p.id
    from public.profiles p
    where p.account_type in ('admin', 'review')
  ) u
  on conflict (user_id, product_id) do nothing;

  insert into public.user_program_days (user_program_id, program_day_id, status)
  select up.id,
         pd.id,
         case when pd.day_number = 1 then 'current' else 'locked' end
  from public.user_programs up
  join public.program_days pd on pd.product_id = up.product_id
  where up.product_id = new.id
  on conflict (user_program_id, program_day_id) do nothing;

  return new;
end;
$$;

-- Revoke the auto-granted catalog from existing admin_issued accounts that
-- never redeemed an activation contact, so they hit the gate like everyone
-- else. Their synthetic <username>@thera.local access contact (created by
-- the old Edge Function provisioning) is removed too — a real phone/email
-- from the Kích hoạt list will replace it on first activation.
delete from public.user_programs up
using public.profiles p
where p.id = up.user_id
  and p.account_type = 'admin_issued'
  and not exists (
    select 1 from public.product_activation_contacts pac
    where pac.claimed_by_user_id = up.user_id and pac.product_id = up.product_id
  );

delete from public.user_access_contacts c
using public.profiles p
where p.id = c.user_id
  and p.account_type = 'admin_issued'
  and c.normalized_value like '%@thera.local'
  and not exists (
    select 1 from public.product_activation_contacts pac
    where pac.claimed_by_user_id = c.user_id
  );
