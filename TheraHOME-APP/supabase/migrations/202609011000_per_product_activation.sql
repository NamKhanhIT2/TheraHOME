-- Per-product activation managed by CSKH (2026-09-01, per explicit request).
--
-- Replaces the "one claimed contact unlocks the whole catalog" model from
-- 202608180001_unique_contact_catalog_access.sql with:
--   * `product_activation_contacts` — CSKH manually lists phone/email per
--     product (WEB Admin/CSKH "Kích hoạt" tab). A user's entered contact is
--     matched against THIS table (no longer against `orders`), and unlocks
--     only the products it is listed for.
--   * `store_categories.is_primary` — "nhóm sản phẩm chính" flag; items in
--     primary groups are the devices the mobile Roadmap dropdown lists.
--   * `activate_product_by_contact(product, contact)` — per-product unlock
--     from the Roadmap for a device registered under a different contact.
-- The one-contact-per-account gate (`user_access_contacts`) stays: the
-- FIRST contact a user enters still binds to the account and unlocks every
-- product CSKH listed that contact for. Existing users keep the programs
-- they already have (backfilled as claimed rows below).

-- 1. Primary/secondary product groups ---------------------------------------

alter table public.store_categories
  add column if not exists is_primary boolean not null default false;

-- Seed: groups whose items link to routine products are the device groups.
update public.store_categories c
set is_primary = true
where exists (
  select 1 from public.store_items i
  where i.category_id = c.id and i.product_id is not null
);

-- Keep the flag consistent across a group's 3 market rows.
update public.store_categories c
set is_primary = true
where is_primary = false
  and exists (
    select 1 from public.store_categories c2
    where c2.group_key = c.group_key and c2.is_primary
  );

-- 2. CSKH-managed activation list -------------------------------------------

create table if not exists public.product_activation_contacts (
  id uuid primary key default gen_random_uuid(),
  product_id text not null references public.products(id) on delete cascade,
  contact_type text not null check (contact_type in ('email', 'phone')),
  contact_value text not null,
  normalized_value text not null,
  claimed_by_user_id uuid references auth.users(id) on delete set null,
  claimed_at timestamptz,
  disabled boolean not null default false,
  note text,
  created_at timestamptz not null default now(),
  constraint product_activation_contacts_product_contact_key
    unique (product_id, normalized_value)
);

alter table public.product_activation_contacts enable row level security;

drop policy if exists "web staff manage product activation contacts"
  on public.product_activation_contacts;
create policy "web staff manage product activation contacts"
  on public.product_activation_contacts for all
  to authenticated
  using (
    'admin' = any(public.current_web_roles())
    or 'cskh' = any(public.current_web_roles())
  )
  with check (
    'admin' = any(public.current_web_roles())
    or 'cskh' = any(public.current_web_roles())
  );

grant select, insert, update, delete on public.product_activation_contacts to authenticated;

-- Normalize on write so the web client can insert just contact_value —
-- same email/phone rules as claim_user_access_contact.
create or replace function public.normalize_product_activation_contact()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_value text := btrim(coalesce(new.contact_value, ''));
begin
  if position('@' in v_value) > 0 then
    new.contact_type := 'email';
    new.normalized_value := lower(v_value);
    if new.normalized_value !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
      raise exception using errcode = '22023', message = 'invalid_contact';
    end if;
  else
    new.contact_type := 'phone';
    new.normalized_value := public.normalize_phone_vn(v_value);
    if new.normalized_value !~ '^0[0-9]{9,10}$' then
      raise exception using errcode = '22023', message = 'invalid_contact';
    end if;
  end if;
  new.contact_value := v_value;
  return new;
end;
$$;

drop trigger if exists a_normalize_product_activation_contact
  on public.product_activation_contacts;
create trigger a_normalize_product_activation_contact
before insert or update on public.product_activation_contacts
for each row execute function public.normalize_product_activation_contact();

