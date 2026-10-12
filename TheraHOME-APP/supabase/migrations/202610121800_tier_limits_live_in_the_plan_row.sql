-- The limits each tier grants, as data (owner 2026-10-12).
--
-- They go on the plan row rather than into the functions because the plan
-- row is also what the paywall PRINTS. While "12 lượt mỗi tháng" was copy and
-- `form_review_monthly_allowance()` returned 4, nothing stopped the two
-- drifting apart — the table comment warned about exactly that. Now the
-- sentence on the card and the number the server enforces come from the same
-- place, and WEB Admin edits both at once.
--
-- Shape of the decision:
--   chat AI         2 / 20 / 30 / 40 per DAY   (no plan / Premium / Plus / Trọn Đời)
--   gọi video       — / 30 / 100 / unlimited   MINUTES per month, any number of sessions
--   chấm dáng tập   — / 200 / 500 / 500        MB of video per month, any number of clips
--
-- Calls and clips are capped by consumption, not by occasions: the cost is
-- per minute and per megabyte, so that is what the budget is denominated in.
-- The owner has CSKH capacity to answer everything, so these exist to keep
-- the variable cost under the revenue, not to ration a specialist's time.
alter table public.subscription_plans
  add column if not exists ai_chat_per_day integer,
  add column if not exists call_minutes_per_month integer,
  add column if not exists form_review_mb_per_month integer;

comment on column public.subscription_plans.ai_chat_per_day is
  'Messages the user may send to the AI assistant per local day. NULL = unlimited.';
comment on column public.subscription_plans.call_minutes_per_month is
  'Total 1-1 call minutes per local month, any number of sessions. NULL = '
  'unlimited, which still passes through CALL_RUNAWAY_CEILING in '
  'call_minutes_allowance() — see that function.';
comment on column public.subscription_plans.form_review_mb_per_month is
  'Megabytes of form-check video per local month, any number of clips. The '
  'size is read from storage, not from the client. NULL = unlimited.';

-- How big the clip actually was. Read server-side from storage.objects at
-- request time, never sent by the client: a quota the client reports its own
-- usage against is not a quota.
alter table public.form_reviews
  add column if not exists video_bytes bigint;

update public.subscription_plans set
  ai_chat_per_day = 20, call_minutes_per_month = 30, form_review_mb_per_month = 200
 where code = 'premium';
update public.subscription_plans set
  ai_chat_per_day = 30, call_minutes_per_month = 100, form_review_mb_per_month = 500
 where code = 'premium_plus';
update public.subscription_plans set
  -- null minutes = unlimited.
  ai_chat_per_day = 40, call_minutes_per_month = null, form_review_mb_per_month = 500
 where code = 'premium_lifetime';

-- Prices (owner 2026-10-12). Premium is left at 99.000đ/month on purpose —
-- see the note reported alongside this change: at 199.000đ for three months
-- Plus works out to 66.333đ a month, which is LESS than Premium while
-- granting strictly more, so Premium cannot be sold as it stands. One field
-- in WEB Admin fixes it (99.000đ / 3 tháng would restore the ladder); it is
-- not something to change without being asked.
update public.subscription_plans set
  price_label_vi = '199.000đ', price_label_en = '$7.99', price_label_ms = 'RM35',
  period_label_vi = '3 tháng', period_label_en = '3 months', period_label_ms = '3 bulan'
 where code = 'premium_plus';
update public.subscription_plans set
  price_label_vi = '1.990.000đ', price_label_en = '$79', price_label_ms = 'RM339'
 where code = 'premium_lifetime';

-- The benefit lines, rewritten so the card states the same numbers the
-- functions below enforce.
update public.subscription_plans set features = '[
  {"icon":"sparkles","vi":"Chat AI 20 lượt mỗi ngày","en":"20 AI chat messages a day","ms":"20 mesej chat AI sehari"},
  {"icon":"phone","vi":"Gọi video 1-1 với chuyên viên: 30 phút mỗi tháng","en":"1-1 video with a specialist: 30 minutes a month","ms":"Video 1-1 dengan pakar: 30 minit sebulan"},
  {"icon":"film","vi":"Chấm dáng tập không giới hạn số lần · tối đa 200 MB video mỗi tháng","en":"Unlimited form checks · up to 200 MB of video a month","ms":"Semakan postur tanpa had · sehingga 200 MB video sebulan"},
  {"icon":"bell","vi":"Nhắc tập theo thói quen của riêng bạn","en":"Reminders that follow your own habits","ms":"Peringatan mengikut tabiat anda sendiri"},
  {"icon":"trending-up","vi":"Báo cáo tiến độ gửi hàng tuần","en":"A progress report every week","ms":"Laporan kemajuan setiap minggu"},
  {"icon":"clock","vi":"Chuyên viên trả lời ưu tiên trong 2 giờ làm việc","en":"Priority specialist reply within 2 working hours","ms":"Balasan pakar keutamaan dalam 2 jam bekerja"}
]'::jsonb where code = 'premium';

