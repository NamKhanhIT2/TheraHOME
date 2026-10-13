-- The milestone bonus keyed on user_programs.streak, and that column cannot
-- carry it. complete_day only ever does `streak = streak + 1`, so it never
-- resets — but other paths mark days done without going through complete_day,
-- and the result is already visible in production: the owner's own programme
-- has 7 days finished and streak = 1.
--
-- So a customer could finish fourteen days and never reach a milestone.
--
-- Counting user_program_days.status = 'done' instead is both correct and the
-- number the customer can see for themselves on the roadmap, which matters
-- for a reward: nobody argues with a count they can check.
--
-- This also settles what "chuỗi" means here. A true consecutive-calendar-day
-- streak is computable from completed_at, and was deliberately not chosen:
-- with 77% of programmes stopping inside three days, an all-or-nothing rule
-- that resets on one missed day would hand the bonus to almost nobody and
-- give everybody else a reason to stop trying. The app copy therefore says
-- "hoàn thành N ngày", not "N ngày liên tiếp".

create or replace function public.coin_days_done(p_user_program_id uuid)
returns integer
language sql stable security definer set search_path = public
as $$
  select count(*)::integer
    from public.user_program_days
   where user_program_id = p_user_program_id and status = 'done';
$$;

revoke execute on function public.coin_days_done(uuid) from public, anon;
grant execute on function public.coin_days_done(uuid) to authenticated;

create or replace function public.claim_streak_coins(p_user_program_id uuid, p_milestone integer)
returns integer
language plpgsql security definer set search_path = public
as $fn$
declare
  v_user uuid := (select auth.uid());
  v_amount integer;
  v_done integer;
begin
  if v_user is null then raise exception 'not_authenticated' using errcode = '42501'; end if;
  if not public.coin_programme_eligible() then
    raise exception 'plan_required' using errcode = '22023';
  end if;
  if not exists (select 1 from public.coin_settings where id and p_milestone = any (streak_milestones)) then
    raise exception 'unknown_milestone' using errcode = '22023';
  end if;
  if not exists (select 1 from public.user_programs where id = p_user_program_id and user_id = v_user) then
    raise exception 'not_your_program' using errcode = '42501';
  end if;
  v_done := public.coin_days_done(p_user_program_id);
  if v_done < p_milestone then raise exception 'milestone_not_reached' using errcode = '22023'; end if;

  select coins_per_streak into v_amount from public.coin_settings where id;

  insert into public.coin_entries (user_id, amount, kind, user_program_id, streak_milestone)
  values (v_user, v_amount, 'streak', p_user_program_id, p_milestone)
  on conflict do nothing;

  if not found then
    raise exception 'already_claimed' using errcode = '22023';
  end if;
  return public.coin_balance();
end;
$fn$;

/** Everything the xu screen and the day screen need, in one round trip. */
create or replace function public.coin_overview(p_user_program_id uuid default null)
returns jsonb
language plpgsql stable security definer set search_path = public
as $fn$
declare
  v_user uuid := (select auth.uid());
  v_settings public.coin_settings;
  v_balance integer;
  v_program public.user_programs;
  v_done integer := 0;
begin
  if v_user is null then raise exception 'not_authenticated' using errcode = '42501'; end if;
  select * into v_settings from public.coin_settings where id;
  v_balance := public.coin_balance();
  if p_user_program_id is not null then
    select * into v_program from public.user_programs where id = p_user_program_id and user_id = v_user;
    v_done := public.coin_days_done(v_program.id);
  end if;

  return jsonb_build_object(
    'active', v_settings.active,
    'eligible', public.coin_programme_eligible(),
    'balance', v_balance,
    'coinsPerDay', v_settings.coins_per_day,
    'coinsPerStreak', v_settings.coins_per_streak,
    'giftThreshold', v_settings.gift_threshold,
    'streakMilestones', to_jsonb(v_settings.streak_milestones),
    'daysDone', v_done,
    -- Days finished that still have xu waiting on them.
    'claimableDays', coalesce((
      select jsonb_agg(jsonb_build_object('programDayId', pd.id, 'dayNumber', pd.day_number) order by pd.day_number)
        from public.user_program_days upd
        join public.program_days pd on pd.id = upd.program_day_id
       where upd.user_program_id = v_program.id
         and upd.status = 'done'
         and not exists (
           select 1 from public.coin_entries c
            where c.user_id = v_user and c.kind = 'day' and c.program_day_id = pd.id
         )
    ), '[]'::jsonb),
    -- Milestones reached that still have xu waiting on them.
    'claimableStreaks', coalesce((
      select jsonb_agg(m order by m)
        from unnest(v_settings.streak_milestones) m
       where v_done >= m
         and not exists (
           select 1 from public.coin_entries c
            where c.user_id = v_user and c.kind = 'streak'
              and c.user_program_id = v_program.id and c.streak_milestone = m
         )
    ), '[]'::jsonb),
    'gift', jsonb_build_object(
      'threshold', v_settings.gift_threshold,
      'reached', v_balance >= v_settings.gift_threshold,
      'claimedAt', (select claimed_at from public.coin_gift_claims where user_id = v_user),
      'fulfilledAt', (select fulfilled_at from public.coin_gift_claims where user_id = v_user)
    )
  );
end;
$fn$;

revoke execute on function
  public.claim_streak_coins(uuid, integer),
  public.coin_overview(uuid)
from public, anon;
grant execute on function
  public.claim_streak_coins(uuid, integer),
  public.coin_overview(uuid)
to authenticated;
