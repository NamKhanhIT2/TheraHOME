-- Refactors Community notifications (post/comment reactions, comments,
-- replies) to a Facebook-style event-driven model:
--   - True grouping: multiple reactors on the same post/comment fold into
--     ONE notification row ("A và N người khác"), instead of one row per
--     reactor. Comments/replies stay one row per event (never grouped, per
--     product decision — different people's comments say different things).
--   - Canonical event types replacing the old ambiguous 'like' (used for
--     both post AND comment reactions) / 'comment' / 'reply'.
--   - A single shared text-template function instead of each trigger
--     hardcoding its own copy of the phrasing.
--   - Push gets its own (shorter) title/body, computed alongside the
--     Notification Center text from the same event, not re-derived later.
-- Marketing/upsell notification types (schedule, inactivity, ad, blog,
-- chat, streak_milestone) are untouched.

-- ---- Schema ----

alter table public.notifications
  add column if not exists reaction_type text,
  add column if not exists push_title text,
  add column if not exists push_body text,
  add column if not exists group_actor_ids uuid[] not null default '{}',
  add column if not exists second_actor_name text;

-- Dropped now, re-added with the canonical set at the end of this
-- migration — the old constraint rejects the new type values, and the new
-- constraint would reject rows still holding old values, so there's no
-- ordering that keeps a constraint in place across the retype below.
alter table public.notifications drop constraint if exists notifications_type_check;

-- Forward-compatible per-category push toggles (Section 15) — schema only
-- for now, all default enabled so behavior is unchanged until a Settings
-- screen actually exposes them. Turning a category off must never delete
-- existing Notification Center rows — dispatch-push checks these before
-- sending, the Center-row triggers below never do.
alter table public.profiles
  add column if not exists notify_comments boolean not null default true,
  add column if not exists notify_replies boolean not null default true,
  add column if not exists notify_reactions boolean not null default true,
  add column if not exists notify_community boolean not null default true;

-- ---- Shared helpers ----

create or replace function public.truncate_with_ellipsis(p_text text, p_max int)
returns text
language sql
immutable
set search_path = public
as $$
  select case when p_text is null then null
    when length(p_text) > p_max then left(p_text, p_max) || '…'
    else p_text end;
$$;

-- The one place Community notification copy is written. Callers pass the
-- canonical event type + whoever's involved; this returns every text
-- variant that event needs (Center title/body, Push title/body). Keeping
-- this as its own function — rather than inlined per-trigger — is what
-- lets a future localization pass swap wording without touching the
-- grouping/dedup business logic in the triggers below.
create or replace function public.format_community_notification(
  p_type text,
  p_actor_name text,
  p_second_actor_name text,
  p_group_count int,
  p_preview text
)
returns table(title text, body text, push_title text, push_body text)
language plpgsql
set search_path = public
as $$
declare
  v_actor text := coalesce(p_actor_name, 'Ai đó');
  v_who text;
begin
  if p_group_count is null or p_group_count <= 1 then
    v_who := v_actor;
  elsif p_group_count = 2 then
    v_who := v_actor || ' và ' || coalesce(p_second_actor_name, 'một người khác');
  else
    v_who := v_actor || ' và ' || (p_group_count - 1)::text || ' người khác';
  end if;

  if p_type = 'post_reaction' then
    title := v_who || ' đã bày tỏ cảm xúc về bài viết của bạn.';
    body := null;
    push_title := v_who;
    push_body := 'đã bày tỏ cảm xúc về bài viết của bạn.';
  elsif p_type = 'comment_reaction' then
    title := v_who || ' đã bày tỏ cảm xúc về bình luận của bạn.';
    body := null;
    push_title := v_who;
    push_body := 'đã bày tỏ cảm xúc về bình luận của bạn.';
  elsif p_type = 'post_comment' then
    title := v_actor || ' đã bình luận về bài viết của bạn:';
    body := p_preview;
    push_title := v_actor || ' đã bình luận';
    push_body := coalesce(p_preview, 'Xem bình luận mới');
  elsif p_type = 'comment_reply' then
    title := v_actor || ' đã trả lời bình luận của bạn:';
    body := p_preview;
    push_title := v_actor || ' đã trả lời bạn';
    push_body := coalesce(p_preview, 'Xem câu trả lời mới');
  else
    title := v_actor;
    body := p_preview;
    push_title := v_actor;
    push_body := coalesce(p_preview, '');
  end if;
  return next;
end;
$$;

revoke all on function public.truncate_with_ellipsis(text, int) from public, anon, authenticated;
revoke all on function public.format_community_notification(text, text, text, int, text) from public, anon, authenticated;

-- ---- Post reactions (grouped) ----

create or replace function public.notify_post_like_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_post_author_id uuid;
  v_actor_id uuid;
  v_key text;
  v_notification_id uuid;
  v_group_ids uuid[];
  v_primary_id uuid;
  v_primary_name text;
  v_primary_avatar text;
  v_second_name text;
  v_reaction text;
  v_formatted record;
begin
  v_actor_id := coalesce(new.user_id, old.user_id);
  select author_id into v_post_author_id from public.community_posts where id = coalesce(new.post_id, old.post_id);
  if v_post_author_id is null or v_post_author_id = v_actor_id then return coalesce(new, old); end if;
  if tg_op = 'UPDATE' and old.reaction is not distinct from new.reaction then return new; end if;

  v_key := 'post-reaction:' || coalesce(new.post_id, old.post_id)::text;
  select id, group_actor_ids into v_notification_id, v_group_ids
  from public.notifications where user_id = v_post_author_id and system_key = v_key limit 1;

  if tg_op = 'DELETE' then
    if v_notification_id is null then return old; end if;
    v_group_ids := array_remove(v_group_ids, v_actor_id);
    if v_group_ids is null or array_length(v_group_ids, 1) is null then
      delete from public.notifications where id = v_notification_id;
      return old;
    end if;
    v_primary_id := v_group_ids[1];
    select full_name, avatar_url into v_primary_name, v_primary_avatar from public.profiles where id = v_primary_id;
    select reaction into v_reaction from public.post_likes where post_id = old.post_id and user_id = v_primary_id;
    v_second_name := case when array_length(v_group_ids, 1) >= 2 then (select full_name from public.profiles where id = v_group_ids[2]) else null end;
    select * into v_formatted from public.format_community_notification('post_reaction', v_primary_name, v_second_name, array_length(v_group_ids, 1), null);
    update public.notifications set
      group_actor_ids = v_group_ids, actor_id = v_primary_id, actor_name = v_primary_name,
      actor_avatar_url = v_primary_avatar, second_actor_name = v_second_name, reaction_type = v_reaction,
      title = v_formatted.title, body = v_formatted.body, push_title = v_formatted.push_title, push_body = v_formatted.push_body
    where id = v_notification_id;
    return old;
  end if;

  if v_notification_id is null then
    v_group_ids := array[v_actor_id];
  elsif not (v_actor_id = any(v_group_ids)) then
    v_group_ids := array_append(v_group_ids, v_actor_id);
  end if;

  v_primary_id := v_group_ids[1];
  select full_name, avatar_url into v_primary_name, v_primary_avatar from public.profiles where id = v_primary_id;
  v_second_name := case when array_length(v_group_ids, 1) >= 2 then (select full_name from public.profiles where id = v_group_ids[2]) else null end;
  select * into v_formatted from public.format_community_notification('post_reaction', v_primary_name, v_second_name, array_length(v_group_ids, 1), null);

  if v_notification_id is null then
    insert into public.notifications (
      user_id, type, title, body, push_title, push_body, destination, related_post_id,
      actor_id, actor_name, actor_avatar_url, second_actor_name, reaction_type, group_actor_ids, system_key
    ) values (
      v_post_author_id, 'post_reaction', v_formatted.title, v_formatted.body, v_formatted.push_title, v_formatted.push_body,
      'community_post', new.post_id, v_primary_id, v_primary_name, v_primary_avatar, v_second_name, new.reaction, v_group_ids, v_key
    );
  else
    update public.notifications set
      title = v_formatted.title, body = v_formatted.body, push_title = v_formatted.push_title, push_body = v_formatted.push_body,
      actor_id = v_primary_id, actor_name = v_primary_name, actor_avatar_url = v_primary_avatar,
      second_actor_name = v_second_name, reaction_type = new.reaction, group_actor_ids = v_group_ids,
      read = false, created_at = now()
    where id = v_notification_id;
  end if;
  return new;
end;
$$;

revoke all on function public.notify_post_like_event() from public, anon, authenticated;
drop trigger if exists trg_notify_post_like on public.post_likes;
create trigger trg_notify_post_like
after insert or update of reaction or delete on public.post_likes
for each row execute function public.notify_post_like_event();

-- ---- Comment reactions (grouped) ----

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
  v_actor_id uuid;
  v_key text;
  v_notification_id uuid;
  v_group_ids uuid[];
  v_primary_id uuid;
  v_primary_name text;
  v_primary_avatar text;
  v_second_name text;
  v_reaction text;
  v_formatted record;
  v_comment_id uuid;
begin
  v_actor_id := coalesce(new.user_id, old.user_id);
  v_comment_id := coalesce(new.comment_id, old.comment_id);
  select author_id, post_id, parent_comment_id into v_owner_id, v_post_id, v_parent_id
  from public.post_comments where id = v_comment_id;
  if v_owner_id is null or v_owner_id = v_actor_id then return coalesce(new, old); end if;
  if tg_op = 'UPDATE' and old.reaction is not distinct from new.reaction then return new; end if;

  v_key := 'comment-reaction:' || v_comment_id::text;
  select id, group_actor_ids into v_notification_id, v_group_ids
  from public.notifications where user_id = v_owner_id and system_key = v_key limit 1;

  if tg_op = 'DELETE' then
    if v_notification_id is null then return old; end if;
    v_group_ids := array_remove(v_group_ids, v_actor_id);
    if v_group_ids is null or array_length(v_group_ids, 1) is null then
      delete from public.notifications where id = v_notification_id;
      return old;
    end if;
    v_primary_id := v_group_ids[1];
    select full_name, avatar_url into v_primary_name, v_primary_avatar from public.profiles where id = v_primary_id;
    select reaction into v_reaction from public.comment_likes where comment_id = v_comment_id and user_id = v_primary_id;
    v_second_name := case when array_length(v_group_ids, 1) >= 2 then (select full_name from public.profiles where id = v_group_ids[2]) else null end;
    select * into v_formatted from public.format_community_notification('comment_reaction', v_primary_name, v_second_name, array_length(v_group_ids, 1), null);
    update public.notifications set
      group_actor_ids = v_group_ids, actor_id = v_primary_id, actor_name = v_primary_name,
      actor_avatar_url = v_primary_avatar, second_actor_name = v_second_name, reaction_type = v_reaction,
      title = v_formatted.title, body = v_formatted.body, push_title = v_formatted.push_title, push_body = v_formatted.push_body,
      related_post_id = v_post_id, related_parent_comment_id = v_parent_id
    where id = v_notification_id;
    return old;
  end if;

  if v_notification_id is null then
    v_group_ids := array[v_actor_id];
  elsif not (v_actor_id = any(v_group_ids)) then
    v_group_ids := array_append(v_group_ids, v_actor_id);
  end if;

  v_primary_id := v_group_ids[1];
  select full_name, avatar_url into v_primary_name, v_primary_avatar from public.profiles where id = v_primary_id;
  v_second_name := case when array_length(v_group_ids, 1) >= 2 then (select full_name from public.profiles where id = v_group_ids[2]) else null end;
  select * into v_formatted from public.format_community_notification('comment_reaction', v_primary_name, v_second_name, array_length(v_group_ids, 1), null);

  if v_notification_id is null then
    insert into public.notifications (
      user_id, type, title, body, push_title, push_body, destination, related_post_id,
      related_comment_id, related_parent_comment_id, actor_id, actor_name, actor_avatar_url,
      second_actor_name, reaction_type, group_actor_ids, system_key
    ) values (
      v_owner_id, 'comment_reaction', v_formatted.title, v_formatted.body, v_formatted.push_title, v_formatted.push_body,
      'community_post', v_post_id, v_comment_id, v_parent_id, v_primary_id, v_primary_name, v_primary_avatar,
      v_second_name, new.reaction, v_group_ids, v_key
    );
  else
    update public.notifications set
      title = v_formatted.title, body = v_formatted.body, push_title = v_formatted.push_title, push_body = v_formatted.push_body,
      actor_id = v_primary_id, actor_name = v_primary_name, actor_avatar_url = v_primary_avatar,
      second_actor_name = v_second_name, reaction_type = new.reaction, group_actor_ids = v_group_ids,
      related_post_id = v_post_id, related_parent_comment_id = v_parent_id, read = false, created_at = now()
    where id = v_notification_id;
  end if;
  return new;
end;
$$;

revoke all on function public.notify_comment_reaction_event() from public, anon, authenticated;
drop trigger if exists trg_notify_comment_reaction on public.comment_likes;
create trigger trg_notify_comment_reaction
after insert or update of reaction or delete on public.comment_likes
for each row execute function public.notify_comment_reaction_event();

-- ---- Comments + replies (never grouped — different content each time) ----

create or replace function public.notify_post_comment_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_post_author_id uuid;
  v_parent_author_id uuid;
  v_preview text;
  v_formatted record;
begin
  v_preview := public.truncate_with_ellipsis(coalesce(nullif(new.text, ''), 'Đã gửi một ảnh'), 100);
  select author_id into v_post_author_id from public.community_posts where id = new.post_id;

  if v_post_author_id is not null and v_post_author_id <> new.author_id then
    select * into v_formatted from public.format_community_notification('post_comment', new.author_name, null, 1, v_preview);
    insert into public.notifications (
      user_id, type, title, body, push_title, push_body, related_post_id, related_comment_id,
      related_parent_comment_id, destination, actor_id, actor_name, actor_avatar_url
    ) values (
      v_post_author_id, 'post_comment', v_formatted.title, v_formatted.body, v_formatted.push_title, v_formatted.push_body,
      new.post_id, new.id, new.parent_comment_id, 'community_post', new.author_id, new.author_name, new.author_avatar_url
    );
  end if;

  if new.parent_comment_id is not null then
    select author_id into v_parent_author_id from public.post_comments where id = new.parent_comment_id;
    if v_parent_author_id is not null and v_parent_author_id <> new.author_id and v_parent_author_id <> v_post_author_id then
      select * into v_formatted from public.format_community_notification('comment_reply', new.author_name, null, 1, v_preview);
      insert into public.notifications (
        user_id, type, title, body, push_title, push_body, related_post_id, related_comment_id,
        related_parent_comment_id, destination, actor_id, actor_name, actor_avatar_url
      ) values (
        v_parent_author_id, 'comment_reply', v_formatted.title, v_formatted.body, v_formatted.push_title, v_formatted.push_body,
        new.post_id, new.id, new.parent_comment_id, 'community_post', new.author_id, new.author_name, new.author_avatar_url
      );
    end if;
  end if;
  return new;
end;
$$;

revoke all on function public.notify_post_comment_event() from public, anon, authenticated;

-- ---- Retype existing rows to the new canonical event names ----
-- Small dev dataset (7 'like' + 7 'comment' rows at migration time) — a
-- straight retype is enough; no retroactive merge into grouped rows.

update public.notifications set type = 'comment_reaction' where type = 'like' and related_comment_id is not null;
update public.notifications set type = 'post_reaction' where type = 'like' and related_comment_id is null;
update public.notifications set type = 'post_comment' where type = 'comment';
update public.notifications set type = 'comment_reply' where type = 'reply';
update public.notifications
  set group_actor_ids = array[actor_id]
  where type in ('post_reaction', 'comment_reaction') and actor_id is not null and group_actor_ids = '{}';

-- Now that no row still carries an old 'like'/'comment'/'reply' value,
-- reinstate the constraint with the canonical set. Was
-- ARRAY['schedule','ad','blog','comment','reply','like','chat',
-- 'streak_milestone','inactivity'] — 'like' ambiguously covered both post
-- AND comment reactions.
alter table public.notifications add constraint notifications_type_check
  check (type = any (array['schedule', 'ad', 'blog', 'chat', 'streak_milestone', 'inactivity',
    'post_reaction', 'post_comment', 'comment_reply', 'comment_reaction']));