update public.subscription_plans set features = '[
  {"icon":"check","vi":"Tất cả quyền lợi của Premium","en":"Everything in Premium","ms":"Semua dalam Premium"},
  {"icon":"sparkles","vi":"Chat AI 30 lượt mỗi ngày","en":"30 AI chat messages a day","ms":"30 mesej chat AI sehari"},
  {"icon":"phone","vi":"Gọi video 1-1: 100 phút mỗi tháng, không giới hạn số buổi","en":"1-1 video: 100 minutes a month, any number of sessions","ms":"Video 1-1: 100 minit sebulan, tanpa had sesi"},
  {"icon":"film","vi":"Chấm dáng tập không giới hạn số lần · tối đa 500 MB video mỗi tháng","en":"Unlimited form checks · up to 500 MB of video a month","ms":"Semakan postur tanpa had · sehingga 500 MB video sebulan"},
  {"icon":"clipboard-check","vi":"Lộ trình được điều chỉnh riêng sau mỗi buổi tư vấn","en":"Your plan adjusted after every consultation","ms":"Pelan anda diselaraskan selepas setiap konsultasi"},
  {"icon":"shield","vi":"Hỗ trợ ưu tiên 24/7","en":"Priority support, 24/7","ms":"Sokongan keutamaan, 24/7"},
  {"icon":"shopping-bag","vi":"Giảm 10% thiết bị và phụ kiện TheraHOME","en":"10% off TheraHOME devices and accessories","ms":"Diskaun 10% peranti dan aksesori TheraHOME"}
]'::jsonb where code = 'premium_plus';

update public.subscription_plans set features = '[
  {"icon":"check","vi":"Tất cả quyền lợi của Premium Plus, trọn đời","en":"Everything in Premium Plus, for good","ms":"Semua dalam Premium Plus, selamanya"},
  {"icon":"sparkles","vi":"Chat AI 40 lượt mỗi ngày","en":"40 AI chat messages a day","ms":"40 mesej chat AI sehari"},
  {"icon":"phone","vi":"Gọi video 1-1 không giới hạn thời lượng","en":"1-1 video calls with no time limit","ms":"Panggilan video 1-1 tanpa had masa"},
  {"icon":"film","vi":"Chấm dáng tập không giới hạn số lần · tối đa 500 MB video mỗi tháng","en":"Unlimited form checks · up to 500 MB of video a month","ms":"Semakan postur tanpa had · sehingga 500 MB video sebulan"},
  {"icon":"star","vi":"Không gia hạn, không thu thêm hằng tháng","en":"No renewal, nothing charged monthly","ms":"Tiada pembaharuan, tiada caj bulanan"},
  {"icon":"shopping-bag","vi":"Giảm 15% thiết bị và phụ kiện TheraHOME","en":"15% off TheraHOME devices and accessories","ms":"Diskaun 15% peranti dan aksesori TheraHOME"}
]'::jsonb where code = 'premium_lifetime';

-- ---------------------------------------------------------------------------
-- Allowances and usage
-- ---------------------------------------------------------------------------
--
-- Every boundary below is in Asia/Ho_Chi_Minh, not UTC. A UTC day rolls over
-- at 07:00 local, so a daily quota would refill mid-morning — and the app
-- already opens roadmap days at local midnight, so two different "days"
-- would be visible in one product.

/** The limits that apply with no subscription at all.
 *
 * There is no free row on the paywall any more, but there are still people
 * who only own a device — this is what they get. 2 AI messages a day is
 * deliberately tight: the measured median is 2, so a regular user meets the
 * wall most days, which is the only thing that makes a paywall work. Calls
 * and form checks are paid-only.
 *
 * Not editable from WEB Admin on purpose: a plan row describes something
 * being sold, and this is the absence of one. */
