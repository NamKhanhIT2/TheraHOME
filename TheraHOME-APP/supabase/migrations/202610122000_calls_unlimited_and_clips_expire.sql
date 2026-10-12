-- Two decisions from the owner, 2026-10-12.
--
-- 1. Every paid tier gets UNLIMITED call minutes. The reasoning is that
--    aggregate usage is observable and the answer to growth is a paid
--    LiveKit plan, not a smaller promise. So "không giới hạn" now means it,
--    and `call_runaway_ceiling()` is gone rather than quietly capping a card
--    that says otherwise — a limit the paywall does not mention is the
--    copy-versus-enforcement drift this schema keeps trying to avoid.
--
--    What that leaves open, stated here so the trade is on the record: the
--    LiveKit free tier is 5,000 participant-minutes a month, which is about
--    41 hours of 1-1 calling for the WHOLE app. Aggregate growth is visible
--    in advance; one account calling continuously is not, and could take
--    the month's capacity down for everybody in a couple of days. The fix
--    if it ever happens is per-account, and it belongs next to whatever
--    detects it.
--
-- 2. Form-check clips expire. The project is on Supabase's free plan — 1 GB
--    of file storage as a hard cap that disrupts service rather than billing
--    for the overage — and nothing deleted a clip. The owner's position is
--    that the monthly quotas will not actually be used up and Pro can wait;
--    this is what makes that true, because it caps the STANDING total at
--    roughly half a month of uploads instead of letting every clip ever sent
--    accumulate for ever.
-- Also closing out the pricing question 202610121800 left open. Premium stays
-- at 99.000đ a month beside Plus at 199.000đ for three months, and the owner
-- confirms that is intended: Premium is the month-to-month option and Plus
-- asks for a three-month commitment, so the lower per-month rate is what the
-- commitment buys. Flexibility costs more than committing — an ordinary
-- structure, and not the inversion that migration worried about.

update public.subscription_plans
   set call_minutes_per_month = null
 where code in ('premium', 'premium_plus', 'premium_lifetime');

-- NULL now reaches the caller as NULL. Previously an unlimited plan was
-- resolved to a ceiling so the client always had a number; it has to handle
-- "no limit" explicitly instead.
create or replace function public.call_minutes_allowance()
returns integer
language sql stable security definer set search_path = public
as $$
  select case
    -- App Review and staff: unlimited, like every other gate in this schema.
    when exists (select 1 from public.profiles where id = (select auth.uid()) and account_type = 'review')
      then null::integer
    -- No subscription: calls are the paid feature, so nothing.
    when public.active_plan_code() is null
      then (select b.call_minutes_per_month from public.baseline_limits() b)
    -- A plan's NULL means unlimited and is returned as such.
    else (select p.call_minutes_per_month from public.subscription_plans p
           where p.code = public.active_plan_code())
  end
$$;

comment on function public.call_minutes_allowance() is
  'Call minutes allowed this local month. NULL means unlimited — every paid '
  'tier returns NULL as of 2026-10-12. 0 means no access (no subscription). '
  'Compare against call_minutes_used_this_month().';

comment on column public.subscription_plans.call_minutes_per_month is
  'Total 1-1 call minutes per local month, any number of sessions. NULL = '
  'unlimited, with nothing behind it — see 202610122000.';

drop function if exists public.call_runaway_ceiling();

