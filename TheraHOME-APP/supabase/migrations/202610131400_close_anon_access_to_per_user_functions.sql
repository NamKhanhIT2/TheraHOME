-- A real hole, found by the database linter and confirmed by calling it:
-- `weekly_progress_for(uuid)` took a user id, had NO caller check, and
-- Postgres grants EXECUTE to PUBLIC by default. So anyone holding the anon
-- key — which ships inside the app bundle and is public by design — could
-- read any customer's streak, adherence, days done and PAIN AVERAGES by
-- passing their uuid.
--
-- `plan_code_for` was written with a self-or-staff guard and correctly
-- returned null to anon; this one was not, and the asymmetry is the bug.
--
-- Fixed with grants rather than a guard, because the only caller is
-- dispatch-weekly-reports under the service role, which has its own EXECUTE.
-- Nothing in the app calls it. One mechanism, and no branch that has to stay
-- correct for the data to stay private.
revoke execute on function public.weekly_progress_for(uuid) from public, anon, authenticated;

-- The rest read only auth.uid(), so an anonymous caller already got the
-- baseline back rather than somebody else's data — no leak, but no reason to
-- be callable either. `authenticated` keeps them: the app calls them.
revoke execute on function public.active_plan_code() from public, anon;
revoke execute on function public.plan_code_for(uuid) from public, anon;
revoke execute on function public.ai_chat_daily_allowance() from public, anon;
revoke execute on function public.ai_chat_used_today() from public, anon;
revoke execute on function public.call_minutes_allowance() from public, anon;
revoke execute on function public.call_minutes_used_this_month() from public, anon;
revoke execute on function public.form_review_mb_allowance() from public, anon;
revoke execute on function public.form_review_mb_used_this_month() from public, anon;
revoke execute on function public.suggested_reminder_hour() from public, anon;
revoke execute on function public.subscription_ops_overview() from public, anon;

-- Linter: a function without a pinned search_path can be made to resolve its
-- names against a schema the caller controls. Harmless for one that selects
-- three constants, free to fix, and the rule holds for whoever edits it next.
create or replace function public.baseline_limits()
returns table (ai_chat_per_day integer, call_minutes_per_month integer, form_review_mb_per_month integer)
language sql immutable
set search_path = public
as $$ select 2, 0, 0 $$;

revoke execute on function public.baseline_limits() from public, anon;

-- Same finding, and this one is also dead: the "one pending review at a
-- time" rule went away on 2026-10-12 when the clip budget became bytes, so
-- nothing calls it. Pinned rather than dropped in case an older binary still
-- reaches for it.
create or replace function public.form_review_max_pending()
returns integer
language sql immutable
set search_path = public
as $$ select 1 $$;

comment on function public.form_review_max_pending() is
  'UNUSED since 2026-10-12: request_form_review stopped capping pending '
  'reviews when the monthly limit became a byte budget. Kept only for '
  'binaries shipped before that.';