create or replace function public.baseline_limits()
returns table (ai_chat_per_day integer, call_minutes_per_month integer, form_review_mb_per_month integer)
language sql immutable
as $$ select 2, 0, 0 $$;

/** The ceiling applied when a plan says "unlimited" minutes.
 *
 * Premium Trọn Đời is paid once and grants calls forever, so "unlimited"
 * with nothing behind it is an open-ended bill against a closed revenue.
 * 600 minutes is 10 hours of 1-1 video a month: no rehab customer needs
 * that, so the card's promise stays true for every real user while a runaway
 * client or a resold account cannot drain the LiveKit quota. Same reasoning
 * the owner accepted for the AI chat's silent cap.
 *
 * Raise or remove it here; it is one number in one place. */
create or replace function public.call_runaway_ceiling()
returns integer language sql immutable as $$ select 600 $$;

/** Messages per local day the caller may send to the AI assistant.
 * NULL means genuinely unlimited (no plan sets that today). */
create or replace function public.ai_chat_daily_allowance()
returns integer
language sql stable security definer set search_path = public
as $$
  select case
    -- App Review and staff accounts pass through every gate in this schema.
    when exists (select 1 from public.profiles where id = (select auth.uid()) and account_type = 'review')
      then null::integer
    else coalesce(
      (select p.ai_chat_per_day from public.subscription_plans p
        where p.code = public.active_plan_code()),
      (select b.ai_chat_per_day from public.baseline_limits() b)
    )
  end
$$;

create or replace function public.ai_chat_used_today()
returns integer
language sql stable security definer set search_path = public
as $$
  select count(*)::integer
    from public.chat_messages m
    join public.chat_threads t on t.id = m.thread_id
   where t.user_id = (select auth.uid())
     and t.kind = 'ai'
     and m.sender_type = 'user'
     and (m.created_at at time zone 'Asia/Ho_Chi_Minh')::date
       = (now() at time zone 'Asia/Ho_Chi_Minh')::date
$$;

/** Call minutes per local month. NULL is never returned: an "unlimited" plan
 * resolves to call_runaway_ceiling() so the caller always has a number to
 * compare against. */
create or replace function public.call_minutes_allowance()
returns integer
language sql stable security definer set search_path = public
as $$
  select case
    when exists (select 1 from public.profiles where id = (select auth.uid()) and account_type = 'review')
      then public.call_runaway_ceiling()
    when public.active_plan_code() is null
      then (select b.call_minutes_per_month from public.baseline_limits() b)
    else coalesce(
      (select p.call_minutes_per_month from public.subscription_plans p
        where p.code = public.active_plan_code()),
      public.call_runaway_ceiling()
    )
  end
$$;

/** Minutes already spent this local month, rounded UP per call.
 *
 * Rounding up matches how LiveKit bills (a 10-second connection is a billed
 * minute), so the number the customer is measured against is the number the
 * invoice is measured against. Counts both directions: a customer can be the
 * caller or the one called. */
create or replace function public.call_minutes_used_this_month()
returns integer
language sql stable security definer set search_path = public
as $$
  select coalesce(sum(ceil(coalesce(c.duration_seconds, 0) / 60.0)), 0)::integer
    from public.calls c
   where (c.caller_id = (select auth.uid()) or c.callee_id = (select auth.uid()))
     and c.duration_seconds is not null
     and date_trunc('month', c.created_at at time zone 'Asia/Ho_Chi_Minh')
       = date_trunc('month', now() at time zone 'Asia/Ho_Chi_Minh')
$$;

/** Megabytes of form-check video per local month. */
create or replace function public.form_review_mb_allowance()
returns integer
language sql stable security definer set search_path = public
as $$
  select case
    when exists (select 1 from public.profiles where id = (select auth.uid()) and account_type = 'review')
      then 100000
    when public.active_plan_code() is null
      then (select b.form_review_mb_per_month from public.baseline_limits() b)
    else coalesce(
      (select p.form_review_mb_per_month from public.subscription_plans p
        where p.code = public.active_plan_code()),
      100000
    )
  end
$$;

/** Megabytes already uploaded this local month. Cancelled reviews do not
 * count — a clip the specialist rejected as "not an exercise video" should
 * not consume the customer's budget. */
