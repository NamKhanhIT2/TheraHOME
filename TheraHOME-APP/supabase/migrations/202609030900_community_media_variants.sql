-- Purpose-sized community media. Existing posts keep working because the
-- feed/thumbnail arrays are backfilled with their current original URLs.
alter table public.community_posts
  add column if not exists media_feed_urls text[] not null default '{}',
  add column if not exists media_thumbnail_urls text[] not null default '{}',
  add column if not exists media_poster_urls text[] not null default '{}',
  add column if not exists media_widths integer[] not null default '{}',
  add column if not exists media_heights integer[] not null default '{}';

update public.community_posts
set media_feed_urls = media_urls,
    media_thumbnail_urls = media_urls
where cardinality(media_urls) > 0
  and cardinality(media_feed_urls) = 0;

comment on column public.community_posts.media_feed_urls is 'Display-sized image URLs aligned by index with media_urls; videos retain their original URL.';
comment on column public.community_posts.media_thumbnail_urls is 'Small preview URLs aligned by index with media_urls.';
comment on column public.community_posts.media_poster_urls is 'Video poster URLs aligned by index; empty string for images or legacy media.';
