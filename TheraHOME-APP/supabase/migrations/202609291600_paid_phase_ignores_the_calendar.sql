-- A paid phase answers only to the purchase rule (owner 2026-09-29).
--
-- Before this, `mark_day_watched` let any day through when
-- `day_number <= elapsed + 2`. For a customer who had lapsed well past day 14
-- and then bought Giai đoạn 3, the calendar already counted days 17+ as due —
-- so the whole phase opened the moment they paid and the 49-hour wait never
-- bit, for exactly the people most likely to buy, binge and ask for a refund.
-- Measured the day this was written: 18 of 86 programs were past day 15 and 5
-- were past day 28.
--
-- It also closes a quieter hole: the RPC used to trust the app to hide a paid
-- phase from someone who never bought it. Now the server refuses it.
--
-- Rewritten as a textual patch of the live definition rather than a full
-- re-declaration, so the ~90 lines this change does not care about (streak,
-- adherence, milestone notifications) cannot drift by transcription. It fails
-- loudly if either anchor is missing.
do $outer$
declare
  src text;
  patched text;
begin
  select pg_get_functiondef(p.oid) into src
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'mark_day_watched';

  patched := replace(
    src,
    '  v_copy record;',
    '  v_copy record;' || chr(10) || '  v_phase_is_paid boolean;'
  );
  if patched = src then
    raise exception 'declaration anchor (v_copy) not found — inspect mark_day_watched by hand';
  end if;

  src := patched;
  patched := replace(
    src,
'  if v_day.day_number > v_elapsed + 2
     and not coalesce(v_is_review, false)
     and not v_bought_open then
    raise exception ''day_not_unlocked'';
  end if;',
'  -- Paid phase: the purchase rule is the ONLY rule. The calendar must not
  -- hand over days the buyer has not waited for, and must not hand over a
  -- paid phase at all to someone who never bought it.
  select exists (
    select 1 from phase_promos pr
    where pr.phase_id = v_day.phase_id
      and (pr.apple_product_id is not null or pr.google_product_id is not null)
  ) into v_phase_is_paid;

  if coalesce(v_phase_is_paid, false) then
    if not coalesce(v_is_review, false) and not v_bought_open then
      raise exception ''day_not_unlocked'';
    end if;
  elsif v_day.day_number > v_elapsed + 2 and not coalesce(v_is_review, false) then
    raise exception ''day_not_unlocked'';
  end if;'
  );
  if patched = src then
    raise exception 'unlock-gate anchor not found — inspect mark_day_watched by hand';
  end if;

  execute patched;
end
$outer$;
