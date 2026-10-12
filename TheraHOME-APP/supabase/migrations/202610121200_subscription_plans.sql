-- The subscription ladder shown on the app's paywall, owned by Admin.
--
-- Until now the only thing ever sold was one phase unlock (`phase_promos` +
-- `phase_purchases`), whose copy lives per-phase. The three new paid
-- features — 1-1 voice/video consultation, video form grading, unlimited AI
-- chat — are not phases and do not belong there, so the offer itself gets a
-- table of its own and the app renders whatever is in it.
--
-- Deliberately copy-only. A row here describes a package; it does NOT grant
-- anything. Nothing reads these rows to decide what a user may do, and the
-- quotas quoted in the feature lines are still enforced by their own
-- functions — `form_review_monthly_allowance()` returns 4, which is what
-- gói "Đồng hành" promises below. Change one and change the other, by hand,
-- until there is a real entitlements table to join them.
--
-- Localisation follows `faq_items`: Vietnamese is required, EN/MS are
-- optional overrides and the app falls back to VN per field.
create table if not exists public.subscription_plans (
  id uuid primary key default gen_random_uuid(),
  -- Stable key for code to recognise a tier by. Renaming a plan in the web
  -- editor must not change which tier it is.
  code text not null unique,
  sort_order integer not null default 0,
  active boolean not null default true,
  -- The one card drawn with the accent border and shown first.
  highlighted boolean not null default false,

  name_vi text not null,
  name_en text,
  name_ms text,
  -- The one line under the plan name ("Bạn muốn tập đúng hơn?..."​).
  tagline_vi text,
  tagline_en text,
  tagline_ms text,
  -- Pill above the card: "Gói nên thử". Empty = no pill.
  badge_vi text,
  badge_en text,
  badge_ms text,
  -- Fallback price text only. When a store product id is set the app
  -- prefers the live StoreKit/Play price, exactly as the phase paywall
  -- already does with `phase_promos.unlock_price_label` — a hardcoded
  -- number here would otherwise contradict what the store charges after a
  -- price change or in another currency.
  price_label_vi text,
  price_label_en text,
  price_label_ms text,
  -- "mỗi tháng" / "" for the free tier.
  period_label_vi text,
  period_label_en text,
  period_label_ms text,

  -- [{ "icon": "<Icon name valid in BOTH apps>", "vi": "...", "en": "...",
  --    "ms": "..." }]. `icon` may be omitted — the card then draws a check.
  features jsonb not null default '[]'::jsonb,

  -- Null until the product exists in App Store Connect / Play Console. The
  -- app hides the buy button on a platform whose id is missing rather than
  -- offering a purchase that cannot complete (same rule as PhaseUnlockPromo).
  apple_product_id text,
  google_product_id text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists subscription_plans_order_idx
  on public.subscription_plans (active, sort_order);

alter table public.subscription_plans enable row level security;

-- Everyone signed in reads the ladder: a free user must be able to see what
-- the paid tiers contain, which is the entire point of showing it.
create policy "authenticated read subscription_plans" on public.subscription_plans
  for select to authenticated using (true);

-- Writes are admin-only, like every other priced/legal surface — see
-- 202609051830_restrict_app_content_writes_to_admin.sql. CSKH must not be
-- able to rewrite prices.
create policy "web admin write subscription_plans" on public.subscription_plans
  for all to authenticated
  using ('admin' = any(public.current_web_roles()))
  with check ('admin' = any(public.current_web_roles()));

-- Seed: three tiers, Vietnamese + EN/MS, as a starting draft. Every word
-- here is editable in WEB Admin → "Gói đăng ký"; the numbers in particular
-- are a proposal, not a decision.
insert into public.subscription_plans (
  code, sort_order, active, highlighted,
  name_vi, name_en, name_ms,
  tagline_vi, tagline_en, tagline_ms,
  badge_vi, badge_en, badge_ms,
  price_label_vi, price_label_en, price_label_ms,
  period_label_vi, period_label_en, period_label_ms,
  features
)
select * from (values
  (
    'free', 1, true, false,
    'Miễn phí', 'Free', 'Percuma',
    'Bắt đầu lộ trình phục hồi, không mất phí.',
      'Start your recovery plan at no cost.',
      'Mulakan pelan pemulihan anda tanpa kos.',
    null::text, null::text, null::text,
    '0đ', 'Free', 'Percuma',
    '', '', '',
    '[
      {"icon":"clipboard-check","vi":"Lộ trình tập theo ngày cho thiết bị đã kích hoạt","en":"Day-by-day plan for your activated device","ms":"Pelan harian untuk peranti yang diaktifkan"},
      {"icon":"activity","vi":"Nhật ký cơn đau và biểu đồ tiến triển","en":"Pain diary and progress chart","ms":"Diari kesakitan dan carta kemajuan"},
      {"icon":"droplet","vi":"Theo dõi uống nước mỗi ngày","en":"Daily water tracking","ms":"Penjejakan air harian"},
      {"icon":"users","vi":"Cộng đồng TheraHOME","en":"The TheraHOME community","ms":"Komuniti TheraHOME"},
      {"icon":"sparkles","vi":"Chat AI 5 lượt mỗi ngày","en":"5 AI chat messages a day","ms":"5 mesej chat AI sehari"},
      {"icon":"message-circle","vi":"Nhắn tin với chuyên viên trong giờ hành chính","en":"Message a specialist during office hours","ms":"Hantar mesej kepada pakar pada waktu pejabat"}
    ]'::jsonb
  ),
  (
    'companion', 2, true, true,
    'Đồng hành', 'Companion', 'Pendamping',
    'Tập đúng hơn mỗi ngày, có người theo sát tiến độ.',
      'Train better every day, with someone following your progress.',
      'Berlatih lebih baik setiap hari, dengan seseorang mengikuti kemajuan anda.',
    'Gói nên thử', 'Most popular', 'Paling popular',
    '99.000đ', '$3.99', 'RM18',
    'mỗi tháng', 'per month', 'sebulan',
    '[
      {"icon":"check","vi":"Tất cả quyền lợi của gói Miễn phí","en":"Everything in Free","ms":"Semua dalam pelan Percuma"},
      {"icon":"sparkles","vi":"Chat AI không giới hạn, hiểu lộ trình bạn đang tập","en":"Unlimited AI chat that knows the plan you are on","ms":"Chat AI tanpa had yang tahu pelan anda"},
      {"icon":"film","vi":"Chấm dáng tập qua video: 4 lượt mỗi tháng","en":"Video form check: 4 clips a month","ms":"Semakan postur video: 4 klip sebulan"},
      {"icon":"bell","vi":"Nhắc tập theo thói quen của riêng bạn","en":"Reminders that follow your own habits","ms":"Peringatan mengikut tabiat anda sendiri"},
      {"icon":"trending-up","vi":"Báo cáo tiến độ gửi hàng tuần","en":"A progress report every week","ms":"Laporan kemajuan setiap minggu"},
      {"icon":"clock","vi":"Chuyên viên trả lời ưu tiên trong 2 giờ làm việc","en":"Priority specialist reply within 2 working hours","ms":"Balasan pakar keutamaan dalam 2 jam bekerja"}
    ]'::jsonb
  ),
  (
    'intensive', 3, true, false,
    'Chuyên sâu', 'Intensive', 'Intensif',
    'Có chuyên viên kèm trực tiếp qua video.',
      'A specialist coaching you live, on video.',
      'Pakar membimbing anda secara langsung melalui video.',
    null::text, null::text, null::text,
    '399.000đ', '$15.99', 'RM69',
    'mỗi tháng', 'per month', 'sebulan',
    '[
      {"icon":"check","vi":"Tất cả quyền lợi của gói Đồng hành","en":"Everything in Companion","ms":"Semua dalam pelan Pendamping"},
      {"icon":"phone","vi":"2 buổi gọi video 1-1 với chuyên viên, 20 phút mỗi buổi","en":"Two 1-1 video sessions with a specialist, 20 minutes each","ms":"Dua sesi video 1-1 dengan pakar, 20 minit setiap satu"},
      {"icon":"film","vi":"Chấm dáng tập qua video không giới hạn","en":"Unlimited video form checks","ms":"Semakan postur video tanpa had"},
      {"icon":"clipboard-check","vi":"Lộ trình được điều chỉnh riêng sau mỗi buổi tư vấn","en":"Your plan adjusted after every consultation","ms":"Pelan anda diselaraskan selepas setiap konsultasi"},
      {"icon":"shield","vi":"Hỗ trợ ưu tiên 24/7","en":"Priority support, 24/7","ms":"Sokongan keutamaan, 24/7"},
      {"icon":"shopping-bag","vi":"Giảm 10% thiết bị và phụ kiện TheraHOME","en":"10% off TheraHOME devices and accessories","ms":"Diskaun 10% peranti dan aksesori TheraHOME"}
    ]'::jsonb
  )
) as seed(
  code, sort_order, active, highlighted,
  name_vi, name_en, name_ms,
  tagline_vi, tagline_en, tagline_ms,
  badge_vi, badge_en, badge_ms,
  price_label_vi, price_label_en, price_label_ms,
  period_label_vi, period_label_en, period_label_ms,
  features
)
where not exists (select 1 from public.subscription_plans);