create or replace function public.form_review_mb_used_this_month()
returns numeric
language sql stable security definer set search_path = public
as $$
  select round(coalesce(sum(video_bytes), 0) / 1048576.0, 2)
    from public.form_reviews
   where user_id = (select auth.uid())
     and status <> 'cancelled'
     and date_trunc('month', created_at at time zone 'Asia/Ho_Chi_Minh')
       = date_trunc('month', now() at time zone 'Asia/Ho_Chi_Minh')
$$;

revoke all on function public.baseline_limits() from public, anon;
revoke all on function public.call_runaway_ceiling() from public, anon;
grant execute on function public.ai_chat_daily_allowance() to authenticated;
grant execute on function public.ai_chat_used_today() to authenticated;
grant execute on function public.call_minutes_allowance() to authenticated;
grant execute on function public.call_minutes_used_this_month() to authenticated;
grant execute on function public.form_review_mb_allowance() to authenticated;
grant execute on function public.form_review_mb_used_this_month() to authenticated;

-- ---------------------------------------------------------------------------
-- request_form_review: budget in megabytes, not in occasions
-- ---------------------------------------------------------------------------
--
-- Two changes. The monthly cap is now a byte budget, and the clip's size is
-- read from storage rather than taken on trust — the client uploads the file
-- and then asks for a review, so by this point the object exists and its real
-- size is knowable. The per-clip ceiling is what stops one enormous upload
-- eating a whole month in a single request.
--
-- The "one pending at a time" rule is dropped: the owner can answer
-- everything, so queueing several clips is allowed, and the byte budget is
-- what limits the queue.
create or replace function public.request_form_review(
  p_thread_id uuid,
  p_message_id uuid,
  p_user_program_id uuid default null,
  p_program_day_id uuid default null,
  p_day_number integer default null,
  p_day_label text default null
)
returns public.form_reviews
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_message public.chat_messages;
  v_bytes bigint;
  v_used numeric;
  v_allowance integer;
  v_row public.form_reviews;
begin
  if v_user is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;

  select * into v_message from public.chat_messages where id = p_message_id;
  if v_message.id is null then
    raise exception 'message_not_found' using errcode = 'P0002';
  end if;
  if v_message.sender_id is distinct from v_user or v_message.thread_id is distinct from p_thread_id then
    raise exception 'not_your_message' using errcode = '42501';
  end if;
  if v_message.attachment_path is null then
    raise exception 'attachment_required' using errcode = '22023';
  end if;

  -- The authoritative size. Null when storage has not caught up yet, which
  -- is treated as 0 rather than refused: the upload demonstrably succeeded
  -- (the message carries its path), and billing a customer's budget for a
  -- number we failed to read would be the wrong way round.
  select (metadata->>'size')::bigint into v_bytes
    from storage.objects
   where bucket_id = 'chat-attachments' and name = v_message.attachment_path;
  v_bytes := coalesce(v_bytes, 0);

  v_allowance := public.form_review_mb_allowance();
  if v_allowance <= 0 then
    raise exception 'plan_required' using errcode = '22023';
  end if;

  -- One clip may not exceed a quarter of the monthly budget. 200 MB/month at
  -- 15 seconds and quality 0.5 is ~40 clips, so a single 50 MB file is not a
  -- phone clip of an exercise — it is a mistake or an attempt.
  if v_bytes > (v_allowance::bigint * 1048576) / 4 then
    raise exception 'clip_too_large' using errcode = '22023';
  end if;

  v_used := public.form_review_mb_used_this_month();
  if v_used + (v_bytes / 1048576.0) > v_allowance then
    raise exception 'monthly_allowance_reached' using errcode = '22023';
  end if;

  insert into public.form_reviews (
    user_id, thread_id, message_id, user_program_id, program_day_id, day_number, day_label, video_bytes
  ) values (
    v_user, p_thread_id, p_message_id, p_user_program_id, p_program_day_id, p_day_number, p_day_label, v_bytes
  )
  returning * into v_row;

  return v_row;
end;
$$;

-- Superseded by form_review_mb_allowance(). Kept, not dropped: an older
-- binary in the wild still calls it, and answering 0 there would read as
-- "your plan is used up" rather than "this build is out of date".
comment on function public.form_review_monthly_allowance() is
  'SUPERSEDED 2026-10-12 by form_review_mb_allowance(). The cap is a monthly '
  'byte budget now, not a count of clips. Still here only for builds shipped '
  'before that change; delete once none are in use.';
