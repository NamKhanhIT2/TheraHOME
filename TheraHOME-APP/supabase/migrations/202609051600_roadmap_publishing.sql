-- Roadmap publishing (owner decision 2026-09-05): only TheraNECK+ has real
-- exercise videos; the other three products carried CLONES of its 28 URLs.
-- The mobile device dropdown used to be driven by the Store's "nhóm chính"
-- flag, so Admin had no way to keep a roadmap out of the app. Now:
--   * products.roadmap_published — the one switch the app reads. Default
--     FALSE so a freshly created roadmap is a draft until Admin publishes.
--   * roadmap_readiness() — staff-only readout: per market, how many days
--     have a video and which days reuse an earlier day's video.
--   * publish trigger — flipping false→true writes a localized inbox row
--     for every customer who already activated that product.
-- (Mirror of the applied migration `roadmap_publishing`.)

alter table public.products
  add column if not exists roadmap_published boolean not null default false;
update public.products set roadmap_published = true where id = 'neck-plus';

-- Cloned URLs are wrong content for these devices; drop them so the
-- readiness panel is honest (0/28) instead of showing borrowed videos.
update public.program_days
set video_url_vn = null, video_url_us = null, video_url_malay = null
where product_id in ('neck-pro', 'back-plus', 'back-pro');

alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications add constraint notifications_type_check
  check (type = any (array['schedule','ad','blog','chat','streak_milestone','inactivity','post_reaction','post_comment','comment_reply','comment_reaction','post_moderation','roadmap_ready']));

create or replace function public.roadmap_readiness(p_product_id text)
returns table(market text, total_days integer, days_with_video integer, missing_days integer[], duplicate_days integer[])
language sql stable security definer set search_path to ''
as $$
  with days as (
    select pd.day_number, pd.day_type,
           m.market,
           case m.market when 'US' then pd.video_url_us when 'MALAY' then pd.video_url_malay else pd.video_url_vn end as video
    from public.program_days pd
    cross join (values ('VN'),('US'),('MALAY')) m(market)
    where pd.product_id = p_product_id
  ),
  flagged as (
    select d.*,
           nullif(btrim(d.video), '') is null as missing,
           exists (
             select 1 from days e
             where e.market = d.market and e.day_number < d.day_number
               and nullif(btrim(e.video), '') is not null and e.video = d.video
           ) as duplicate
    from days d
  )
  select f.market,
         count(*)::int as total_days,
         count(*) filter (where not f.missing)::int as days_with_video,
         coalesce(array_agg(f.day_number order by f.day_number) filter (where f.missing and f.day_type <> 'rest'), '{}') as missing_days,
         coalesce(array_agg(f.day_number order by f.day_number) filter (where f.duplicate), '{}') as duplicate_days
  from flagged f
  where 'admin' = any(public.current_web_roles()) or 'cskh' = any(public.current_web_roles())
  group by f.market
  order by case f.market when 'VN' then 0 when 'US' then 1 else 2 end;
$$;
revoke execute on function public.roadmap_readiness(text) from anon;
grant execute on function public.roadmap_readiness(text) to authenticated;

create or replace function public.roadmap_ready_copy(p_language text, p_product_name text)
returns table(title text, body text)
language sql immutable set search_path to ''
as $$
  select
    case p_language
      when 'en' then 'Your ' || p_product_name || ' roadmap is ready'
      when 'ms' then 'Pelan ' || p_product_name || ' anda sudah sedia'
      else 'Lộ trình ' || p_product_name || ' đã sẵn sàng' end,
    case p_language
      when 'en' then 'The exercise videos are live. Open the Roadmap tab to start Day 1.'
      when 'ms' then 'Video senaman telah tersedia. Buka tab Pelan untuk memulakan Hari 1.'
      else 'Video bài tập đã có. Mở tab Lộ trình để bắt đầu Ngày 1 nhé.' end;
$$;
revoke execute on function public.roadmap_ready_copy(text, text) from anon, authenticated;

create or replace function public.notify_roadmap_published()
returns trigger language plpgsql security definer set search_path to ''
as $$
begin
  if new.roadmap_published and not coalesce(old.roadmap_published, false) then
    insert into public.notifications (user_id, type, title, body, related_product_id, destination, actor_name, actor_is_official)
    select up.user_id, 'roadmap_ready', c.title, c.body, new.id, 'roadmap', 'TheraHOME', true
    from public.user_programs up
    join public.profiles pr on pr.id = up.user_id
    cross join lateral public.roadmap_ready_copy(
      coalesce(pr.language, 'vi'),
      case coalesce(pr.language, 'vi') when 'en' then coalesce(new.name_en, new.name) when 'ms' then coalesce(new.name_ms, new.name) else new.name end
    ) c
    where up.product_id = new.id
      and pr.deleted_at is null and pr.locked = false
      and pr.account_type not in ('review', 'admin', 'cskh');
  end if;
  return new;
end;
$$;
drop trigger if exists trg_notify_roadmap_published on public.products;
create trigger trg_notify_roadmap_published
  after update of roadmap_published on public.products
  for each row execute function public.notify_roadmap_published();
