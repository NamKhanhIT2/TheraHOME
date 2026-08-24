-- Region-specific storefront catalog plus product images managed by Admin.
-- Existing products remain in the Vietnam catalog so no current storefront
-- entry changes unexpectedly after this migration.

alter table public.store_categories
  add column if not exists market text not null default 'VN';

alter table public.store_categories
  drop constraint if exists store_categories_market_check;

alter table public.store_categories
  add constraint store_categories_market_check
  check (market in ('VN', 'US', 'MALAY'));

alter table public.store_items
  add column if not exists image_url text,
  add column if not exists market text not null default 'VN';

alter table public.store_items
  drop constraint if exists store_items_market_check;

alter table public.store_items
  add constraint store_items_market_check
  check (market in ('VN', 'US', 'MALAY'));

create index if not exists store_items_market_sort_idx
  on public.store_items (market, category_id, sort_order);

create index if not exists store_categories_market_sort_idx
  on public.store_categories (market, sort_order);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'store-images',
  'store-images',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "public read store images" on storage.objects;
create policy "public read store images"
on storage.objects
for select
to public
using (bucket_id = 'store-images');

drop policy if exists "admin upload store images" on storage.objects;
create policy "admin upload store images"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'store-images'
  and 'admin' = any(public.current_web_roles())
);

drop policy if exists "admin update store images" on storage.objects;
create policy "admin update store images"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'store-images'
  and 'admin' = any(public.current_web_roles())
)
with check (
  bucket_id = 'store-images'
  and 'admin' = any(public.current_web_roles())
);

drop policy if exists "admin delete store images" on storage.objects;
create policy "admin delete store images"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'store-images'
  and 'admin' = any(public.current_web_roles())
);
