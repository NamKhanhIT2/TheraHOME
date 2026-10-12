-- The plan cards promise seven things each. Three were enforced on
-- 2026-10-12 (chat AI, calls, form checks). These are the foundations for
-- the four that were copy and nothing else:
--
--   "Chuyên viên trả lời ưu tiên trong 2 giờ"  -> CSKH could not see who paid
--   "Hỗ trợ ưu tiên 24/7"                      -> same
--   "Giảm 10% / 15% thiết bị"                  -> no discount mechanism existed
--   "Báo cáo tiến độ gửi hàng tuần"            -> no such report existed
--   "Nhắc tập theo thói quen của riêng bạn"    -> the reminder fired at a time
--                                                 typed in by hand, and every
--                                                 free user had it too

/**
 * The tier a GIVEN user holds. `active_plan_code()` becomes a thin wrapper
 * over it, so the schema still has exactly one definition of "which tier".
 *
 * Readable by the user themselves and by staff. Anyone else gets NULL, which
 * reads identically to "no plan" — deliberately, because this is called from
 * inside a view, and raising there would fail the whole query rather than
 * hide one column.
 */
create or replace function public.plan_code_for(p_user uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select case
    when (select auth.uid()) = p_user
      or 'admin' = any (public.current_web_roles())
      or 'cskh' = any (public.current_web_roles())
    then coalesce(
      case when exists (
        select 1 from public.profiles where id = p_user and account_type = 'review'
      ) then (
        select code from public.subscription_plans
         where active and (apple_product_id is not null or google_product_id is not null)
         order by sort_order desc limit 1
      ) end,
      (
        select s.plan_code
          from public.user_subscriptions s
          left join public.subscription_plans p on p.code = s.plan_code
         where s.user_id = p_user
           and s.revoked_at is null
           and s.status = 'active'
           and (s.current_period_end is null or s.current_period_end > now())
         order by coalesce(p.sort_order, 0) desc, s.purchased_at desc
         limit 1
      )
    )
  end
$$;

create or replace function public.active_plan_code()
returns text
language sql
stable
security definer
set search_path = public
as $$ select public.plan_code_for((select auth.uid())) $$;

grant execute on function public.plan_code_for(uuid) to authenticated;

-- Priority support was a promise nobody could keep, because the CSKH chat
-- list showed no sign of who had paid for it. Three columns fix that; the
-- rest is the web UI.
--
-- DROP and recreate, not `create or replace`: Postgres refuses to reorder or
-- rename a view's existing columns, and `avatar_url` (added 202610100900)
-- sits where the new ones would land. Recreating is safe here — nothing
-- depends on this view but the web client.
drop view if exists public.chat_thread_overview;
create view public.chat_thread_overview
with (security_invoker = true) as
select
  t.id,
  t.user_id,
  t.created_at,
  p.full_name,
  p.email,
  p.language,
  p.country,
  last.created_at      as last_message_at,
  last.body            as last_body,
  last.sender_type     as last_sender_type,
  last.attachment_path as last_attachment_path,
  last.deleted_at      as last_deleted_at,
  coalesce(unread.count, 0)::int as unread_count,
  p.avatar_url,
  public.plan_code_for(t.user_id) as plan_code,
  plan.name_vi as plan_name,
  -- For sorting a queue by who is owed the fastest answer.
  plan.sort_order as plan_rank
from public.chat_threads t
left join public.profiles p on p.id = t.user_id
left join lateral (
  select m.created_at, m.body, m.sender_type, m.attachment_path, m.deleted_at
  from public.chat_messages m
  where m.thread_id = t.id
  order by m.created_at desc
  limit 1
) last on true
left join lateral (
  select count(*) as count
  from public.chat_messages m
  where m.thread_id = t.id and m.sender_type = 'user' and m.read_at is null
) unread on true
left join public.subscription_plans plan on plan.code = public.plan_code_for(t.user_id)
where t.kind = 'human'
  and last.created_at is not null;

grant select on public.chat_thread_overview to authenticated;

-- "Giảm 10% / 15% thiết bị và phụ kiện" had no mechanism at all. A code per
-- tier, editable in WEB Admin, shown in the app only to whoever holds that
-- tier. The shop is Shopify and lives outside this schema, so the code is
-- created there and only surfaced here.
alter table public.subscription_plans
  add column if not exists perk_discount_percent integer,
  add column if not exists perk_discount_code text;

comment on column public.subscription_plans.perk_discount_code is
  'Shopify discount code shown to holders of this tier. Create it in Shopify '
  'FIRST — nothing here validates it, and a code that does not exist reads to '
  'the customer as a broken promise.';

update public.subscription_plans set perk_discount_percent = 10, perk_discount_code = 'THERAPLUS10' where code = 'premium_plus';
update public.subscription_plans set perk_discount_percent = 15, perk_discount_code = 'THERALIFE15' where code = 'premium_lifetime';

/**
 * The week just gone, for "Báo cáo tiến độ gửi hàng tuần".
 *
 * Windowed on Asia/Ho_Chi_Minh like every other boundary in this schema. The
 * PREVIOUS week comes back too, so the report can say whether the discomfort
 * score is moving — the one number in here a customer cannot already see at a
 * glance in the app.
 */
create or replace function public.weekly_progress_for(p_user uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with bounds as (
    select (date_trunc('day', now() at time zone 'Asia/Ho_Chi_Minh') - interval '7 days') as week_start,
           (date_trunc('day', now() at time zone 'Asia/Ho_Chi_Minh') - interval '14 days') as prev_start
  ), prog as (
    select up.id, up.streak, up.adherence_pct, up.current_day
      from public.user_programs up
     where up.user_id = p_user
     order by up.activated_at desc nulls last
     limit 1
  )
  select jsonb_build_object(
    'days_done', (
      select count(*) from public.user_program_days d, bounds b
       where d.user_program_id = (select id from prog)
         and d.status = 'done'
         and (d.completed_at at time zone 'Asia/Ho_Chi_Minh') >= b.week_start
    ),
    'streak', coalesce((select streak from prog), 0),
    'adherence_pct', coalesce((select adherence_pct from prog), 0),
    'current_day', coalesce((select current_day from prog), 0),
    'pain_avg', (
      select round(avg(score), 1) from public.pain_logs l, bounds b
       where l.user_id = p_user and (l.logged_at at time zone 'Asia/Ho_Chi_Minh') >= b.week_start
    ),
    'pain_avg_prev', (
      select round(avg(score), 1) from public.pain_logs l, bounds b
       where l.user_id = p_user
         and (l.logged_at at time zone 'Asia/Ho_Chi_Minh') >= b.prev_start
         and (l.logged_at at time zone 'Asia/Ho_Chi_Minh') < b.week_start
    )
  )
$$;

grant execute on function public.weekly_progress_for(uuid) to authenticated;

/**
 * The hour this customer usually finishes a session, for "Nhắc tập theo thói
 * quen của riêng bạn".
 *
 * The reminder has always fired at a time the user typed in by hand, which is
 * not a habit — it is a guess they made once, probably on day one. This is
 * what makes the promise true: the app can offer their OWN habitual hour.
 *
 * NULL below four completions. Two sessions is a coincidence, not a habit,
 * and suggesting a time from it is worse than suggesting nothing.
 */
create or replace function public.suggested_reminder_hour()
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select hour from (
    select extract(hour from (d.completed_at at time zone 'Asia/Ho_Chi_Minh'))::integer as hour,
           count(*) as n
      from public.user_program_days d
      join public.user_programs up on up.id = d.user_program_id
     where up.user_id = (select auth.uid())
       and d.status = 'done'
       and d.completed_at is not null
     group by 1
     order by n desc, hour
     limit 1
  ) top
  where (
    select count(*) from public.user_program_days d2
    join public.user_programs up2 on up2.id = d2.user_program_id
   where up2.user_id = (select auth.uid()) and d2.status = 'done' and d2.completed_at is not null
  ) >= 4
$$;

grant execute on function public.suggested_reminder_hour() to authenticated;
