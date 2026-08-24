-- Follow-up for installations that already applied the initial community
-- social upgrade: replace the lightbulb reaction with Haha and provide the
-- narrowly-scoped official-post pin RPC for Admin/CSKH.

update public.post_likes
set reaction = 'haha'
where reaction = 'insightful';

alter table public.post_likes drop constraint if exists post_likes_reaction_check;
alter table public.post_likes add constraint post_likes_reaction_check
  check (reaction in ('heart', 'like', 'haha', 'celebrate', 'support'));

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
