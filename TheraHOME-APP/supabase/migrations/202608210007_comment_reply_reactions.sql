-- Rich reactions for comments and replies. Replies already live in
-- post_comments, so they intentionally use the exact same table and APIs.
alter table public.comment_likes
  add column if not exists reaction text not null default 'heart';

update public.comment_likes set reaction = 'heart' where reaction is null;

alter table public.comment_likes drop constraint if exists comment_likes_reaction_check;
alter table public.comment_likes add constraint comment_likes_reaction_check
  check (reaction in ('heart', 'like', 'haha', 'celebrate', 'support'));

create index if not exists comment_likes_comment_reaction_idx
  on public.comment_likes(comment_id, reaction);

-- Reading a reaction breakdown is required to render the small 1–2 emoji
-- summary on a visible comment. Writes remain constrained by the existing
-- own-comment-likes policy.
drop policy if exists "public read comment reactions" on public.comment_likes;
create policy "public read comment reactions"
on public.comment_likes for select to authenticated
using (
  exists (
    select 1 from public.post_comments comment
    join public.community_posts post on post.id = comment.post_id
    where comment.id = comment_likes.comment_id
      and not comment.hidden and not post.hidden
  )
);

-- UPDATE is used when a member swaps ❤️ → 💪. Touching the denormalized
-- comment row is deliberate: existing post_comments realtime subscriptions
-- then refresh only the open post detail, without a global feed refresh.
create or replace function public.bump_comment_likes()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    update post_comments set likes_count = likes_count + 1 where id = new.comment_id;
    return new;
  elsif tg_op = 'DELETE' then
    update post_comments set likes_count = greatest(0, likes_count - 1) where id = old.comment_id;
    return old;
  elsif tg_op = 'UPDATE' then
    update post_comments set likes_count = likes_count where id = new.comment_id;
    return new;
  end if;
  return null;
end;
$$;

drop trigger if exists trg_comment_likes on public.comment_likes;
create trigger trg_comment_likes
after insert or update or delete on public.comment_likes
for each row execute function public.bump_comment_likes();

-- One notification per actor + entity avoids reaction-change spam. Changing
-- a reaction refreshes the existing inbox item rather than adding another.
create or replace function public.notify_comment_reaction_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner_id uuid;
  v_post_id uuid;
  v_parent_id uuid;
  v_actor_name text;
  v_actor_avatar text;
  v_notification_id uuid;
  v_key text;
begin
  if tg_op = 'UPDATE' and old.reaction is not distinct from new.reaction then
    return new;
  end if;
  select author_id, post_id, parent_comment_id
  into v_owner_id, v_post_id, v_parent_id
  from public.post_comments where id = new.comment_id;
  if v_owner_id is null or v_owner_id = new.user_id then return new; end if;

  select full_name, avatar_url into v_actor_name, v_actor_avatar
  from public.profiles where id = new.user_id;
  v_key := 'comment-reaction:' || new.comment_id::text || ':' || new.user_id::text;
  select id into v_notification_id
  from public.notifications
  where user_id = v_owner_id and system_key = v_key
  limit 1;

  if v_notification_id is null then
    insert into public.notifications (
      user_id, type, title, body, destination, related_post_id,
      related_comment_id, related_parent_comment_id, actor_id, actor_name,
      actor_avatar_url, system_key
    ) values (
      v_owner_id, 'like', coalesce(v_actor_name, 'Ai đó') || ' đã bày tỏ cảm xúc về bình luận của bạn',
      null, 'community_post', v_post_id, new.comment_id, v_parent_id,
      new.user_id, v_actor_name, v_actor_avatar, v_key
    );
  else
    update public.notifications
    set title = coalesce(v_actor_name, 'Ai đó') || ' đã bày tỏ cảm xúc về bình luận của bạn',
        actor_name = v_actor_name, actor_avatar_url = v_actor_avatar,
        related_post_id = v_post_id, related_parent_comment_id = v_parent_id,
        read = false, created_at = now()
    where id = v_notification_id;
  end if;
  return new;
end;
$$;

revoke all on function public.notify_comment_reaction_event() from public, anon, authenticated;
drop trigger if exists trg_notify_comment_reaction on public.comment_likes;
create trigger trg_notify_comment_reaction
after insert or update of reaction on public.comment_likes
for each row execute function public.notify_comment_reaction_event();

-- The project already had post reactions. Extend its trigger to update the
-- existing record too, rather than emitting a new notification for every swap.
create or replace function public.notify_post_like_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_post_author_id uuid;
  v_name text;
  v_avatar text;
  v_notification_id uuid;
  v_key text;
begin
  if tg_op = 'UPDATE' and old.reaction is not distinct from new.reaction then return new; end if;
  select author_id into v_post_author_id from public.community_posts where id = new.post_id;
  if v_post_author_id is null or v_post_author_id = new.user_id then return new; end if;
  select full_name, avatar_url into v_name, v_avatar from public.profiles where id = new.user_id;
  v_key := 'post-reaction:' || new.post_id::text || ':' || new.user_id::text;
  select id into v_notification_id from public.notifications where user_id = v_post_author_id and system_key = v_key limit 1;
  if v_notification_id is null then
    insert into public.notifications (user_id, type, title, body, related_post_id, destination, actor_id, actor_name, actor_avatar_url, system_key)
    values (v_post_author_id, 'like', coalesce(v_name, 'Ai đó') || ' đã bày tỏ cảm xúc về bài viết của bạn', null, new.post_id, 'community_post', new.user_id, v_name, v_avatar, v_key);
  else
    update public.notifications
    set title = coalesce(v_name, 'Ai đó') || ' đã bày tỏ cảm xúc về bài viết của bạn',
        actor_name = v_name, actor_avatar_url = v_avatar, read = false, created_at = now()
    where id = v_notification_id;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_notify_post_like on public.post_likes;
create trigger trg_notify_post_like
after insert or update of reaction on public.post_likes
for each row execute function public.notify_post_like_event();
