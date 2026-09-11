-- App Review accounts are never rate-limited on community posts/comments.
--
-- Owner's principle (2026-09-11): `account_type = 'review'` is the
-- highest-privilege app account and must never hit a lock, gate or limit. The
-- content rate limit (max 5 posts or 5 comments per author per 10 minutes,
-- raising 'rate_limited') would block a reviewer who creates several test
-- posts/comments in a row — so exempt them up front. Everyone else keeps the
-- existing limit unchanged.
--
-- Server-side only (this trigger decides), so the already-submitted iOS build
-- 21 and every older build pick it up with no rebuild. Both community_posts
-- and post_comments carry author_id, so one check covers both tables. The
-- unsafe-content filter is deliberately NOT bypassed: review posts publish
-- straight to real users, and a normal reviewer never trips it.

create or replace function public.enforce_content_rate_limit()
 returns trigger
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare
  v_recent_count integer;
begin
  if exists (
    select 1 from public.profiles p
    where p.id = new.author_id and p.account_type = 'review'
  ) then
    return new;
  end if;

  if tg_table_name = 'community_posts' then
    select count(*) into v_recent_count
    from public.community_posts
    where author_id = new.author_id and created_at > now() - interval '10 minutes';
  else
    select count(*) into v_recent_count
    from public.post_comments
    where author_id = new.author_id and created_at > now() - interval '10 minutes';
  end if;

  if v_recent_count >= 5 then
    raise exception using errcode = 'P0001', message = 'rate_limited';
  end if;

  return new;
end;
$function$;