-- Whole arrays, not jsonb_set by index: a positional write would land in the
-- wrong slot if anyone reordered the benefit lines in WEB Admin first, and
-- there would be nothing to see except a sentence in the wrong place.
update public.subscription_plans set features = '[
  {"icon":"sparkles","vi":"Chat AI 20 lượt mỗi ngày","en":"20 AI chat messages a day","ms":"20 mesej chat AI sehari"},
  {"icon":"phone","vi":"Gọi video 1-1 với chuyên viên, không giới hạn","en":"1-1 video with a specialist, unlimited","ms":"Video 1-1 dengan pakar, tanpa had"},
  {"icon":"film","vi":"Chấm dáng tập không giới hạn số lần · tối đa 200 MB video mỗi tháng","en":"Unlimited form checks · up to 200 MB of video a month","ms":"Semakan postur tanpa had · sehingga 200 MB video sebulan"},
  {"icon":"bell","vi":"Nhắc tập theo thói quen của riêng bạn","en":"Reminders that follow your own habits","ms":"Peringatan mengikut tabiat anda sendiri"},
  {"icon":"trending-up","vi":"Báo cáo tiến độ gửi hàng tuần","en":"A progress report every week","ms":"Laporan kemajuan setiap minggu"},
  {"icon":"clock","vi":"Chuyên viên trả lời ưu tiên trong 2 giờ làm việc","en":"Priority specialist reply within 2 working hours","ms":"Balasan pakar keutamaan dalam 2 jam bekerja"}
]'::jsonb where code = 'premium';

update public.subscription_plans set features = '[
  {"icon":"check","vi":"Tất cả quyền lợi của Premium","en":"Everything in Premium","ms":"Semua dalam Premium"},
  {"icon":"sparkles","vi":"Chat AI 30 lượt mỗi ngày","en":"30 AI chat messages a day","ms":"30 mesej chat AI sehari"},
  {"icon":"phone","vi":"Gọi video 1-1 với chuyên viên, không giới hạn","en":"1-1 video with a specialist, unlimited","ms":"Video 1-1 dengan pakar, tanpa had"},
  {"icon":"film","vi":"Chấm dáng tập không giới hạn số lần · tối đa 500 MB video mỗi tháng","en":"Unlimited form checks · up to 500 MB of video a month","ms":"Semakan postur tanpa had · sehingga 500 MB video sebulan"},
  {"icon":"clipboard-check","vi":"Lộ trình được điều chỉnh riêng sau mỗi buổi tư vấn","en":"Your plan adjusted after every consultation","ms":"Pelan anda diselaraskan selepas setiap konsultasi"},
  {"icon":"shield","vi":"Hỗ trợ ưu tiên 24/7","en":"Priority support, 24/7","ms":"Sokongan keutamaan, 24/7"},
  {"icon":"shopping-bag","vi":"Giảm 10% thiết bị và phụ kiện TheraHOME","en":"10% off TheraHOME devices and accessories","ms":"Diskaun 10% peranti dan aksesori TheraHOME"}
]'::jsonb where code = 'premium_plus';

-- ---------------------------------------------------------------------------
-- Clip retention
-- ---------------------------------------------------------------------------

-- Set when the FILE has been deleted. The row and the specialist's written
-- answer stay — that is the part the customer paid for.
alter table public.form_reviews
  add column if not exists clip_deleted_at timestamptz;

comment on column public.form_reviews.clip_deleted_at is
  'When the video file was deleted by prune-form-review-clips. The review '
  'and its reply are kept; only the clip goes. NULL = the file is still '
  'there (or the review is still pending, which keeps its clip whatever its '
  'age).';

-- The prune job''s exact query: finished reviews whose file is still around.
create index if not exists form_reviews_prunable_idx
  on public.form_reviews (status, reviewed_at)
  where clip_deleted_at is null;

-- 04:10 UTC = 11:10 Hanoi. Thirty minutes after the Apple refund sweep so no
-- two jobs share a minute, and it reuses that job''s Vault secret: one shared
-- cron value, read at call time, never pasted into a dashboard env var.
select cron.schedule(
  'prune-form-review-clips-daily',
  '10 4 * * *',
  $job$
  select net.http_post(
    url := 'https://nyjvtvmllwbyfokldgtj.supabase.co/functions/v1/prune-form-review-clips',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-prune-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'voided_cron_secret')
    ),
    body := '{}'::jsonb
  );
  $job$
);
