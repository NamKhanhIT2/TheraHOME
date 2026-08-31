-- Notification centre: every source writes a durable inbox row with a
-- concrete destination.  Push is an enhancement; the bell remains complete
-- even when a device has no push permission/token.

alter table public.notifications
  add column if not exists related_chat_thread_id uuid references public.chat_threads(id) on delete cascade,
  add column if not exists destination text,
  add column if not exists actor_id uuid references public.profiles(id) on delete set null,
  add column if not exists actor_name text,
  add column if not exists actor_avatar_url text,
  add column if not exists actor_is_official boolean not null default false;

create index if not exists notifications_user_created_idx
  on public.notifications (user_id, created_at desc);

create index if not exists notifications_chat_thread_idx
  on public.notifications (related_chat_thread_id, created_at desc)
  where related_chat_thread_id is not null;

-- Official posts need an exact deep-link target, not just the official feed.
create or replace function public.notify_official_post_inbox()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.notifications (user_id, type, title, body, related_post_id, destination, actor_name, actor_is_official)
  select profile.id,
         'blog',
         case
           when nullif(btrim(new.tag), '') is null then 'Bài viết mới từ TheraHOME'
           else 'TheraHOME · ' || btrim(new.tag)
         end,
         left(coalesce(new.text, ''), 240),
         new.id,
         'community_post',
         'TheraHOME',
         true
  from public.profiles profile
  where profile.deleted_at is null
    and profile.locked = false;

  return new;
end;
$$;

-- A new human-support message is reflected in the notification bell. The
-- existing dispatch-push function remains responsible for the remote banner;
-- this trigger is intentionally push-free so it cannot duplicate a banner.
create or replace function public.notify_chat_message_inbox()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid;
  v_preview text;
begin
  select thread.user_id into v_user_id
  from public.chat_threads thread
  where thread.id = new.thread_id;

  if v_user_id is null or new.sender_type = 'ai' then
    return new;
  end if;

  v_preview := coalesce(nullif(btrim(new.body), ''), 'Đã gửi một tệp đính kèm');

  if new.sender_type = 'specialist' then
    insert into public.notifications (user_id, type, title, body, related_chat_thread_id, destination, actor_name, actor_is_official)
    values (v_user_id, 'chat', 'Chuyên gia TheraHOME', left(v_preview, 240), new.thread_id, 'chat', 'Chuyên gia TheraHOME', true);
  elsif new.sender_type = 'user' then
    insert into public.notifications (user_id, type, title, body, related_chat_thread_id, destination, actor_id, actor_name, actor_avatar_url)
    select staff.claimed_by_user_id,
           'chat',
           'Tin nhắn hỗ trợ mới',
           left(v_preview, 240),
           new.thread_id,
           'chat',
           profile.id,
           coalesce(profile.full_name, profile.email, 'Người dùng TheraHOME'),
           profile.avatar_url
    from public.web_access_contacts staff
    join public.profiles profile on profile.id = v_user_id
    where staff.disabled = false
      and staff.claimed_by_user_id is not null
      and ('admin' = any(staff.roles) or 'cskh' = any(staff.roles));
  end if;

  return new;
end;
$$;

revoke all on function public.notify_chat_message_inbox() from public, anon, authenticated;

drop trigger if exists trg_notify_chat_message_inbox on public.chat_messages;
create trigger trg_notify_chat_message_inbox
after insert on public.chat_messages
for each row execute function public.notify_chat_message_inbox();

-- Social activity needs the actor's identity in the inbox so the mobile UI
-- can render a real avatar and an action badge like familiar social feeds.
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
    insert into public.notifications (user_id, type, title, body, related_post_id, destination, actor_id, actor_name, actor_avatar_url)
    values (v_post_author_id, 'comment', coalesce(new.author_name, 'Ai đó') || ' đã bình luận bài viết của bạn', left(new.text, 140), new.post_id, 'community_post', new.author_id, new.author_name, new.author_avatar_url);
  end if;

  if new.parent_comment_id is not null then
    select author_id into v_parent_author_id from public.post_comments where id = new.parent_comment_id;
    if v_parent_author_id is not null and v_parent_author_id <> new.author_id and v_parent_author_id <> v_post_author_id then
      insert into public.notifications (user_id, type, title, body, related_post_id, destination, actor_id, actor_name, actor_avatar_url)
      values (v_parent_author_id, 'reply', coalesce(new.author_name, 'Ai đó') || ' đã trả lời bình luận của bạn', left(new.text, 140), new.post_id, 'community_post', new.author_id, new.author_name, new.author_avatar_url);
    end if;
  end if;
  return new;
end;
$$;

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
begin
  select author_id into v_post_author_id from public.community_posts where id = new.post_id;
  if v_post_author_id is null or v_post_author_id = new.user_id then return new; end if;
  select full_name, avatar_url into v_name, v_avatar from public.profiles where id = new.user_id;
  insert into public.notifications (user_id, type, title, body, related_post_id, destination, actor_id, actor_name, actor_avatar_url)
  values (v_post_author_id, 'like', coalesce(v_name, 'Ai đó') || ' đã bày tỏ cảm xúc về bài viết của bạn', null, new.post_id, 'community_post', new.user_id, v_name, v_avatar);
  return new;
