-- Two things: calls become a paid feature in fact as well as on the card,
-- and Admin gets the numbers needed to decide whether any of this is worth
-- running.

-- ---------------------------------------------------------------------------
-- 1. start_call checks the caller's tier
-- ---------------------------------------------------------------------------
--
-- Until now the paywall said calls were paid and nothing enforced it. The
-- check is only on the CALLER, and only when the caller is not staff: CSKH
-- ringing a customer is CSKH's decision, and a customer with no plan must
-- still be able to ANSWER one.
--
-- Everything else in this function is unchanged — see 202610111000 and
-- 202610111600 for the busy-line handling and the video/audio split.
create or replace function public.start_call(
  p_thread_id uuid default null,
  p_callee_id uuid default null,
  p_media text default 'audio'
)
returns public.calls
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_is_staff boolean := 'admin' = any (public.current_web_roles()) or 'cskh' = any (public.current_web_roles());
  v_holds_line boolean;
  v_thread_owner uuid;
  v_allowance integer;
  v_id uuid := gen_random_uuid();
  v_call public.calls;
begin
  if v_user is null then
    raise exception 'auth_required' using errcode = '28000';
  end if;
  if p_media not in ('audio', 'video') then
    raise exception 'bad_media' using errcode = '22023';
  end if;

  if p_callee_id is not null then
    if not v_is_staff then
      raise exception 'staff_required' using errcode = '42501';
    end if;
    select user_id into v_thread_owner from chat_threads where id = p_thread_id;
    if v_thread_owner is null or v_thread_owner <> p_callee_id then
      raise exception 'callee_not_in_thread' using errcode = '42501';
    end if;
  end if;

  -- The tier check. NULL allowance means unlimited, which every paid tier
  -- currently is; 0 means no subscription. The minutes branch is dead today
  -- and deliberately kept: the number is editable in WEB Admin, so a finite
  -- value can appear without anyone touching this function.
  if not v_is_staff then
    v_allowance := public.call_minutes_allowance();
    if v_allowance = 0 then
      raise exception 'plan_required' using errcode = '22023';
    end if;
    if v_allowance is not null and public.call_minutes_used_this_month() >= v_allowance then
      raise exception 'call_minutes_exhausted' using errcode = '22023';
    end if;
  end if;

  select account_type <> 'review' into v_holds_line from profiles where id = v_user;
  v_holds_line := coalesce(v_holds_line, true);

  perform public.expire_stale_calls();

  begin
    insert into calls (id, room_name, caller_id, callee_id, thread_id, holds_line, media)
    values (v_id, 'call_' || replace(v_id::text, '-', ''), v_user, p_callee_id, p_thread_id, v_holds_line, p_media)
    returning * into v_call;
  exception when unique_violation then
    insert into calls (room_name, caller_id, callee_id, thread_id, status, holds_line, media, end_reason, ended_at)
    values ('call_' || replace(gen_random_uuid()::text, '-', ''), v_user, p_callee_id, p_thread_id,
            'busy', false, p_media, 'busy', now())
    returning * into v_call;
    perform public.log_call_to_thread(v_call);
  end;

  return v_call;
end;
$$;

-- ---------------------------------------------------------------------------
-- 2. What a plan costs, as a number
-- ---------------------------------------------------------------------------
--
-- `price_label_vi` is copy ("199.000đ") and cannot be summed. These two can,
-- and they are what makes the Admin panel able to say how much has been
-- taken and over how many billing periods.
alter table public.subscription_plans
  add column if not exists price_amount_vnd integer,
  add column if not exists period_months integer;

comment on column public.subscription_plans.price_amount_vnd is
  'List price in VND, for reporting only — never shown to a customer and '
  'never charged. The store charges price_label/its own tier. Keep it in '
  'step with the label or the revenue panel lies.';
comment on column public.subscription_plans.period_months is
  'Months one payment covers, so renewals can be counted from '
  'purchased_at -> current_period_end. NULL for a one-off (lifetime).';

update public.subscription_plans set price_amount_vnd = 99000,   period_months = 1    where code = 'premium';
update public.subscription_plans set price_amount_vnd = 199000,  period_months = 3    where code = 'premium_plus';
update public.subscription_plans set price_amount_vnd = 1990000, period_months = null where code = 'premium_lifetime';

/**
 * Everything Admin needs to decide whether the subscriptions are working and
 * whether the infrastructure behind them needs paying for.
 *
 * Deliberately ONE function returning one document. The alternative was half
 * a dozen admin-only views, and the web would then make half a dozen round
 * trips to render one panel that is always read as a whole.
 *
 * On the money: this counts BILLING PERIODS against the list price in
 * `price_amount_vnd`. It is a reconciliation aid, not an accounting record —
 * the authoritative figures are the payout reports in App Store Connect and
 * Play Console, which are net of the store's 15–30%, of tax, and of currency
 * conversion for anyone who paid outside Vietnam. The panel says so on
 * screen; the point of this number is to compare against those reports and
 * notice when they disagree.
 *
 * Renewals are inferred from purchased_at -> current_period_end rather than
 * counted, because a renewal updates the subscription row in place (see
 * verify-subscription) and never leaves a record of its own. That is exact
 * for a subscription nobody has refunded or let lapse mid-period, and it is
 * the reason the number is called an estimate.
 */
create or replace function public.subscription_ops_overview()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_result jsonb;
  v_month_start timestamptz := date_trunc('month', now() at time zone 'Asia/Ho_Chi_Minh') at time zone 'Asia/Ho_Chi_Minh';
begin
  -- Admin only. The tab this feeds lives in the Admin nav, and prices are
  -- already admin-only to write; revenue is not customer-care data.
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
        and (s.current_period_end is null or s.current_period_end > now())) as is_live
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
               sum(periods_paid) as periods
          from periods group by plan_code
      ) agg on agg.plan_code = pl.code
    ), '[]'::jsonb),
    'revenue', jsonb_build_object(
      'gross_vnd', coalesce((select sum(periods_paid * coalesce(price_amount_vnd, 0)) from periods), 0),
      -- A flat 15% store cut: the Small Business Program rate on Apple and
      -- Play's first-million rate. Not exact (tax, currency, the 30% tier),
      -- which is why the panel labels it an estimate.
      'net_vnd_estimate', round(coalesce((select sum(periods_paid * coalesce(price_amount_vnd, 0)) from periods), 0) * 0.85),
      'new_this_month', (select count(*) from periods where purchased_at >= v_month_start),
      'refunded', (select count(*) from periods where revoked_at is not null),
      'lapsed', (select count(*) from periods where revoked_at is null and not is_live)
    ),
    'infra', jsonb_build_object(
      -- Supabase free plan: 1 GB of file storage, a HARD cap that disrupts
      -- the service rather than billing an overage.
      'storage_bytes', coalesce((select sum((metadata->>'size')::bigint) from storage.objects), 0),
      'storage_limit_bytes', 1073741824,
      'clip_bytes_live', coalesce((
        select sum(video_bytes) from public.form_reviews where clip_deleted_at is null
      ), 0),
      'clips_pending', (select count(*) from public.form_reviews where status = 'pending'),
      'clips_pruned', (select count(*) from public.form_reviews where clip_deleted_at is not null),
      -- LiveKit bills per PARTICIPANT minute and a 1-1 call has two, so the
      -- quota is spent twice as fast as the call clock suggests. Free tier is
      -- 5,000 a month.
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
$$;

revoke all on function public.subscription_ops_overview() from public, anon;
grant execute on function public.subscription_ops_overview() to authenticated;
