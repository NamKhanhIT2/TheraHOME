-- Phase 1 of the Community expansion: reports/moderation, social-event
-- notifications, streak-milestone notification, minimal anti-spam, and the
-- indexes load-more pagination will need later. Mirrors the style
-- established by 202608190001_rich_chat_and_push.sql (separate read/insert
-- policies, SECURITY DEFINER trigger functions with search_path='').

-- ---------------------------------------------------------------------
-- content_reports: one table for both post and comment reports.
-- ---------------------------------------------------------------------
create table if not exists public.content_reports (
  id uuid primary key default gen_random_uuid(),
  content_type text not null check (content_type in ('post', 'comment')),
  content_id uuid not null,
  reporter_id uuid not null references auth.users(id) on delete cascade,
  reason text not null,
  note text,
  status text not null default 'pending' check (status in ('pending', 'resolved', 'dismissed')),
  created_at timestamptz not null default now(),
  resolved_by uuid references auth.users(id) on delete set null,
  resolved_at timestamptz
);

alter table public.content_reports enable row level security;

drop policy if exists "users insert own reports" on public.content_reports;
create policy "users insert own reports"
on public.content_reports for insert to authenticated
with check (reporter_id = (select auth.uid()));

drop policy if exists "web admin cskh read reports" on public.content_reports;
create policy "web admin cskh read reports"
on public.content_reports for select to authenticated
using ('admin' = any(public.current_web_roles()) or 'cskh' = any(public.current_web_roles()));

drop policy if exists "web admin cskh update reports" on public.content_reports;
create policy "web admin cskh update reports"
on public.content_reports for update to authenticated
using ('admin' = any(public.current_web_roles()) or 'cskh' = any(public.current_web_roles()))
with check ('admin' = any(public.current_web_roles()) or 'cskh' = any(public.current_web_roles()));

create index if not exists content_reports_status_idx on public.content_reports(status, created_at desc);

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'content_reports'
  ) then
    alter publication supabase_realtime add table public.content_reports;
  end if;
end $$;

-- ---------------------------------------------------------------------
-- Soft moderation: hidden posts/comments stay visible to their author and
-- staff, invisible to everyone else. Self-delete (hard) is unchanged.
-- ---------------------------------------------------------------------
alter table public.community_posts add column if not exists hidden boolean not null default false;
alter table public.post_comments add column if not exists hidden boolean not null default false;

alter policy "public read posts" on public.community_posts
using (
  not hidden
  or author_id = (select auth.uid())
  or 'admin' = any(public.current_web_roles())
  or 'cskh' = any(public.current_web_roles())
);

alter policy "public read comments" on public.post_comments
using (
  not hidden
  or author_id = (select auth.uid())
  or 'admin' = any(public.current_web_roles())
  or 'cskh' = any(public.current_web_roles())
);

-- post_comments had no UPDATE policy at all before this (comments were
-- insert/delete only) — needed so Admin can set hidden=true.
drop policy if exists "web admin update any comment" on public.post_comments;
create policy "web admin update any comment"
on public.post_comments for update to authenticated
using ('admin' = any(public.current_web_roles()))
with check ('admin' = any(public.current_web_roles()));

-- ---------------------------------------------------------------------
-- Minimal anti-spam: >5 posts or comments from the same author in 10
-- minutes is rejected. NULL author_id (official posts, inserted by an
-- admin web session) is naturally exempt since NULL never equals NULL.
-- ---------------------------------------------------------------------
create or replace function public.enforce_content_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_recent_count integer;
begin
  if tg_table_name = 'community_posts' then
    select count(*) into v_recent_count
    from public.community_posts
    where author_id = new.author_id and created_at > now() - interval '10 minutes';
  else
    select count(*) into v_recent_count
    from public.post_comments
    where author_id = new.author_id and created_at > now() - interval '10 minutes';
  end if;

  if v_recent_count >= 5 then
    raise exception using errcode = 'P0001', message = 'rate_limited';
  end if;

  return new;
end;
$$;

revoke all on function public.enforce_content_rate_limit() from public, anon, authenticated;

drop trigger if exists trg_community_posts_rate_limit on public.community_posts;
create trigger trg_community_posts_rate_limit
before insert on public.community_posts
for each row execute function public.enforce_content_rate_limit();

drop trigger if exists trg_post_comments_rate_limit on public.post_comments;
create trigger trg_post_comments_rate_limit
before insert on public.post_comments
for each row execute function public.enforce_content_rate_limit();

