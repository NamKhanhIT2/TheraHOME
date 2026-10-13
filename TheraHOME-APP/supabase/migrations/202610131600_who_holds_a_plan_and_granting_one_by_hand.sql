-- The "Gói đăng ký" tab could show how much money came in and nothing about
-- WHO it came from. Aggregates answer "is this working"; they cannot answer
-- "this customer says they paid and the app says they did not", which is the
-- question support actually gets.
--
-- Three things land here: the per-customer listing, granting a plan by hand,
-- and taking one back. The manual grant needed `platform` widened — the
-- CHECK allowed only 'ios' and 'android' — and once a non-store row can
-- exist, every revenue figure has to exclude it or "tiền đã thu" stops
-- matching what Apple will actually pay out.

alter table public.user_subscriptions drop constraint if exists user_subscriptions_platform_check;
alter table public.user_subscriptions add constraint user_subscriptions_platform_check
  check (platform = any (array['ios', 'android', 'manual']));

comment on column public.user_subscriptions.platform is
  'Which store the receipt came from, or ''manual'' for a grant made by an '
  'admin in WEB. A manual row entitles exactly like a bought one and is '
  'excluded from every revenue figure.';

create or replace function public.subscription_holders(p_limit integer default 200)
returns table (
  subscription_id uuid, user_id uuid, full_name text, email text, phone text,
  plan_code text, plan_name text, billing_type text, price_amount_vnd bigint,
  platform text, product_id text, store_subscription_id text, status text,
  auto_renewing boolean, purchased_at timestamptz, current_period_end timestamptz,
  revoked_at timestamptz, is_live boolean
)
language sql stable security definer set search_path = public
as $$
  select s.id, s.user_id, p.full_name, p.email, p.phone,
         s.plan_code, sp.name_vi, sp.billing_type, sp.price_amount_vnd,
         s.platform, s.product_id, s.store_subscription_id, s.status,
         s.auto_renewing, s.purchased_at, s.current_period_end, s.revoked_at,
         -- The same test active_plan_code() applies, spelled out so the
         -- table cannot drift from what the app grants: a row whose period
         -- ended is not live however its status column reads.
         (s.status = 'active'
          and s.revoked_at is null
          and (s.current_period_end is null or s.current_period_end > now())) as is_live
    from public.user_subscriptions s
    left join public.profiles p on p.id = s.user_id
    left join public.subscription_plans sp on sp.code = s.plan_code
   where 'admin' = any (public.current_web_roles())
      or 'cskh' = any (public.current_web_roles())
   order by s.purchased_at desc nulls last
   limit greatest(1, least(coalesce(p_limit, 200), 1000));
$$;

comment on function public.subscription_holders(integer) is
  'Every subscription with the customer and plan beside it, newest first. '
  'Staff only — the role test is inside the query, so a non-staff caller '
  'gets zero rows rather than an error.';

revoke execute on function public.subscription_holders(integer) from public, anon;
grant execute on function public.subscription_holders(integer) to authenticated;

-- Granting by hand. Two real cases: somebody paid outside the store (a bank
-- transfer at a fair), and somebody paid IN the store but the receipt never
-- verified.
create or replace function public.admin_grant_subscription(
  p_user uuid, p_plan_code text, p_months integer default null, p_note text default null
) returns public.user_subscriptions
language plpgsql security definer set search_path = public
as $$
declare
  v_row public.user_subscriptions;
  v_billing text;
  v_months integer;
begin
  if not ('admin' = any (public.current_web_roles())) then
    raise exception 'admin_required' using errcode = '42501';
  end if;
  select billing_type, period_months into v_billing, v_months
    from public.subscription_plans where code = p_plan_code;
  if v_billing is null then
    raise exception 'unknown_plan' using errcode = '22023';
  end if;

  insert into public.user_subscriptions
    (user_id, plan_code, platform, product_id, store_subscription_id, status,
     current_period_end, auto_renewing, purchased_at)
  values
    (p_user, p_plan_code, 'manual',
     coalesce(p_note, 'granted by admin'),
     -- Unique per grant and readable in the table: this is the identity the
     -- store would otherwise supply.
     'manual_' || replace(gen_random_uuid()::text, '-', ''),
     'active',
     case when v_billing = 'lifetime' then null
          else now() + make_interval(months => coalesce(p_months, v_months, 1)) end,
     false, now())
  returning * into v_row;
  return v_row;
end;
$$;

revoke execute on function public.admin_grant_subscription(uuid, text, integer, text) from public, anon;
grant execute on function public.admin_grant_subscription(uuid, text, integer, text) to authenticated;

-- Taking it back. Does NOT delete the row: the refund alert, the revenue
-- figures and any argument about what happened all depend on the record
-- surviving the revocation.
create or replace function public.admin_revoke_subscription(p_id uuid)
returns public.user_subscriptions
language plpgsql security definer set search_path = public
as $$
declare
  v_row public.user_subscriptions;
begin
  if not ('admin' = any (public.current_web_roles())) then
    raise exception 'admin_required' using errcode = '42501';
  end if;
  update public.user_subscriptions
     set status = 'revoked', revoked_at = coalesce(revoked_at, now()),
         auto_renewing = false, updated_at = now()
   where id = p_id
  returning * into v_row;
  if v_row.id is null then
    raise exception 'not_found' using errcode = '22023';
  end if;
  return v_row;
end;
$$;

revoke execute on function public.admin_revoke_subscription(uuid) from public, anon;
grant execute on function public.admin_revoke_subscription(uuid) to authenticated;
