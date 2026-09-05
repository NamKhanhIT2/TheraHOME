-- Pins have been per-market since 2026-09-04, but the CARD COPY was a single
-- set of columns, so a post pinned for VN+UK showed the Vietnamese card to
-- UK users too — and staff had no way to see or choose which markets a pin
-- applies to (owner report 2026-09-05: "chọn ghim nhưng ko có cụ thể ghim ở
-- quốc gia nào"). Two additions:
--   1. pinned_markets: which markets the pin is live in. null = every market
--      the post targets (the old behaviour), so existing pins are unchanged.
--   2. Per-market card copy, same VN-base + variant shape the post content
--      already uses.
alter table public.community_posts
  add column if not exists pinned_markets text[],
  add column if not exists pinned_title_us text,
  add column if not exists pinned_content_us text,
  add column if not exists pinned_thumbnail_url_us text,
  add column if not exists pinned_title_malay text,
  add column if not exists pinned_content_malay text,
  add column if not exists pinned_thumbnail_url_malay text;

create or replace function public.set_official_post_pinned(
  p_post_id uuid,
  p_pinned boolean,
  p_title text default null,
  p_content text default null,
  p_thumbnail_url text default null,
  p_markets text[] default null,
  p_title_us text default null,
  p_content_us text default null,
  p_thumbnail_url_us text default null,
  p_title_malay text default null,
  p_content_malay text default null,
  p_thumbnail_url_malay text default null
)
returns void
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_target_markets text[];
  v_pin_markets text[];
begin
  if not (
    'admin' = any(public.current_web_roles())
    or 'cskh' = any(public.current_web_roles())
  ) then
    raise exception 'staff_required';
  end if;

  if p_pinned then
    select target_markets into v_target_markets
    from public.community_posts
    where id = p_post_id and is_official = true;

    -- Which markets this pin occupies. Callers may pin into a SUBSET of the
    -- post's markets; null keeps the old "everywhere the post is visible".
    v_pin_markets := coalesce(p_markets, v_target_markets);
    if v_pin_markets is not null and cardinality(v_pin_markets) = 0 then
      v_pin_markets := null;
    end if;
    -- A pin can never reach a market the post itself does not target.
    if v_target_markets is not null and v_pin_markets is not null then
      select array_agg(m) into v_pin_markets
      from unnest(v_pin_markets) m
      where m = any(v_target_markets);
      if v_pin_markets is null then
        raise exception 'pin_market_not_targeted';
      end if;
    end if;

    -- Only unpin posts whose OWN pin markets overlap this one, so pinning
    -- for UK leaves the VN pin alone.
    update public.community_posts other
    set pinned = false
    where other.is_official = true
      and other.pinned = true
      and other.id <> p_post_id
      and (
        v_pin_markets is null
        or coalesce(other.pinned_markets, other.target_markets) is null
        or coalesce(other.pinned_markets, other.target_markets) && v_pin_markets
      );
  end if;

  update public.community_posts
  set pinned = p_pinned,
      pinned_markets = case when p_pinned then v_pin_markets else pinned_markets end,
      pinned_title = case when p_pinned then p_title else pinned_title end,
      pinned_content = case when p_pinned then p_content else pinned_content end,
      pinned_thumbnail_url = case when p_pinned then p_thumbnail_url else pinned_thumbnail_url end,
      pinned_title_us = case when p_pinned then p_title_us else pinned_title_us end,
      pinned_content_us = case when p_pinned then p_content_us else pinned_content_us end,
      pinned_thumbnail_url_us = case when p_pinned then p_thumbnail_url_us else pinned_thumbnail_url_us end,
      pinned_title_malay = case when p_pinned then p_title_malay else pinned_title_malay end,
      pinned_content_malay = case when p_pinned then p_content_malay else pinned_content_malay end,
      pinned_thumbnail_url_malay = case when p_pinned then p_thumbnail_url_malay else pinned_thumbnail_url_malay end
  where id = p_post_id and is_official = true;

  if not found then
    raise exception 'official_post_not_found';
  end if;
end;
$function$;
