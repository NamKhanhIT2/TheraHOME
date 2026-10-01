-- 1. mark_day_watched stops carrying its own copy of the formula.
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
    '     set adherence_pct = least(round(v_done::numeric / greatest(v_unlocked, 1) * 100), 100),',
    '     set adherence_pct = public.adherence_pct_for(p_user_program_id),'
  );
  if patched = src then
    raise exception 'adherence anchor not found in mark_day_watched — inspect by hand';
  end if;

  execute patched;
end
$outer$;

-- 2. Everyone gets the honest number now, not just whoever trains next.
update user_programs set adherence_pct = public.adherence_pct_for(id);

-- 3. And every morning after, so it can never freeze again — the denominator
-- grows with the calendar whether or not the customer opens the app, which is
-- exactly why the old write-time-only number lied. 03:00 UTC = 10:00 Hanoi,
-- ahead of the two refund sweeps at 03:20 and 03:40.
select cron.schedule(
  'recompute-adherence-daily',
  '0 3 * * *',
  $job$update user_programs set adherence_pct = public.adherence_pct_for(id);$job$
);
