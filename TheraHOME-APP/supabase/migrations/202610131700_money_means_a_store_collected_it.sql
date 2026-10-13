-- A hand-granted subscription entitles exactly like a bought one, so it must
-- NOT be counted as money. Without this the panel's one job — a figure the
-- owner can hold against Apple's payout — stops being checkable the first
-- time support comps somebody a month.
--
-- `periods` gains is_paid; every money figure filters on it; `granted`
-- counts what was excluded, so a comped plan is still visible, just not as
-- revenue.

create or replace function public.subscription_ops_overview()
returns jsonb
language plpgsql stable security definer set search_path = public
as $BODY$
declare
  v_result jsonb;
  v_month_start timestamptz := date_trunc('month', now() at time zone 'Asia/Ho_Chi_Minh') at time zone 'Asia/Ho_Chi_Minh';
begin
  if not ('admin' = any (public.current_web_roles())) then
    raise exception 'admin_required' using errcode = '42501';
  end if;

  with periods as (
    select
      s.plan_code,
      s.platform,
      s.purchased_at,
      s.status,
      s.revoked_at,
      s.current_period_end,
      p.price_amount_vnd,
      p.period_months,
      case
        when p.period_months is null then 1
        else greatest(1, round(
          extract(epoch from (coalesce(s.current_period_end, s.purchased_at) - s.purchased_at))
          / (p.period_months * 2629800.0)
        )::integer)
      end as periods_paid,
      (s.revoked_at is null
        and s.status = 'active'
        and (s.current_period_end is null or s.current_period_end > now())) as is_live,
      -- Money only counts when a store collected it. An admin grant is a
      -- decision, not a sale, and adding it to "tiền đã thu" would make the
      -- one number this panel exists for unverifiable against Apple's.
      (s.platform <> 'manual') as is_paid
    from public.user_subscriptions s
    left join public.subscription_plans p on p.code = s.plan_code
  )
  select jsonb_build_object(
    'generated_at', now(),
    'plans', coalesce((
      select jsonb_agg(jsonb_build_object(
        'code', pl.code,
        'name', pl.name_vi,
        'billing_type', pl.billing_type,
        'price_amount_vnd', pl.price_amount_vnd,
        'period_months', pl.period_months,
        'holders_live', coalesce(agg.live, 0),
        'holders_ever', coalesce(agg.ever, 0),
        'periods_paid', coalesce(agg.periods, 0),
        'gross_vnd', coalesce(agg.periods, 0) * coalesce(pl.price_amount_vnd, 0)
      ) order by pl.sort_order)
      from public.subscription_plans pl
      left join (
        select plan_code,
               count(*) filter (where is_live) as live,
               count(*) as ever,
               sum(periods_paid) filter (where is_paid) as periods
          from periods group by plan_code
      ) agg on agg.plan_code = pl.code
    ), '[]'::jsonb),
    'revenue', jsonb_build_object(
      'gross_vnd', coalesce((select sum(periods_paid * coalesce(price_amount_vnd, 0)) from periods where is_paid), 0),
      'net_vnd_estimate', round(coalesce((select sum(periods_paid * coalesce(price_amount_vnd, 0)) from periods where is_paid), 0) * 0.85),
      'new_this_month', (select count(*) from periods where is_paid and purchased_at >= v_month_start),
      'refunded', (select count(*) from periods where revoked_at is not null),
      'lapsed', (select count(*) from periods where revoked_at is null and not is_live),
      'granted', (select count(*) from periods where not is_paid)
    ),
    'infra', jsonb_build_object(
      'storage_bytes', coalesce((select sum((metadata->>'size')::bigint) from storage.objects), 0),
      'storage_limit_bytes', 1073741824,
      'clip_bytes_live', coalesce((
        select sum(video_bytes) from public.form_reviews where clip_deleted_at is null
      ), 0),
      'clips_pending', (select count(*) from public.form_reviews where status = 'pending'),
      'clips_pruned', (select count(*) from public.form_reviews where clip_deleted_at is not null),
      'call_minutes_this_month', coalesce((
        select sum(ceil(coalesce(duration_seconds, 0) / 60.0))
          from public.calls
         where duration_seconds is not null and created_at >= v_month_start
      ), 0),
      'participant_minutes_limit', 5000,
      'ai_messages_this_month', (
        select count(*) from public.chat_messages m
          join public.chat_threads t on t.id = m.thread_id
         where t.kind = 'ai' and m.sender_type = 'user' and m.created_at >= v_month_start
      )
    )
  ) into v_result;

  return v_result;
end;
$BODY$;
