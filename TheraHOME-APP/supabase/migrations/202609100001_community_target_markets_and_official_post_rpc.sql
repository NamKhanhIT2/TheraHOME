-- Community per-market targeting + localized official-post content.
--
-- These columns and the 8-arg `create_official_community_post` RPC were
-- applied directly to the remote project during the market/language work and
-- never had a committed migration (the pinned-card per-market columns landed
-- in 202609051300, and the grant/revoke for this RPC signature in
-- 202609051800/1810, but the columns + function body themselves were missing).
-- This migration reconstructs them faithfully. It is idempotent: `add column
-- if not exists` and `create or replace function` are no-ops on the remote
-- where they already exist, and create them on a fresh database.

alter table public.community_posts
  add column if not exists target_markets text[],
  add column if not exists title_us text,
  add column if not exists text_us text,
  add column if not exists title_malay text,
  add column if not exists text_malay text;

-- Staff-only creator for an official post, with optional per-market
-- (UK = US, ML = MALAY) title/text. Base VN title/text are always required;
-- a targeted UK/ML market also requires its own content.
create or replace function public.create_official_community_post(
  p_title text,
  p_text text,
  p_notify boolean default false,
  p_target_markets text[] default null,
  p_title_us text default null,
  p_text_us text default null,
  p_title_malay text default null,
  p_text_malay text default null
)
returns uuid
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_post_id uuid;
begin
  if not (
    'admin' = any(public.current_web_roles())
    or 'cskh' = any(public.current_web_roles())
  ) then
    raise exception 'staff_required';
  end if;

  if nullif(btrim(p_title), '') is null or nullif(btrim(p_text), '') is null then
    raise exception 'title_and_content_required';
  end if;

  if 'US' = any(p_target_markets) and (nullif(btrim(p_title_us), '') is null or nullif(btrim(p_text_us), '') is null) then
    raise exception 'us_content_required';
  end if;

  if 'MALAY' = any(p_target_markets) and (nullif(btrim(p_title_malay), '') is null or nullif(btrim(p_text_malay), '') is null) then
    raise exception 'malay_content_required';
  end if;

  insert into public.community_posts (
    is_official, author_name, title, text, notify_enabled,
    target_markets, title_us, text_us, title_malay, text_malay
  )
  values (
    true, 'TheraHOME', btrim(p_title), btrim(p_text), coalesce(p_notify, false),
    p_target_markets,
    nullif(btrim(p_title_us), ''), nullif(btrim(p_text_us), ''),
    nullif(btrim(p_title_malay), ''), nullif(btrim(p_text_malay), '')
  )
  returning id into v_post_id;
  return v_post_id;
end;
$function$;

revoke execute on function public.create_official_community_post(text, text, boolean, text[], text, text, text, text) from public, anon;
grant execute on function public.create_official_community_post(text, text, boolean, text[], text, text, text, text) to authenticated;
