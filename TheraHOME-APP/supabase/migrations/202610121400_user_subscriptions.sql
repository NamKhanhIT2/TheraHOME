-- Who holds which subscription tier.
--
-- `subscription_plans` is the offer (copy, prices, benefit lines). This is
-- the other half: one row per subscription a store has actually confirmed,
-- written ONLY by the `verify-subscription` Edge Function under the service
-- role. Nothing a client sends lands here directly.
--
-- Shaped after `phase_purchases`, with the one difference that matters: a
-- phase unlock is permanent, a subscription expires. So the row carries
-- `current_period_end` and is only an entitlement while that is in the
-- future — a lapsed subscription stops granting without anything having to
-- run on a schedule.
create table if not exists public.user_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  -- subscription_plans.code. Not a foreign key on purpose: a plan row may be
  -- renamed or retired, and a paid subscription must survive that rather
  -- than cascade away or block the edit.
  plan_code text not null,
  platform text not null check (platform in ('ios', 'android')),
  product_id text not null,
  -- The store's stable identity for this subscription, NOT for one renewal:
  -- Apple's originalTransactionId, Google's purchaseToken. Keyed this way so
  -- a renewal updates the same row instead of piling up one row a month.
  store_subscription_id text not null,
  status text not null default 'active' check (status in ('active', 'expired', 'revoked')),
  -- Null means "the store did not say" — treated as still valid, since a
  -- confirmed purchase with an unknown end date should not lock someone out.
  current_period_end timestamptz,
  auto_renewing boolean,
  purchased_at timestamptz not null default now(),
  -- Refunded. Separate from status='expired': a refund must not come back
  -- just because a later renewal webhook says the period is open.
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- One row per store subscription, which is what makes verification
-- idempotent and what stops a leaked receipt being claimed twice.
create unique index if not exists user_subscriptions_store_id_idx
  on public.user_subscriptions (platform, store_subscription_id);
create index if not exists user_subscriptions_user_idx
  on public.user_subscriptions (user_id, status);

alter table public.user_subscriptions enable row level security;

-- Read your own, and only your own. There is deliberately NO insert/update
-- policy: if a client could write here it could grant itself a tier, so
-- every write goes through the Edge Function's service role.
create policy "own user_subscriptions select" on public.user_subscriptions
  for select to authenticated using ((select auth.uid()) = user_id);

-- Staff read them for support, same as they already read phase purchases in
-- WEB CSKH's "Khảo sát & Giao dịch" tab.
create policy "web staff read user_subscriptions" on public.user_subscriptions
  for select to authenticated
  using ('admin' = any(public.current_web_roles()) or 'cskh' = any(public.current_web_roles()));

/**
 * The tier the caller holds right now, or null.
 *
 * One place that decides, so a feature gate never re-derives the rules and
 * gets them subtly different. Expiry is evaluated here, on read, rather than
 * by a job that flips rows — nothing has to run on time for a lapsed
 * subscription to stop granting.
 *
 * Review accounts hold the top paid tier unconditionally: App Review has to
 * be able to reach every paid feature without making a purchase, and the
 * same rule already exempts them from every other gate and limit in this
 * schema.
 */
create or replace function public.active_plan_code()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    case when exists (
      select 1 from public.profiles where id = (select auth.uid()) and account_type = 'review'
    ) then (
      select code from public.subscription_plans
       where active and (apple_product_id is not null or google_product_id is not null)
       order by sort_order desc
       limit 1
    ) end,
    (
      select s.plan_code from public.user_subscriptions s
       where s.user_id = (select auth.uid())
         and s.revoked_at is null
         and s.status = 'active'
         and (s.current_period_end is null or s.current_period_end > now())
       order by s.current_period_end desc nulls last
       limit 1
    )
  )
$$;

revoke all on function public.active_plan_code() from public;
grant execute on function public.active_plan_code() to authenticated;

-- The upgrade card on Home. Copy lives in app_config like every other
-- app-wide string, so WEB Admin → "Nội dung ứng dụng" edits it; leaving a
-- value empty makes the card fall back to the highlighted plan's own name
-- and tagline, so it can never render blank.
insert into public.app_config (key, value_vi, value_en, value_ms)
values
  ('upgrade_card_title',
   'Nâng cấp để tập đúng hơn',
   'Upgrade and train better',
   'Tingkatkan dan berlatih lebih baik'),
  ('upgrade_card_body',
   'Mở khoá chấm dáng tập qua video, chat AI không giới hạn và gọi 1-1 với chuyên viên.',
   'Unlock video form checks, unlimited AI chat and 1-1 calls with a specialist.',
   'Buka semakan postur video, chat AI tanpa had dan panggilan 1-1 dengan pakar.')
on conflict (key) do nothing;
