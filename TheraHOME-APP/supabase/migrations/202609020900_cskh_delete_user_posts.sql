-- CSKH can hard-delete USER community posts (2026-09-02, per explicit
-- request — the CSKH Community tab gains a delete action). Official
-- TheraHOME posts stay admin-only.
create policy "web cskh delete user posts"
  on public.community_posts for delete
  to authenticated
  using ('cskh' = any(public.current_web_roles()) and not is_official);
