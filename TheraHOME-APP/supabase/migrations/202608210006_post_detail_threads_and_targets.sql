-- Post Detail extension: comment media plus exact notification targets.
-- Existing text comments and existing notification rows remain valid.
alter table public.post_comments
  add column if not exists image_url text;

alter table public.notifications
  add column if not exists related_comment_id uuid references public.post_comments(id) on delete cascade,
  add column if not exists related_parent_comment_id uuid references public.post_comments(id) on delete set null;

-- A personal hide is intentionally separate from moderation's global
-- `post_comments.hidden` flag: it affects only the user who hid the comment.
create table if not exists public.hidden_community_comments (
  user_id uuid not null references auth.users(id) on delete cascade,
  comment_id uuid not null references public.post_comments(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, comment_id)
);
alter table public.hidden_community_comments enable row level security;
create policy "users manage own hidden community comments"
on public.hidden_community_comments for all to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

create index if not exists notifications_related_comment_idx
  on public.notifications (related_comment_id, created_at desc)
  where related_comment_id is not null;

-- A user may edit only their own comment. Staff moderation remains governed by
-- the pre-existing admin policy.
drop policy if exists "authors update own comments" on public.post_comments;
create policy "authors update own comments"
on public.post_comments for update to authenticated
using (author_id = (select auth.uid()))
with check (author_id = (select auth.uid()));

-- Replace the earlier RPC with an additive media argument. Keeping the write
-- in this RPC makes auth.uid the source of truth and preserves all existing
-- triggers (author metadata, moderation, rate limit and notifications).
drop function if exists public.create_community_comment(uuid, text, uuid);
create function public.create_community_comment(
  p_post_id uuid,
  p_text text,
  p_parent_comment_id uuid default null,
  p_image_url text default null
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
  if nullif(btrim(p_text), '') is null and nullif(btrim(p_image_url), '') is null then
    raise exception using errcode = 'P0001', message = 'comment_content_required';
  end if;
  if not exists (
    select 1 from public.community_posts post
    where post.id = p_post_id and not post.hidden
  ) then
    raise exception using errcode = 'P0001', message = 'community_post_not_found';
  end if;
  if p_parent_comment_id is not null and not exists (
    select 1 from public.post_comments parent_comment
    where parent_comment.id = p_parent_comment_id
      and parent_comment.post_id = p_post_id
      and not parent_comment.hidden
  ) then
    raise exception using errcode = 'P0001', message = 'invalid_parent_comment';
  end if;

  insert into public.post_comments (post_id, author_id, text, parent_comment_id, image_url)
  values (p_post_id, v_user_id, coalesce(nullif(btrim(p_text), ''), ''), p_parent_comment_id, nullif(btrim(p_image_url), ''))
  returning id into v_comment_id;
  return v_comment_id;
end;
$$;

revoke all on function public.create_community_comment(uuid, text, uuid, text) from public, anon;
grant execute on function public.create_community_comment(uuid, text, uuid, text) to authenticated, service_role;

create or replace function public.notify_post_comment_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_post_author_id uuid;
  v_parent_author_id uuid;
begin
  select author_id into v_post_author_id from public.community_posts where id = new.post_id;

  if v_post_author_id is not null and v_post_author_id <> new.author_id then
    insert into public.notifications (
      user_id, type, title, body, related_post_id, related_comment_id,
      related_parent_comment_id, destination, actor_id, actor_name, actor_avatar_url
    ) values (
      v_post_author_id, 'comment', coalesce(new.author_name, 'Ai đó') || ' đã bình luận bài viết của bạn',
      left(coalesce(nullif(new.text, ''), 'Đã gửi một ảnh'), 140), new.post_id, new.id,
      new.parent_comment_id, 'community_post', new.author_id, new.author_name, new.author_avatar_url
    );
  end if;

  if new.parent_comment_id is not null then
    select author_id into v_parent_author_id from public.post_comments where id = new.parent_comment_id;
    if v_parent_author_id is not null and v_parent_author_id <> new.author_id and v_parent_author_id <> v_post_author_id then
      insert into public.notifications (
        user_id, type, title, body, related_post_id, related_comment_id,
        related_parent_comment_id, destination, actor_id, actor_name, actor_avatar_url
      ) values (
        v_parent_author_id, 'reply', coalesce(new.author_name, 'Ai đó') || ' đã trả lời bình luận của bạn',
        left(coalesce(nullif(new.text, ''), 'Đã gửi một ảnh'), 140), new.post_id, new.id,
        new.parent_comment_id, 'community_post', new.author_id, new.author_name, new.author_avatar_url
      );
    end if;
  end if;
  return new;
end;
$$;
