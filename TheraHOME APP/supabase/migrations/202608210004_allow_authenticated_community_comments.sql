-- Every signed-in app user may comment on any visible community post and
-- reply to a visible comment belonging to that same post.  The author_id
-- check prevents writing a comment on behalf of another account.

grant insert on table public.post_comments to authenticated;

drop policy if exists "authenticated users create community comments" on public.post_comments;
create policy "authenticated users create community comments"
on public.post_comments
for insert
to authenticated
with check (
  author_id = (select auth.uid())
  and exists (
    select 1
    from public.community_posts post
    where post.id = post_comments.post_id
      and not post.hidden
  )
  and (
    parent_comment_id is null
    or exists (
      select 1
      from public.post_comments parent_comment
      where parent_comment.id = post_comments.parent_comment_id
        and parent_comment.post_id = post_comments.post_id
        and not parent_comment.hidden
    )
  )
);
