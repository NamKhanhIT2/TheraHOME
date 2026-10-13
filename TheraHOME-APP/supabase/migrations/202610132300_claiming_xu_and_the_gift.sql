-- The claim is a button, not an automatic credit (owner's design): finishing
-- a day makes 10 xu AVAILABLE, and the customer taps to take it. That is why
-- these are functions rather than a line inside complete_day.
--
-- NOTE: claim_streak_coins and coin_overview are replaced in
-- 202610132500 — they originally read user_programs.streak, which turned out
-- not to count what it looks like it counts. The versions here are kept so
-- the history replays; the later file is the one that matters.

create or replace function public.claim_day_coins(p_user_program_id uuid, p_program_day_id uuid)
returns integer
language plpgsql security definer set search_path = public
as $fn$
declare
  v_user uuid := (select auth.uid());
  v_amount integer;
begin
  if v_user is null then raise exception 'not_authenticated' using errcode = '42501'; end if;
  if not public.coin_programme_eligible() then
    raise exception 'plan_required' using errcode = '22023';
  end if;
  if not exists (select 1 from public.user_programs where id = p_user_program_id and user_id = v_user) then
    raise exception 'not_your_program' using errcode = '42501';
  end if;
  -- Finished, as the server recorded it. The client is never asked whether
  -- the day was done; complete_day is what decides that, and it checks the
  -- calendar before it unlocks anything.
  if not exists (
    select 1 from public.user_program_days
     where user_program_id = p_user_program_id and program_day_id = p_program_day_id and status = 'done'
  ) then
    raise exception 'day_not_done' using errcode = '22023';
  end if;

  select coins_per_day into v_amount from public.coin_settings where id;

  insert into public.coin_entries (user_id, amount, kind, user_program_id, program_day_id)
  values (v_user, v_amount, 'day', p_user_program_id, p_program_day_id)
  on conflict do nothing;

  if not found then
    raise exception 'already_claimed' using errcode = '22023';
  end if;
  return public.coin_balance();
end;
$fn$;

/** One gift, once, for ever — the primary key on coin_gift_claims is what
 * says so, not a count done in the app. */
create or replace function public.claim_coin_gift()
returns jsonb
language plpgsql security definer set search_path = public
as $fn$
declare
  v_user uuid := (select auth.uid());
  v_balance integer;
  v_threshold integer;
begin
  if v_user is null then raise exception 'not_authenticated' using errcode = '42501'; end if;
  if not public.coin_programme_eligible() then
    raise exception 'plan_required' using errcode = '22023';
  end if;
  select gift_threshold into v_threshold from public.coin_settings where id;
  v_balance := public.coin_balance();
  if v_balance < v_threshold then
    raise exception 'not_enough_coins' using errcode = '22023';
  end if;
  if exists (select 1 from public.coin_gift_claims where user_id = v_user) then
    raise exception 'gift_already_claimed' using errcode = '22023';
  end if;

  insert into public.coin_gift_claims (user_id, balance_at_claim) values (v_user, v_balance);

  -- The xu are NOT spent. They are a record of what was earned, and the gift
  -- is once in a lifetime anyway, so deducting would only make the history
  -- lie about the training that produced it.
  return jsonb_build_object('ok', true, 'balance', v_balance);
end;
$fn$;

revoke execute on function
  public.claim_day_coins(uuid, uuid),
  public.claim_coin_gift()
from public, anon;
grant execute on function
  public.claim_day_coins(uuid, uuid),
  public.claim_coin_gift()
to authenticated;
