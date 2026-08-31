-- CSKH/Admin approval gate for member community posts: new posts start
-- 'pending' and are invisible to everyone except the author and staff until
-- approved. Official/staff posts go live immediately.

alter table public.community_posts
  add column if not exists status text not null default 'pending'
    constraint community_posts_status_check check (status in ('pending','approved','rejected'));

-- Everything that existed before moderation shipped stays visible.
update public.community_posts set status = 'approved';

create index if not exists community_posts_pending_idx
  on public.community_posts (created_at desc) where status = 'pending';

-- Server-side initial status — clients can't self-approve by sending
-- status in the insert payload.
create or replace function public.set_post_moderation_status()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.is_official
     or 'admin' = any (current_web_roles())
     or 'cskh' = any (current_web_roles()) then
    new.status := 'approved';
  else
    new.status := 'pending';
  end if;
  return new;
end $$;

drop trigger if exists trg_post_moderation_status on public.community_posts;
create trigger trg_post_moderation_status
  before insert on public.community_posts
  for each row execute function public.set_post_moderation_status();

-- Members only see approved+unhidden posts; authors always see their own;
-- staff see everything (unchanged from the previous policy's staff arm).
drop policy "public read posts" on public.community_posts;
create policy "public read posts" on public.community_posts for select using (
  ((not hidden) and status = 'approved')
  or author_id = (select auth.uid())
  or 'admin' = any (current_web_roles())
  or 'cskh' = any (current_web_roles())
);

-- CSKH could not update posts at all before (hide/approve was admin-only).
drop policy if exists "web cskh update any post" on public.community_posts;
create policy "web cskh update any post" on public.community_posts for update
  using ('cskh' = any (current_web_roles()))
  with check ('cskh' = any (current_web_roles()));

-- Tell the author when their post is approved/rejected.
alter table public.notifications drop constraint notifications_type_check;
alter table public.notifications add constraint notifications_type_check
  check (type = any (array['schedule','ad','blog','chat','streak_milestone','inactivity',
    'post_reaction','post_comment','comment_reply','comment_reaction','post_moderation']::text[]));

create or replace function public.notify_post_moderation()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if old.status = 'pending' and new.status in ('approved','rejected') and not new.is_official then
    if new.status = 'approved' then
      insert into notifications (user_id, type, title, body, destination, related_post_id, push_title, push_body)
      values (new.author_id, 'post_moderation',
        'Bài viết đã được duyệt',
        'Bài viết của bạn đã được duyệt và hiển thị với cộng đồng.',
        'community_post', new.id,
        'Bài viết đã được duyệt', 'Bài viết của bạn đã hiển thị với cộng đồng.');
    else
      insert into notifications (user_id, type, title, body, destination, push_title, push_body)
      values (new.author_id, 'post_moderation',
        'Bài viết chưa được duyệt',
        'Bài viết của bạn chưa phù hợp để hiển thị với cộng đồng. Bạn có thể chỉnh sửa và đăng lại.',
        'community',
        'Bài viết chưa được duyệt', 'Bài viết của bạn chưa phù hợp để hiển thị.');
    end if;
  end if;
  return new;
end $$;

drop trigger if exists trg_notify_post_moderation on public.community_posts;
create trigger trg_notify_post_moderation
  after update of status on public.community_posts
  for each row execute function public.notify_post_moderation();

-- (applied separately as revoke_moderation_trigger_fn_execute)
-- Trigger functions are invoked internally by Postgres; they never need to
-- be callable through PostgREST RPC.
revoke execute on function public.set_post_moderation_status() from public, anon, authenticated;
revoke execute on function public.notify_post_moderation() from public, anon, authenticated;
