-- Admin-editable app content that used to be hardcoded in the mobile bundle
-- (per explicit request 2026-09-04). Changing the support hotline or the
-- Home "Hướng dẫn nhanh" video meant editing code + a store release; now
-- WEB Admin owns them and every install picks the change up immediately.
--
-- Shape: one row per setting, with an optional EN/MS override (mobile falls
-- back to `value_vi`, then to its own built-in default when the row is
-- missing entirely — so the app never breaks if a row is deleted).
create table if not exists public.app_config (
  key text primary key,
  value_vi text,
  value_en text,
  value_ms text,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id)
);

alter table public.app_config enable row level security;

-- Every signed-in app user reads this (it drives visible UI); only web
-- admin/cskh may write.
create policy "authenticated read app_config" on public.app_config
  for select to authenticated using (true);

create policy "web staff write app_config" on public.app_config
  for all to authenticated
  using ('admin' = any(public.current_web_roles()) or 'cskh' = any(public.current_web_roles()))
  with check ('admin' = any(public.current_web_roles()) or 'cskh' = any(public.current_web_roles()));

-- Seed with exactly what the app currently hardcodes, so nothing changes
-- for users until an admin edits a value.
insert into public.app_config (key, value_vi, value_en, value_ms) values
  ('support_hotline',       '19001234',      null, null),
  ('support_hotline_label', '1900 1234 · 8:00–21:00', '1900 1234 · 8:00–21:00 (GMT+7)', '1900 1234 · 8:00–21:00 (GMT+7)'),
  ('support_email',         'support@therahomeai.com', null, null),
  ('home_intro_video_url',  'https://www.youtube.com/watch?v=DHuAzpoV0XQ', null, null)
on conflict (key) do nothing;
