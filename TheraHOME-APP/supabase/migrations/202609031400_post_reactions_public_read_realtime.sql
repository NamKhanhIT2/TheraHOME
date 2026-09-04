-- Two community-reaction sync fixes (2026-09-03):
--
-- 1. post_likes was only readable by its author ("own post_likes" ALL
--    policy) — unlike comment_likes, which has had a public-read policy all
--    along. Every OTHER account therefore aggregated 0 reactions on a post
--    forever ("bài có react rồi nhưng vẫn hiện chưa có lượt thích").
--    Mirror comment_likes' visibility rule: anyone can read reactions on a
--    non-hidden post.
--
-- 2. Neither reactions table was in the supabase_realtime publication, so
--    reaction changes never pushed to other clients (same gotcha the Phase 5
--    enable_realtime_publication migration fixed for posts/comments).

create policy "public read post reactions" on public.post_likes
  for select
  using (
    exists (
      select 1
      from community_posts post
      where post.id = post_likes.post_id
        and not post.hidden
    )
  );

alter publication supabase_realtime add table public.post_likes;
alter publication supabase_realtime add table public.comment_likes;
