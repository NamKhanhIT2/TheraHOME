-- Four functions the 2026-10-13 sweep left behind.
--
-- That migration closed anon access to the per-user functions and explained
-- the rule: Postgres grants EXECUTE to PUBLIC by default, the anon key ships
-- inside the app bundle and is public by design, so every SECURITY DEFINER
-- function in the exposed schema is reachable by anybody until it is
-- revoked. The database linter still names these four.
--
-- None of them is leaking today, and it is worth being precise about why
-- rather than alarming anyone:
--
--   adherence_pct_for(uuid)      No ownership check, but it takes a
--   available_day_ids_for(uuid)  `user_programs.id` — a v4 uuid, not
--                                enumerable — and returns a percentage and
--                                a list of day ids that is the same for
--                                everyone on that product. Low value to an
--                                attacker, and unreachable without a uuid
--                                that is never published. Revoked anyway:
--                                "they would need a secret first" is a
--                                weaker guarantee than "they cannot call
--                                it", and this costs nothing to hold.
--
--   admin_adherence_parts()      Already refuses anyone without the admin
--                                or cskh web role. The guard is right; the
--                                grant was simply wider than the guard.
--
--   orders_enqueue_activation_contacts()
--                                A trigger function. Called over the REST
--                                API it fails on an undefined `new` rather
--                                than doing anything — but a trigger body
--                                has no business being an API endpoint.
--
-- Neither client calls the first two: they are used from inside other SQL
-- functions, which run as the owner and are unaffected by these grants.
-- `admin_adherence_parts` keeps `authenticated` because WEB Admin's
-- adherence table calls it (src/lib/db.ts) as a signed-in admin.
revoke execute on function public.adherence_pct_for(uuid) from public, anon, authenticated;
revoke execute on function public.available_day_ids_for(uuid) from public, anon, authenticated;
revoke execute on function public.orders_enqueue_activation_contacts() from public, anon, authenticated;

revoke execute on function public.admin_adherence_parts() from public, anon;
grant execute on function public.admin_adherence_parts() to authenticated;
