-- Postgres grants EXECUTE to PUBLIC on every new function, so the four
-- trigger functions added in 202610131500/1800 appear in Supabase's security
-- advisor as SECURITY DEFINER functions callable by `anon` through
-- /rest/v1/rpc/.
--
-- They are not actually reachable: Postgres refuses a trigger function called
-- any other way —
--   ERROR 0A000: trigger functions can only be called as triggers
-- — which I confirmed by calling one as `authenticated`. So this closes a
-- finding rather than a hole.
--
-- Revoked anyway, for the same reason the grant on weekly_progress_for was
-- wrong in 202610131400: "it happens to be unreachable" is a worse defence
-- than "it is not granted", and the next person reading the advisor should
-- not have to re-derive that argument.

revoke execute on function public.staff_alert_on_chat_message() from public, anon, authenticated;
revoke execute on function public.staff_alert_on_form_review() from public, anon, authenticated;
revoke execute on function public.staff_alert_on_subscription() from public, anon, authenticated;
revoke execute on function public.push_staff_alert_to_phones() from public, anon, authenticated;