-- Shared provisioning helper (internal — called by the RPCs/triggers below).
create or replace function public.provision_product_for_user(p_user_id uuid, p_product_id text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.user_programs (user_id, product_id, order_id)
  values (p_user_id, p_product_id, null)
  on conflict (user_id, product_id) do nothing;

  insert into public.user_program_days (user_program_id, program_day_id, status)
  select up.id,
         pd.id,
         case when pd.day_number = 1 then 'current' else 'locked' end
  from public.user_programs up
  join public.program_days pd on pd.product_id = up.product_id
  where up.user_id = p_user_id and up.product_id = p_product_id
  on conflict (user_program_id, program_day_id) do nothing;
end;
$$;

revoke all on function public.provision_product_for_user(uuid, text) from public, anon, authenticated;

-- CSKH adding a contact that some account has ALREADY claimed as its access
-- contact unlocks that product for that account immediately — the user does
-- not need to re-enter anything.
create or replace function public.auto_claim_product_activation_contact()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid;
begin
  if new.disabled then
    return new;
  end if;

  select user_id into v_user_id
  from public.user_access_contacts
  where normalized_value = new.normalized_value;

  if v_user_id is null then
    return new;
  end if;

  update public.product_activation_contacts
  set claimed_by_user_id = v_user_id, claimed_at = now()
  where id = new.id and claimed_by_user_id is null;

  perform public.provision_product_for_user(v_user_id, new.product_id);
  return new;
end;
$$;

drop trigger if exists b_auto_claim_product_activation_contact
  on public.product_activation_contacts;
create trigger b_auto_claim_product_activation_contact
after insert on public.product_activation_contacts
for each row execute function public.auto_claim_product_activation_contact();

-- 3. Backfill: existing app users keep what they already have --------------
-- Every non-staff account that claimed a contact under the old model was
-- provisioned for the whole catalog; record those as claimed activation
-- rows so the Kích hoạt tab reflects reality and re-claims stay idempotent.

insert into public.product_activation_contacts
  (product_id, contact_type, contact_value, normalized_value, claimed_by_user_id, claimed_at, note)
select up.product_id, c.contact_type, c.contact_value, c.normalized_value, c.user_id, now(),
       'backfill 2026-09-01 (quyền cũ: mở toàn bộ)'
from public.user_access_contacts c
join public.user_programs up on up.user_id = c.user_id
where not exists (
  select 1 from public.web_access_contacts w
  where w.claimed_by_user_id = c.user_id
)
on conflict (product_id, normalized_value) do nothing;

-- 4. claim_user_access_contact: match against the CSKH list -----------------
-- Same signature and error identifiers as before (older app builds in the
-- field keep working); only the eligibility source and the provisioning
-- scope change. Staff contacts (web_access_contacts) still bypass the check
-- and still get the full catalog.

create or replace function public.claim_user_access_contact(p_contact text)
returns table (
  contact_type text,
  contact_value text,
  programs_granted integer,
  access_roles text[]
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_value text := btrim(coalesce(p_contact, ''));
  v_type text;
  v_normalized text;
  v_existing public.user_access_contacts%rowtype;
  v_programs_granted integer;
  v_staff_id uuid;
  v_staff_owner uuid;
  v_roles text[] := array[]::text[];
  v_is_staff boolean := false;
  v_pac record;
begin
  if v_user_id is null then
    raise exception using errcode = '42501', message = 'authentication_required';
  end if;

  if position('@' in v_value) > 0 then
    v_type := 'email';
    v_normalized := lower(v_value);
    if v_normalized !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
      raise exception using errcode = '22023', message = 'invalid_contact';
    end if;
  else
    v_type := 'phone';
    v_normalized := public.normalize_phone_vn(v_value);
    if v_normalized !~ '^0[0-9]{9,10}$' then
      raise exception using errcode = '22023', message = 'invalid_contact';
    end if;
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_user_id::text, 0));
  perform pg_advisory_xact_lock(hashtextextended(v_normalized, 1));

  select staff.id, staff.claimed_by_user_id, staff.roles
  into v_staff_id, v_staff_owner, v_roles
  from public.web_access_contacts staff
  where staff.disabled = false
    and (
      (v_type = 'email' and staff.email is not null and lower(btrim(staff.email)) = v_normalized)
      or (v_type = 'phone' and staff.phone is not null and public.normalize_phone_vn(staff.phone) = v_normalized)
    )
  limit 1
  for update;

  v_is_staff := found;

  if v_is_staff and v_staff_owner is not null and v_staff_owner <> v_user_id then
    raise exception using errcode = '23505', message = 'contact_already_claimed';
  end if;

  if v_is_staff and exists (
    select 1
    from public.web_access_contacts staff
    where staff.claimed_by_user_id = v_user_id
      and staff.id <> v_staff_id
  ) then
    raise exception using errcode = '23505', message = 'account_already_has_contact';
  end if;

  -- Ordinary users must be listed by CSKH for at least one product.
  -- Error id kept as 'order_contact_not_found' for app-build compatibility.
  if not v_is_staff and not exists (
    select 1
    from public.product_activation_contacts pac
    where pac.disabled = false
      and pac.normalized_value = v_normalized
  ) then
    raise exception using errcode = 'P0001', message = 'order_contact_not_found';
  end if;

  select * into v_existing
  from public.user_access_contacts
  where normalized_value = v_normalized
  for update;

  if found and v_existing.user_id <> v_user_id then
    raise exception using errcode = '23505', message = 'contact_already_claimed';
  end if;

  select * into v_existing
  from public.user_access_contacts
  where user_id = v_user_id
  for update;

  if found and v_existing.normalized_value <> v_normalized then
    raise exception using errcode = '23505', message = 'account_already_has_contact';
  end if;

  if v_is_staff and v_staff_owner is null then
    update public.web_access_contacts
    set claimed_by_user_id = v_user_id
    where id = v_staff_id;
  end if;

  insert into public.user_access_contacts (
    user_id, contact_type, contact_value, normalized_value
  ) values (
    v_user_id, v_type, v_value, v_normalized
  )
  on conflict (user_id) do update
    set contact_value = excluded.contact_value,
        updated_at = now();

  if v_type = 'phone' then
    update public.profiles
    set phone = v_normalized, updated_at = now()
    where id = v_user_id;
  end if;

  if v_is_staff then
    -- Staff keep full-catalog provisioning.
    insert into public.user_programs (user_id, product_id, order_id)
    select v_user_id, p.id, null
    from public.products p
    on conflict (user_id, product_id) do nothing;

    insert into public.user_program_days (user_program_id, program_day_id, status)
    select up.id,
           pd.id,
           case when pd.day_number = 1 then 'current' else 'locked' end
    from public.user_programs up
    join public.program_days pd on pd.product_id = up.product_id
    where up.user_id = v_user_id
    on conflict (user_program_id, program_day_id) do nothing;
  else
    -- Claim every product CSKH listed this contact for (rows already
    -- claimed by another account are left alone) and provision only those.
    for v_pac in
      select pac.id, pac.product_id
      from public.product_activation_contacts pac
      where pac.disabled = false
        and pac.normalized_value = v_normalized
        and (pac.claimed_by_user_id is null or pac.claimed_by_user_id = v_user_id)
      for update
    loop
      update public.product_activation_contacts
      set claimed_by_user_id = v_user_id,
          claimed_at = coalesce(claimed_at, now())
      where id = v_pac.id;

      perform public.provision_product_for_user(v_user_id, v_pac.product_id);
    end loop;
  end if;

  select count(*)::integer into v_programs_granted
  from public.user_programs
  where user_id = v_user_id;

  return query select v_type, v_value, v_programs_granted, v_roles;
