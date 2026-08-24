-- Official TheraHOME posts have a staff-authored title/body and an explicit
-- notification choice. They are visible in the official channel, while only
-- the single pinned post is promoted into the mixed community feed.

alter table public.community_posts
  add column if not exists title text,
  add column if not exists notify_enabled boolean not null default false;

-- Older official posts only had a category and body. Give them a meaningful
-- fallback title so the Home screen can consistently show title + content.
update public.community_posts
set title = coalesce(nullif(btrim(tag), ''), 'Cập nhật từ TheraHOME')
where is_official = true
  and nullif(btrim(title), '') is null;

-- Keep historical data valid if a previous version accidentally allowed more
-- than one official post to be pinned.
with newest_pinned as (
  select id
  from public.community_posts
  where is_official = true and pinned = true
  order by created_at desc
  limit 1
)
update public.community_posts
set pinned = false
where is_official = true
  and pinned = true
  and id not in (select id from newest_pinned);

create or replace function public.notify_official_post_inbox()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Publishing and notifying are separate choices. A normal TheraHOME post
  -- stays in the official tab without adding inbox rows or a push alert.
  if not new.is_official or not new.notify_enabled then
    return new;
  end if;

  insert into public.notifications (user_id, type, title, body, related_post_id, destination, actor_name, actor_is_official)
  select profile.id,
         'blog',
         coalesce(nullif(btrim(new.title), ''), 'Bài viết mới từ TheraHOME'),
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

drop function if exists public.create_official_community_post(text, text);
create function public.create_official_community_post(p_title text, p_text text, p_notify boolean default false)
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

  if nullif(btrim(p_title), '') is null or nullif(btrim(p_text), '') is null then
    raise exception 'title_and_content_required';
  end if;

  insert into public.community_posts (is_official, author_name, title, text, notify_enabled)
  values (true, 'TheraHOME', btrim(p_title), btrim(p_text), coalesce(p_notify, false))
  returning id into v_post_id;
  return v_post_id;
end;
$$;

revoke all on function public.create_official_community_post(text, text, boolean) from public, anon;
grant execute on function public.create_official_community_post(text, text, boolean) to authenticated;

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

  if p_pinned then
    update public.community_posts set pinned = false where is_official = true and pinned = true;
  end if;

  update public.community_posts
  set pinned = p_pinned
  where id = p_post_id and is_official = true;

  if not found then
    raise exception 'official_post_not_found';
  end if;
end;
$$;
