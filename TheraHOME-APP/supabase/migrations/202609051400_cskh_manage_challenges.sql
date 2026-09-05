-- Community management moves from Admin to CSKH (owner, 2026-09-05). The
-- Thử thách editor lives inside that same tab, but `challenges` only ever
-- granted writes — and drafts (active = false) reads — to admin, so moving
-- the tab without this would hand CSKH a screen that cannot load or save.
drop policy if exists "web admin manage challenges" on public.challenges;
create policy "web staff manage challenges" on public.challenges
  for all to authenticated
  using ('admin' = any(public.current_web_roles()) or 'cskh' = any(public.current_web_roles()))
  with check ('admin' = any(public.current_web_roles()) or 'cskh' = any(public.current_web_roles()));

drop policy if exists "public read active challenges" on public.challenges;
create policy "public read active challenges" on public.challenges
  for select
  using (
    active = true
    or 'admin' = any(public.current_web_roles())
    or 'cskh' = any(public.current_web_roles())
  );
