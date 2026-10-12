-- No free tier on the paywall, and the top tier is bought once: Premium,
-- Premium Plus, Premium Trọn Đời (owner 2026-10-12).
--
-- The third one is not a subscription. "Trọn đời" is a one-off purchase, and
-- the stores model that as a different product type entirely — a
-- Non-Consumable on Apple, a one-time in-app product on Google, neither of
-- which lives in a subscription group or has a base plan. The client has to
-- ask for it with type 'in-app' and the server has to verify it against a
-- different endpoint, so the plan row now says which kind it is rather than
-- leaving either side to guess from the price label.
alter table public.subscription_plans
  add column if not exists billing_type text not null default 'subscription'
    check (billing_type in ('subscription', 'lifetime'));

comment on column public.subscription_plans.billing_type is
  'subscription = auto-renewing (Apple subscription group / Play base plan). '
  'lifetime = bought once (Apple Non-Consumable / Play one-time product); '
  'its user_subscriptions row carries no current_period_end and never expires.';

-- The free row is gone and the two paid codes are renamed, so the old three
-- are replaced wholesale. Safe only because nothing has been sold yet:
-- user_subscriptions is empty and no plan has a store product id
-- (both checked against production before writing this).
delete from public.subscription_plans
 where code in ('free', 'companion', 'intensive');

