-- Community posts/comments display a denormalized author_name/avatar
-- snapshot (profiles RLS hides other users' rows from clients). When a
-- user renamed their profile, OLD posts kept the OLD name — on their
-- community profile this looked like someone else's posts mixed in
-- (reported 2026-09-02). A trigger now retro-syncs the snapshots whenever
-- the profile's name/avatar changes, plus a one-time backfill.

create or replace function public.sync_author_snapshots()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.full_name is distinct from old.full_name
     or new.avatar_url is distinct from old.avatar_url then
    update public.community_posts
    set author_name = new.full_name, author_avatar_url = new.avatar_url
    where author_id = new.id;
    update public.post_comments
    set author_name = new.full_name, author_avatar_url = new.avatar_url
    where author_id = new.id;
  end if;
  return new;
end;
$$;
revoke execute on function public.sync_author_snapshots() from public, anon, authenticated;

drop trigger if exists z_sync_author_snapshots on public.profiles;
create trigger z_sync_author_snapshots
after update on public.profiles
for each row execute function public.sync_author_snapshots();

-- Backfill existing stale snapshots.
update public.community_posts cp
set author_name = p.full_name, author_avatar_url = p.avatar_url
from public.profiles p
where p.id = cp.author_id
  and (cp.author_name is distinct from p.full_name or cp.author_avatar_url is distinct from p.avatar_url);

update public.post_comments pc
set author_name = p.full_name, author_avatar_url = p.avatar_url
from public.profiles p
where p.id = pc.author_id
  and (pc.author_name is distinct from p.full_name or pc.author_avatar_url is distinct from p.avatar_url);