end;
$$;

revoke all on function public.claim_user_access_contact(text) from public, anon;
grant execute on function public.claim_user_access_contact(text) to authenticated;

-- 5. Per-product unlock from the Roadmap ------------------------------------
-- For a device CSKH registered under a DIFFERENT contact than the one this
-- account claimed as its access contact. Unlocks exactly one product.

create or replace function public.activate_product_by_contact(p_product_id text, p_contact text)
returns table (product_id text, product_name text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_value text := btrim(coalesce(p_contact, ''));
  v_type text;
  v_normalized text;
  v_row public.product_activation_contacts%rowtype;
  v_global_owner uuid;
begin
  if v_user_id is null then
    raise exception using errcode = '42501', message = 'authentication_required';
  end if;

  if position('@' in v_value) > 0 then
    v_type := 'email';
    v_normalized := lower(v_value);
    if v_normalized !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
      raise exception using errcode = '22023', message = 'invalid_contact';
    end if;
  else
    v_type := 'phone';
    v_normalized := public.normalize_phone_vn(v_value);
    if v_normalized !~ '^0[0-9]{9,10}$' then
      raise exception using errcode = '22023', message = 'invalid_contact';
    end if;
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_normalized, 1));

  -- A contact globally bound to another account can't be redeemed here.
  select user_id into v_global_owner
  from public.user_access_contacts
  where normalized_value = v_normalized;
  if v_global_owner is not null and v_global_owner <> v_user_id then
    raise exception using errcode = '23505', message = 'contact_already_claimed';
  end if;

  select * into v_row
  from public.product_activation_contacts pac
  where pac.product_id = p_product_id
    and pac.normalized_value = v_normalized
    and pac.disabled = false
  for update;

  if not found then
    raise exception using errcode = 'P0001', message = 'activation_contact_not_found';
  end if;

  if v_row.claimed_by_user_id is not null and v_row.claimed_by_user_id <> v_user_id then
    raise exception using errcode = '23505', message = 'contact_already_claimed';
  end if;

  update public.product_activation_contacts
  set claimed_by_user_id = v_user_id,
      claimed_at = coalesce(claimed_at, now())
  where id = v_row.id;

  perform public.provision_product_for_user(v_user_id, p_product_id);

  return query
  select p.id, p.name from public.products p where p.id = p_product_id;
