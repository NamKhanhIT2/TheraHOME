-- One formula for "tuân thủ", in one place (owner 2026-10-01).
--
-- The old one lived inline in mark_day_watched and only ran when somebody
-- marked a day watched — so it froze the moment a customer stopped training.
-- Admin showed people on day 14 who had done 2 sessions at 100%, because the
-- last time it was computed they had done 2 of 2.
--
-- What it means now: of the days that were ACTUALLY AVAILABLE to this
-- customer, how many did they finish?
--   * a free phase's day is available once the calendar reaches it;
--   * a PAID phase's day is available only if they bought it, and then under
--     the purchase rule (first two days at once, the rest after the wait), so
--     not buying Giai đoạn 3 can never drag someone's score down;
--   * rest days are nobody's homework, so they are out of both sides;
--   * capped at 100 — a bought phase can open days the calendar has not
--     reached, and nobody should read 130%.
create or replace function public.adherence_pct_for(p_user_program_id uuid)
returns numeric
language sql
stable
security definer
set search_path = public
as $$
  with prog as (
    select up.id, up.user_id, up.product_id,
           (now()::date - up.activated_at::date) + 1 as days_unlocked,
           (select pr.total_days from products pr where pr.id = up.product_id) as total_days
    from user_programs up
    where up.id = p_user_program_id
  ),
  available as (
    select pd.id
    from program_days pd
    cross join prog
    where pd.product_id = prog.product_id
      and coalesce(pd.day_type, 'train') <> 'rest'
      and case
        when exists (
          select 1 from phase_promos pp
          where pp.phase_id = pd.phase_id
            and (pp.apple_product_id is not null or pp.google_product_id is not null)
        ) then exists (
          select 1 from phase_purchases bp
          where bp.user_id = prog.user_id
            and bp.phase_id = pd.phase_id
            and bp.revoked_at is null
            and (now() >= bp.purchased_at + interval '49 hours'
                 or pd.day_number <= (select min(x.day_number) from program_days x where x.phase_id = pd.phase_id) + 1)
        )
        else pd.day_number <= least(prog.days_unlocked, coalesce(prog.total_days, prog.days_unlocked))
      end
  )
  select case
    when (select count(*) from available) = 0 then 0
    else least(
      round(
        (select count(*)
           from user_program_days upd
          where upd.user_program_id = p_user_program_id
            and upd.status = 'done'
            and upd.program_day_id in (select id from available))::numeric
        / (select count(*) from available) * 100
      ), 100)
  end;
$$;

comment on function public.adherence_pct_for(uuid) is
  'Adherence = finished days / days that were available to that customer. The single definition: mark_day_watched calls it on every write, and recompute-adherence-daily calls it for everyone so it cannot go stale.';
