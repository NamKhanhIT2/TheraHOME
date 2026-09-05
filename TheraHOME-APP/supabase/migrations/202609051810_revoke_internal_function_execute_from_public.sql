-- Follow-up to 202609051800: Postgres grants EXECUTE to PUBLIC by default,
-- so revoking from anon/authenticated alone left the functions reachable.
-- Revoke from PUBLIC, then grant back only where a real caller needs it.

-- Trigger function and server-side helper: no REST caller at all.
revoke execute on function public.notify_roadmap_published() from public, anon, authenticated;
revoke execute on function public.profile_language(uuid) from public, anon, authenticated;

-- Staff-only, and each already refuses callers without an admin/cskh role in
-- its own body. WEB calls them as a signed-in user, never anonymously.
revoke execute on function public.roadmap_readiness(text) from public, anon;
grant execute on function public.roadmap_readiness(text) to authenticated;

revoke execute on function public.set_official_post_pinned(uuid, boolean, text, text, text, text[], text, text, text, text, text, text) from public, anon;
grant execute on function public.set_official_post_pinned(uuid, boolean, text, text, text, text[], text, text, text, text, text, text) to authenticated;

revoke execute on function public.create_official_community_post(text, text, boolean, text[], text, text, text, text) from public, anon;
grant execute on function public.create_official_community_post(text, text, boolean, text[], text, text, text, text) to authenticated;
