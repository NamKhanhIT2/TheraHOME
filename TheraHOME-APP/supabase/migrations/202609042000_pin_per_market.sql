-- Per-market pinning (per explicit request 2026-09-04). Pinning used to be
-- ONE global slot: pinning any official post unpinned every other one, so a
-- UK-targeted pin knocked the Vietnamese pin off the VN feed (and vice
-- versa). Now a new pin only displaces pins whose audience OVERLAPS it, so
-- each market can hold its own pinned post:
--   - target_markets NULL = "everywhere", so it displaces (and is displaced
--     by) every other pin.
--   - two disjoint market lists (e.g. {VN} and {US}) coexist.
-- The mobile side needs no change: its feed query already filters by market
-- before picking `posts.find(p => p.pinned)`.
create or replace function public.set_official_post_pinned(
  p_post_id uuid,
  p_pinned boolean,
  p_title text default null::text,
  p_content text default null::text,
  p_thumbnail_url text default null::text
)
 returns void
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare
  v_markets text[];
begin
  if not (
    'admin' = any(public.current_web_roles())
    or 'cskh' = any(public.current_web_roles())
  ) then
    raise exception 'staff_required';
  end if;

  if p_pinned then
    select target_markets into v_markets
    from public.community_posts
    where id = p_post_id and is_official = true;

    update public.community_posts other
    set pinned = false
    where other.is_official = true
      and other.pinned = true
      and other.id <> p_post_id
      and (
        v_markets is null
        or other.target_markets is null
        or other.target_markets && v_markets
      );
  end if;

  update public.community_posts
  set pinned = p_pinned,
      pinned_title = case when p_pinned then p_title else pinned_title end,
      pinned_content = case when p_pinned then p_content else pinned_content end,
      pinned_thumbnail_url = case when p_pinned then p_thumbnail_url else pinned_thumbnail_url end
  where id = p_post_id and is_official = true;

  if not found then
    raise exception 'official_post_not_found';
  end if;
end;
$function$;
