-- Community posts: multiple images/videos per post (MediaGrid feature).
-- `image_url` is kept as-is (mirrors media_urls[1]) since it's already relied
-- on elsewhere (notifications thumbnail join) — no need to touch that code.
alter table public.community_posts
  add column media_urls text[] not null default '{}';

update public.community_posts
  set media_urls = array[image_url]
  where image_url is not null;