insert into public.subscription_plans (
  code, sort_order, active, highlighted, billing_type,
  name_vi, name_en, name_ms,
  tagline_vi, tagline_en, tagline_ms,
  badge_vi, badge_en, badge_ms,
  price_label_vi, price_label_en, price_label_ms,
  period_label_vi, period_label_en, period_label_ms,
  features
)
select * from (values
  (
    'premium', 1, true, false, 'subscription',
    'Premium', 'Premium', 'Premium',
    'Tập đúng hơn mỗi ngày, có người theo sát tiến độ.',
      'Train better every day, with someone following your progress.',
      'Berlatih lebih baik setiap hari, dengan seseorang mengikuti kemajuan anda.',
    null::text, null::text, null::text,
    '99.000đ', '$3.99', 'RM18',
    'mỗi tháng', 'per month', 'sebulan',
    '[
      {"icon":"sparkles","vi":"Chat AI không giới hạn, hiểu lộ trình bạn đang tập","en":"Unlimited AI chat that knows the plan you are on","ms":"Chat AI tanpa had yang tahu pelan anda"},
      {"icon":"film","vi":"Chấm dáng tập qua video: 4 lượt mỗi tháng","en":"Video form check: 4 clips a month","ms":"Semakan postur video: 4 klip sebulan"},
      {"icon":"bell","vi":"Nhắc tập theo thói quen của riêng bạn","en":"Reminders that follow your own habits","ms":"Peringatan mengikut tabiat anda sendiri"},
      {"icon":"trending-up","vi":"Báo cáo tiến độ gửi hàng tuần","en":"A progress report every week","ms":"Laporan kemajuan setiap minggu"},
      {"icon":"clock","vi":"Chuyên viên trả lời ưu tiên trong 2 giờ làm việc","en":"Priority specialist reply within 2 working hours","ms":"Balasan pakar keutamaan dalam 2 jam bekerja"}
    ]'::jsonb
  ),
  (
    'premium_plus', 2, true, true, 'subscription',
    'Premium Plus', 'Premium Plus', 'Premium Plus',
    'Có chuyên viên kèm trực tiếp qua video.',
      'A specialist coaching you live, on video.',
      'Pakar membimbing anda secara langsung melalui video.',
    'Gói nên thử', 'Most popular', 'Paling popular',
    '399.000đ', '$15.99', 'RM69',
    'mỗi tháng', 'per month', 'sebulan',
    '[
      {"icon":"check","vi":"Tất cả quyền lợi của Premium","en":"Everything in Premium","ms":"Semua dalam Premium"},
      {"icon":"phone","vi":"2 buổi gọi video 1-1 với chuyên viên mỗi tháng, 20 phút mỗi buổi","en":"Two 1-1 video sessions with a specialist a month, 20 minutes each","ms":"Dua sesi video 1-1 dengan pakar sebulan, 20 minit setiap satu"},
      {"icon":"film","vi":"Chấm dáng tập qua video: 12 lượt mỗi tháng","en":"Video form check: 12 clips a month","ms":"Semakan postur video: 12 klip sebulan"},
      {"icon":"clipboard-check","vi":"Lộ trình được điều chỉnh riêng sau mỗi buổi tư vấn","en":"Your plan adjusted after every consultation","ms":"Pelan anda diselaraskan selepas setiap konsultasi"},
      {"icon":"shield","vi":"Hỗ trợ ưu tiên 24/7","en":"Priority support, 24/7","ms":"Sokongan keutamaan, 24/7"},
      {"icon":"shopping-bag","vi":"Giảm 10% thiết bị và phụ kiện TheraHOME","en":"10% off TheraHOME devices and accessories","ms":"Diskaun 10% peranti dan aksesori TheraHOME"}
    ]'::jsonb
  ),
  (
    'premium_lifetime', 3, true, false, 'lifetime',
    'Premium Trọn Đời', 'Premium Lifetime', 'Premium Sepanjang Hayat',
    'Trả một lần, dùng mãi, không gia hạn.',
      'Pay once, keep it for good, nothing to renew.',
      'Bayar sekali, simpan selamanya, tiada pembaharuan.',
    'Trả một lần', 'One-time', 'Bayaran sekali',
    '4.990.000đ', '$199', 'RM849',
    'thanh toán một lần', 'one-time payment', 'bayaran sekali',
    '[
      {"icon":"check","vi":"Tất cả quyền lợi của Premium Plus, trọn đời","en":"Everything in Premium Plus, for good","ms":"Semua dalam Premium Plus, selamanya"},
      {"icon":"star","vi":"Không gia hạn, không thu thêm hằng tháng","en":"No renewal, nothing charged monthly","ms":"Tiada pembaharuan, tiada caj bulanan"},
      {"icon":"phone","vi":"2 buổi gọi video 1-1 mỗi tháng, 20 phút mỗi buổi","en":"Two 1-1 video sessions a month, 20 minutes each","ms":"Dua sesi video 1-1 sebulan, 20 minit setiap satu"},
      {"icon":"film","vi":"Chấm dáng tập qua video: 12 lượt mỗi tháng","en":"Video form check: 12 clips a month","ms":"Semakan postur video: 12 klip sebulan"},
      {"icon":"shopping-bag","vi":"Giảm 15% thiết bị và phụ kiện TheraHOME","en":"15% off TheraHOME devices and accessories","ms":"Diskaun 15% peranti dan aksesori TheraHOME"}
    ]'::jsonb
  )
) as seed(
  code, sort_order, active, highlighted, billing_type,
  name_vi, name_en, name_ms,
  tagline_vi, tagline_en, tagline_ms,
  badge_vi, badge_en, badge_ms,
  price_label_vi, price_label_en, price_label_ms,
  period_label_vi, period_label_en, period_label_ms,
  features
)
where not exists (select 1 from public.subscription_plans);

/**
 * Highest tier wins, by the plan's own order in WEB Admin.
 *
 * The previous version ordered by `current_period_end desc nulls last`,
 * which was fine while every tier was monthly and is wrong now: a lifetime
 * row has NO end date, so `nulls last` ranked the forever tier below a
 * monthly one. Somebody holding both would have been served the smaller.
 *
 * LEFT join on purpose. A plan retired or renamed in WEB Admin must not
 * silently revoke a subscription somebody paid for, so a row whose
 * plan_code no longer matches still counts — it just sorts last.
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
      select s.plan_code
        from public.user_subscriptions s
        left join public.subscription_plans p on p.code = s.plan_code
       where s.user_id = (select auth.uid())
         and s.revoked_at is null
         and s.status = 'active'
         and (s.current_period_end is null or s.current_period_end > now())
       order by coalesce(p.sort_order, 0) desc, s.purchased_at desc
       limit 1
    )
  )
$$;
