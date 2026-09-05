-- CSKH can already create and edit official TheraHOME posts (RPC + update
-- policy) but the delete policy excluded them (owner request 2026-09-05:
-- "các bài từ TheraHOME trên CSKH chưa xoá được"). Align delete with the
-- other two.
drop policy if exists "web cskh delete user posts" on public.community_posts;
create policy "web cskh delete any post" on public.community_posts
  for delete to authenticated
  using ('cskh' = any(public.current_web_roles()));
