-- Community social/UGC upgrade: rich post reactions, per-user hide/block,
-- public-safe community profiles and a small server-side content filter.

alter table public.post_likes
  add column if not exists reaction text not null default 'heart';

alter table public.post_likes drop constraint if exists post_likes_reaction_check;
alter table public.post_likes add constraint post_likes_reaction_check
  check (reaction in ('heart', 'like', 'haha', 'celebrate', 'support'));

drop policy if exists "users update own post reactions" on public.post_likes;
create policy "users update own post reactions"
on public.post_likes for update to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

create table if not exists public.hidden_community_posts (
  user_id uuid not null references auth.users(id) on delete cascade,
  post_id uuid not null references public.community_posts(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, post_id)
);

alter table public.hidden_community_posts enable row level security;
grant select, insert, delete on public.hidden_community_posts to authenticated;
drop policy if exists "users manage own hidden posts" on public.hidden_community_posts;
create policy "users manage own hidden posts"
on public.hidden_community_posts for all to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

create table if not exists public.blocked_community_users (
  blocker_id uuid not null references auth.users(id) on delete cascade,
  blocked_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);

alter table public.blocked_community_users enable row level security;
grant select, insert, delete on public.blocked_community_users to authenticated;
drop policy if exists "users manage own community blocks" on public.blocked_community_users;
create policy "users manage own community blocks"
on public.blocked_community_users for all to authenticated
using (blocker_id = (select auth.uid()))
with check (blocker_id = (select auth.uid()));

create or replace function public.get_community_profile(p_user_id uuid)
returns table (
  user_id uuid,
  full_name text,
  avatar_url text,
  current_streak integer,
  completed_programs integer,
  posts_count integer,
  completed_days integer
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    profile.id,
    coalesce(profile.full_name, 'Thành viên TheraHOME'),
    profile.avatar_url,
    coalesce((select max(program.streak) from public.user_programs program where program.user_id = profile.id), 0)::integer,
    coalesce((select count(*) from public.user_programs program where program.user_id = profile.id and program.adherence_pct >= 100), 0)::integer,
    coalesce((select count(*) from public.community_posts post where post.author_id = profile.id and not post.hidden), 0)::integer,
    coalesce((
      select count(*)
      from public.user_program_days user_day
      join public.user_programs program on program.id = user_day.user_program_id
      where program.user_id = profile.id and user_day.status = 'done'
    ), 0)::integer
  from public.profiles profile
  where profile.id = p_user_id and profile.deleted_at is null and not profile.locked;
$$;

revoke all on function public.get_community_profile(uuid) from public, anon;
grant execute on function public.get_community_profile(uuid) to authenticated;

create or replace function public.contains_unsafe_community_content(p_text text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select lower(coalesce(p_text, '')) ~ '(địt|đụ|cặc|lồn|lừa[[:space:]]*đảo|giết[[:space:]]*người)';
$$;

create or replace function public.filter_unsafe_community_content()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if public.contains_unsafe_community_content(new.text) then
    raise exception using errcode = 'P0001', message = 'unsafe_community_content';
  end if;
  return new;
end;
$$;

revoke all on function public.filter_unsafe_community_content() from public, anon, authenticated;

drop trigger if exists trg_filter_community_post on public.community_posts;
create trigger trg_filter_community_post
before insert or update of text on public.community_posts
for each row execute function public.filter_unsafe_community_content();

drop trigger if exists trg_filter_community_comment on public.post_comments;
create trigger trg_filter_community_comment
before insert or update of text on public.post_comments
for each row execute function public.filter_unsafe_community_content();

-- Keep the existing notification type (`like`) for client compatibility,
-- while using wording that covers every supported reaction.
create or replace function public.notify_post_like_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_post_author_id uuid;
  v_reactor_name text;
begin
  select author_id into v_post_author_id from public.community_posts where id = new.post_id;
  if v_post_author_id is null or v_post_author_id = new.user_id then
    return new;
  end if;

  select full_name into v_reactor_name from public.profiles where id = new.user_id;
  insert into public.notifications (user_id, type, title, body, related_post_id)
  values (
    v_post_author_id,
    'like',
    coalesce(v_reactor_name, 'Ai đó') || ' đã bày tỏ cảm xúc về bài viết của bạn',
    null,
    new.post_id
  );
  return new;
end;
$$;

revoke all on function public.notify_post_like_event() from public, anon, authenticated;

-- Both Admin and CSKH may only pin/unpin official TheraHOME posts. Keeping
-- this as an RPC prevents a CSKH session from changing post text or status.
create or replace function public.set_official_post_pinned(p_post_id uuid, p_pinned boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not (
    'admin' = any(public.current_web_roles())
    or 'cskh' = any(public.current_web_roles())
  ) then
    raise exception 'staff_required';
  end if;

  update public.community_posts
  set pinned = p_pinned
  where id = p_post_id and is_official = true;

  if not found then
    raise exception 'official_post_not_found';
  end if;
end;
$$;

revoke all on function public.set_official_post_pinned(uuid, boolean) from public, anon;
grant execute on function public.set_official_post_pinned(uuid, boolean) to authenticated;

create index if not exists post_likes_post_reaction_idx on public.post_likes(post_id, reaction);
create index if not exists blocked_community_users_blocker_idx on public.blocked_community_users(blocker_id);
