-- Hardening (2026-09-05): every function below is either a trigger function
-- or a server-side helper. None is called over REST by the app or WEB (only
-- the generated types even mention profile_language), so exposing them on
-- /rest/v1/rpc is pure attack surface. Internal callers are unaffected:
-- trigger functions run from their trigger, and SECURITY DEFINER callers run
-- as the definer, not as the REST role.
revoke execute on function public.notify_roadmap_published() from anon, authenticated;
revoke execute on function public.provision_new_product_for_claimed_users() from anon, authenticated;
revoke execute on function public.provision_new_program_day_for_claimed_users() from anon, authenticated;
revoke execute on function public.auto_claim_product_activation_contact() from anon, authenticated;
revoke execute on function public.profile_language(uuid) from anon, authenticated;

-- These two already refuse callers without an admin/cskh role in their own
-- body; staff reach them as `authenticated`, never as `anon`.
revoke execute on function public.set_official_post_pinned(uuid, boolean, text, text, text, text[], text, text, text, text, text, text) from anon;
revoke execute on function public.roadmap_readiness(text) from anon;
revoke execute on function public.create_official_community_post(text, text, boolean, text[], text, text, text, text) from anon;
