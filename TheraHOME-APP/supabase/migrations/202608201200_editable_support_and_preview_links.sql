-- Admin-managed outbound links consumed by the mobile app.
-- Each program day can point to its own training-support equipment, and each
-- storefront item can expose an independent "Xem thử" video/link.

alter table public.program_days
  add column if not exists support_tools_url text;

alter table public.store_items
  add column if not exists preview_url text;
