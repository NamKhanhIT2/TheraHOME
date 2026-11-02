-- Store discounts are now per market item, not a global client constant.
-- Admin edits this field with the rest of the catalog, and place-app-order
-- reads the same server row so the amount shown and the amount submitted
-- cannot drift apart.
alter table public.store_items
  add column if not exists discount_percent smallint not null default 10;

alter table public.store_items
  drop constraint if exists store_items_discount_percent_check;

alter table public.store_items
  add constraint store_items_discount_percent_check
  check (discount_percent between 0 and 100);

comment on column public.store_items.discount_percent is
  'Member discount shown in TheraHOME and enforced by place-app-order.';

-- VN copy and list prices requested for the compact Store redesign.
update public.store_items
set name = 'Combo Phục hồi toàn diện',
    description = '',
    price_text = '2.490.000đ',
    preview_url = null,
    discount_percent = 50
where id = 'item-1789442043284-vn';

update public.store_items
set name = 'Máy trị liệu cổ TheraNECK+',
    description = '',
    price_text = '1.690.000đ',
    preview_url = null,
    discount_percent = 50
where id = 'neck-plus';

update public.store_items
set price_text = '720.000đ',
    discount_percent = 10
where id = 'item-1789440963558-vn';

insert into public.store_items (
  id,
  group_key,
  category_id,
  product_id,
  name,
  description,
  price_text,
  accent_color_key,
  external_link,
  preview_url,
  image_url,
  market,
  sort_order,
  discount_percent
)
values (
  'vinh-gia-heat-patch-vn',
  'vinh-gia-heat-patch',
  'group-1789440848599-vn',
  null,
  'Miếng dán nóng Cơ Khớp Vinh Gia . Gel',
  'Hộp 10 miếng, hỗ trợ giảm đau cơ, xương khớp, vùng cổ vai gáy và 1 lọ Gel',
  '220.000đ',
  'primary',
  null,
  null,
  null,
  'VN',
  1,
  10
)
on conflict (id) do update set
  category_id = excluded.category_id,
  name = excluded.name,
  description = excluded.description,
  price_text = excluded.price_text,
  preview_url = null,
  market = excluded.market,
  sort_order = excluded.sort_order,
  discount_percent = excluded.discount_percent;
