-- Use one server-side entry point for community comments.  This avoids a
-- client-side RLS edge case while retaining the existing moderation, rate
-- limit, author-info and notification triggers on post_comments.
create or replace function public.create_community_comment(
  p_post_id uuid,
  p_text text,
  p_parent_comment_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_comment_id uuid;
begin
  if v_user_id is null then
    raise exception using errcode = 'P0001', message = 'authentication_required';
  end if;

  if nullif(btrim(p_text), '') is null then
    raise exception using errcode = 'P0001', message = 'comment_text_required';
  end if;

  if not exists (
    select 1
    from public.community_posts post
    where post.id = p_post_id
      and not post.hidden
  ) then
    raise exception using errcode = 'P0001', message = 'community_post_not_found';
  end if;

  if p_parent_comment_id is not null and not exists (
    select 1
    from public.post_comments parent_comment
    where parent_comment.id = p_parent_comment_id
      and parent_comment.post_id = p_post_id
      and not parent_comment.hidden
  ) then
    raise exception using errcode = 'P0001', message = 'invalid_parent_comment';
  end if;

  insert into public.post_comments (post_id, author_id, text, parent_comment_id)
  values (p_post_id, v_user_id, btrim(p_text), p_parent_comment_id)
  returning id into v_comment_id;

  return v_comment_id;
end;
$$;

revoke all on function public.create_community_comment(uuid, text, uuid) from public, anon;
grant execute on function public.create_community_comment(uuid, text, uuid) to authenticated, service_role;