end;
$$;

revoke all on function public.activate_product_by_contact(text, text) from public, anon;
grant execute on function public.activate_product_by_contact(text, text) to authenticated;

-- 6. Default product now follows the claimed activation rows ---------------
-- (falls back to the old orders lookup for pre-migration accounts).

create or replace function public.get_default_product_for_contact()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (
      select pac.product_id
      from public.product_activation_contacts pac
      where pac.claimed_by_user_id = auth.uid()
      order by pac.claimed_at asc nulls last, pac.created_at asc
      limit 1
    ),
    (
      select o.product_id
      from public.user_access_contacts c
      join public.orders o
        on (c.contact_type = 'email' and o.email is not null and lower(btrim(o.email)) = c.normalized_value)
        or (c.contact_type = 'phone' and o.phone is not null and public.normalize_phone_vn(o.phone) = c.normalized_value)
      where c.user_id = auth.uid()
      order by o.order_date desc nulls last, o.created_at desc
      limit 1
    )
  );
$$;

-- 7. New-product trigger no longer provisions everyone ----------------------
-- Only full-catalog accounts (claimed staff contacts + TheraHOME-issued
-- account types) receive future products automatically; ordinary users get
-- a product only when CSKH lists their contact for it.

create or replace function public.provision_new_product_for_claimed_users()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.user_programs (user_id, product_id, order_id)
  select u.user_id, new.id, null
  from (
    select w.claimed_by_user_id as user_id
    from public.web_access_contacts w
    where w.claimed_by_user_id is not null and w.disabled = false
    union
    select p.id
    from public.profiles p
    where p.account_type in ('admin', 'admin_issued', 'review', 'staff', 'partner', 'tester')
  ) u
  on conflict (user_id, product_id) do nothing;

  insert into public.user_program_days (user_program_id, program_day_id, status)
  select up.id,
         pd.id,
         case when pd.day_number = 1 then 'current' else 'locked' end
  from public.user_programs up
  join public.program_days pd on pd.product_id = up.product_id
  where up.product_id = new.id
  on conflict (user_program_id, program_day_id) do nothing;

  return new;
end;
$$;

-- New program days flow to every account that has that product's program —
-- entitlement is the user_programs row itself now, no contacts join needed.
create or replace function public.provision_new_program_day_for_claimed_users()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.user_program_days (user_program_id, program_day_id, status)
  select up.id,
         new.id,
         case when new.day_number = 1 then 'current' else 'locked' end
  from public.user_programs up
  where up.product_id = new.product_id
  on conflict (user_program_id, program_day_id) do nothing;

  return new;
end;
$$;
