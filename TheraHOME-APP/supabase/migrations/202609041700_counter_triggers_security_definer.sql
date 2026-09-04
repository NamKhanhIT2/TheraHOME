-- QA find (2026-09-04): the three counter trigger functions ran WITHOUT
-- security definer, so their UPDATE on community_posts/post_comments was
-- subject to the CALLER's RLS ("authors update own posts"). Liking or
-- commenting on someone ELSE's content silently updated 0 rows — the
-- like/comment row itself was inserted fine, but likes_count/
-- comments_count never moved (feed said "No likes yet" while post_likes
-- had rows). Fix: run the counter bumps as definer, then backfill every
-- counter from its source-of-truth table.

alter function public.bump_post_likes() security definer set search_path = public;
alter function public.bump_post_comments() security definer set search_path = public;
alter function public.bump_comment_likes() security definer set search_path = public;

update community_posts p
   set likes_count = (select count(*) from post_likes pl where pl.post_id = p.id)
 where p.likes_count is distinct from (select count(*) from post_likes pl where pl.post_id = p.id);

update community_posts p
   set comments_count = (select count(*) from post_comments pc where pc.post_id = p.id)
 where p.comments_count is distinct from (select count(*) from post_comments pc where pc.post_id = p.id);

update post_comments c
   set likes_count = (select count(*) from comment_likes cl where cl.comment_id = c.id)
 where c.likes_count is distinct from (select count(*) from comment_likes cl where cl.comment_id = c.id);