-- ---------------------------------------------------------------------
-- Notifications on social events (comment/reply/like) — deep-link target.
-- ---------------------------------------------------------------------
alter table public.notifications add column if not exists related_post_id uuid references public.community_posts(id) on delete cascade;

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
    insert into public.notifications (user_id, type, title, body, related_post_id)
    values (
      v_post_author_id,
      'comment',
      coalesce(new.author_name, 'Ai đó') || ' đã bình luận bài viết của bạn',
      left(new.text, 140),
      new.post_id
    );
  end if;

  if new.parent_comment_id is not null then
    select author_id into v_parent_author_id from public.post_comments where id = new.parent_comment_id;

    if v_parent_author_id is not null
       and v_parent_author_id <> new.author_id
       and v_parent_author_id <> v_post_author_id
    then
      insert into public.notifications (user_id, type, title, body, related_post_id)
      values (
        v_parent_author_id,
        'reply',
        coalesce(new.author_name, 'Ai đó') || ' đã trả lời bình luận của bạn',
        left(new.text, 140),
        new.post_id
      );
    end if;
  end if;

  return new;
end;
$$;

revoke all on function public.notify_post_comment_event() from public, anon, authenticated;

drop trigger if exists trg_notify_post_comment on public.post_comments;
create trigger trg_notify_post_comment
after insert on public.post_comments
for each row execute function public.notify_post_comment_event();

create or replace function public.notify_post_like_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_post_author_id uuid;
  v_liker_name text;
begin
  select author_id into v_post_author_id from public.community_posts where id = new.post_id;
  if v_post_author_id is null or v_post_author_id = new.user_id then
    return new;
  end if;

  select full_name into v_liker_name from public.profiles where id = new.user_id;

  insert into public.notifications (user_id, type, title, body, related_post_id)
  values (
    v_post_author_id,
    'like',
    coalesce(v_liker_name, 'Ai đó') || ' đã thích bài viết của bạn',
    null,
    new.post_id
  );

  return new;
end;
$$;

revoke all on function public.notify_post_like_event() from public, anon, authenticated;

drop trigger if exists trg_notify_post_like on public.post_likes;
create trigger trg_notify_post_like
after insert on public.post_likes
for each row execute function public.notify_post_like_event();

-- ---------------------------------------------------------------------
-- Streak-milestone notification, folded into the existing complete_day RPC
-- rather than a new function/trigger.
-- ---------------------------------------------------------------------
create or replace function public.complete_day(p_user_program_id uuid, p_program_day_id uuid, p_pain_score integer)
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_program user_programs%rowtype;
  v_day_number integer;
  v_next_user_program_day_id uuid;
  v_next_program_day_id uuid;
  v_next_day_number integer;
  v_done_count integer;
  v_total_days integer;
  v_new_streak integer;
begin
  select * into v_program from user_programs where id = p_user_program_id and user_id = auth.uid();
  if not found then
    raise exception 'not_authorized';
  end if;

  insert into pain_logs (user_id, user_program_id, program_day_id, score)
  values (auth.uid(), p_user_program_id, p_program_day_id, p_pain_score);

  update user_program_days set status = 'done', completed_at = now()
  where user_program_id = p_user_program_id and program_day_id = p_program_day_id;

  select day_number into v_day_number from program_days where id = p_program_day_id;

  select upd.id, pd.id, pd.day_number
  into v_next_user_program_day_id, v_next_program_day_id, v_next_day_number
  from user_program_days upd
  join program_days pd on pd.id = upd.program_day_id
  where upd.user_program_id = p_user_program_id and pd.day_number = v_day_number + 1;

  if v_next_user_program_day_id is not null then
    update user_program_days set status = 'current' where id = v_next_user_program_day_id;

    insert into notifications (user_id, type, title, body, related_day_id, related_product_id)
    values (
      auth.uid(),
      'schedule',
      'Đến giờ tập hôm nay',
      'Ngày ' || v_next_day_number || ' đang chờ bạn',
      v_next_program_day_id,
      v_program.product_id
    );
  end if;

  select count(*) filter (where status = 'done'), count(*) into v_done_count, v_total_days
  from user_program_days where user_program_id = p_user_program_id;

  select total_days into v_total_days from products where id = v_program.product_id;

  update user_programs
  set current_day = least(v_day_number + 1, v_total_days),
      adherence_pct = round(v_done_count::numeric / greatest(v_day_number, 1) * 100),
      streak = streak + 1
  where id = p_user_program_id
  returning streak into v_new_streak;

  if v_new_streak = any(array[7, 14, 21, 28]) then
    insert into notifications (user_id, type, title, body)
    values (
      auth.uid(),
      'streak_milestone',
      'Chuỗi ' || v_new_streak || ' ngày liên tiếp! 🔥',
      'Bạn đã duy trì lộ trình ' || v_new_streak || ' ngày. Chia sẻ thành tích với cộng đồng?'
    );
  end if;
end;
$function$;

-- ---------------------------------------------------------------------
-- Indexes for Phase 4's load-more pagination.
-- ---------------------------------------------------------------------
create index if not exists post_comments_post_created_idx on public.post_comments(post_id, created_at);
create index if not exists community_posts_created_idx on public.community_posts(created_at desc);