end;
$$;

-- Admin and CSKH can publish a branded TheraHOME post without receiving broad
-- write rights to ordinary community content. The existing pin RPC already
-- applies to both roles.
create or replace function public.create_official_community_post(p_tag text, p_text text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_post_id uuid;
begin
  if not (
    'admin' = any(public.current_web_roles())
    or 'cskh' = any(public.current_web_roles())
  ) then
    raise exception 'staff_required';
  end if;

  insert into public.community_posts (is_official, author_name, tag, text)
  values (true, 'TheraHOME', nullif(btrim(p_tag), ''), btrim(p_text))
  returning id into v_post_id;

  return v_post_id;
end;
$$;

revoke all on function public.create_official_community_post(text, text) from public, anon;
grant execute on function public.create_official_community_post(text, text) to authenticated;

-- The scheduled upsale UI chooses one of these destinations. Keeping this on
-- both campaign and inbox rows preserves the original choice after a campaign
-- is edited or deleted.
alter table public.upsell_campaigns
  add column if not exists destination text not null default 'store'
  check (destination in ('store', 'home', 'roadmap', 'community'));

alter table public.notifications
  drop constraint if exists notifications_destination_check;
alter table public.notifications
  add constraint notifications_destination_check
  check (destination is null or destination in ('store', 'home', 'roadmap', 'community', 'community_post', 'chat'));

-- Idempotent delivery keys let the inactivity worker run repeatedly without
-- ever showing the same 2/3/5/7-day reminder twice to one person.
alter table public.notifications add column if not exists system_key text;
create unique index if not exists notifications_user_system_key_unique
  on public.notifications (user_id, system_key)
  where system_key is not null;

create or replace function public.create_inactivity_notification(
  p_user_id uuid,
  p_inactive_days integer,
  p_title text,
  p_body text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_notification_id uuid;
begin
  insert into public.notifications (user_id, type, title, body, destination, system_key)
  values (
    p_user_id,
    'inactivity',
    p_title,
    p_body,
    'home',
    'inactivity-' || p_inactive_days::text
  )
  on conflict (user_id, system_key) where system_key is not null do nothing
  returning id into v_notification_id;

  return v_notification_id;
end;
$$;

revoke all on function public.create_inactivity_notification(uuid, integer, text, text) from public, anon, authenticated;

-- System messages are not manually sent by staff. This small CMS lets Admin
-- and CSKH adjust the copy used by the daily device reminders and the
-- inactivity worker without a code release. Chat/community remain realtime
-- events and therefore intentionally have no editable template.
create table if not exists public.system_notification_templates (
  template_key text primary key check (template_key in ('daily_workout', 'evening_reminder', 'inactive_2', 'inactive_3', 'inactive_5', 'inactive_7')),
  title text not null check (char_length(trim(title)) between 1 and 120),
  body text not null check (char_length(trim(body)) between 1 and 500),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);

insert into public.system_notification_templates (template_key, title, body)
values
  ('daily_workout', 'Đến giờ tập hôm nay', 'Ngày {{day}} đang chờ bạn'),
  ('evening_reminder', 'Một phút cho cơ thể', 'Dành ít phút thư giãn để khép lại ngày hôm nay nhé.'),
  ('inactive_2', 'TheraHOME nhớ bạn', 'Đã {{days}} ngày bạn chưa ghé lại. Dành vài phút nhẹ nhàng cho bản thân hôm nay nhé.'),
  ('inactive_3', 'TheraHOME nhớ bạn', 'Đã {{days}} ngày bạn chưa ghé lại. Dành vài phút nhẹ nhàng cho bản thân hôm nay nhé.'),
  ('inactive_5', 'TheraHOME nhớ bạn', 'Đã {{days}} ngày bạn chưa ghé lại. Dành vài phút nhẹ nhàng cho bản thân hôm nay nhé.'),
  ('inactive_7', 'TheraHOME nhớ bạn', 'Đã {{days}} ngày bạn chưa ghé lại. Dành vài phút nhẹ nhàng cho bản thân hôm nay nhé.')
on conflict (template_key) do nothing;

alter table public.system_notification_templates enable row level security;

drop policy if exists "authenticated read system notification templates" on public.system_notification_templates;
create policy "authenticated read system notification templates"
on public.system_notification_templates for select to authenticated
using (true);

drop policy if exists "staff manage system notification templates" on public.system_notification_templates;
create policy "staff manage system notification templates"
on public.system_notification_templates for all to authenticated
using ('admin' = any(public.current_web_roles()) or 'cskh' = any(public.current_web_roles()))
with check ('admin' = any(public.current_web_roles()) or 'cskh' = any(public.current_web_roles()));
