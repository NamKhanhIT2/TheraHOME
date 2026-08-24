-- Replace order/device activation with a one-contact-per-account access gate.
-- A claimed app contact grants access to every current program. New products
-- are provisioned for all claimed users by the trigger at the end of this file.

create table if not exists public.user_access_contacts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  contact_type text not null check (contact_type in ('email', 'phone')),
  contact_value text not null,
  normalized_value text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint user_access_contacts_user_id_key unique (user_id),
  constraint user_access_contacts_normalized_value_key unique (normalized_value)
);

alter table public.user_access_contacts enable row level security;

drop policy if exists "users read own access contact" on public.user_access_contacts;
create policy "users read own access contact"
  on public.user_access_contacts for select
  to authenticated
  using (user_id = auth.uid());

-- The admin/CSKH site needs to list claimed app users. current_web_roles()
-- already exists in the shared project; keep this policy separate from the
-- mobile user's own-row policy above.
drop policy if exists "web staff read app access contacts" on public.user_access_contacts;
create policy "web staff read app access contacts"
  on public.user_access_contacts for select
  to authenticated
  using (
    'admin' = any(public.current_web_roles())
    or 'cskh' = any(public.current_web_roles())
  );

grant select on public.user_access_contacts to authenticated;

create unique index if not exists user_programs_user_product_key
  on public.user_programs(user_id, product_id);

create unique index if not exists user_program_days_program_day_key
  on public.user_program_days(user_program_id, program_day_id);

alter table public.web_access_contacts
  add column if not exists claimed_by_user_id uuid references auth.users(id) on delete set null;

-- Provision the two approved admin identities. Preserve any existing roles
-- (for example cskh) while ensuring admin is present and the current phone is
-- correct. Existing rows are updated; missing rows are inserted.
update public.web_access_contacts
set phone = '0395581037',
    roles = array(
      select distinct role_name
      from unnest(coalesce(roles, array[]::text[]) || array['admin']::text[]) as role_rows(role_name)
    ),
    disabled = false
where lower(email) = 'khanha1k59@gmail.com';

insert into public.web_access_contacts (email, phone, roles, disabled)
select 'khanha1k59@gmail.com', '0395581037', array['admin']::text[], false
where not exists (
  select 1 from public.web_access_contacts
  where lower(email) = 'khanha1k59@gmail.com'
);

update public.web_access_contacts
set phone = '0328552894',
    roles = array(
      select distinct role_name
      from unnest(coalesce(roles, array[]::text[]) || array['admin']::text[]) as role_rows(role_name)
    ),
    disabled = false
where lower(email) = 'hoankenny2002@gmail.com';

insert into public.web_access_contacts (email, phone, roles, disabled)
select 'hoankenny2002@gmail.com', '0328552894', array['admin']::text[], false
where not exists (
  select 1 from public.web_access_contacts
  where lower(email) = 'hoankenny2002@gmail.com'
);

-- The return shape evolved while this migration was being prepared. Drop
-- the old RPC (and its compatibility wrapper, if present) so re-running the
-- file upgrades an already-created draft function cleanly.
drop function if exists public.claim_user_access_contact(text) cascade;

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

  -- Serialize claims for both this account and this normalized contact.
  perform pg_advisory_xact_lock(hashtextextended(v_user_id::text, 0));
  perform pg_advisory_xact_lock(hashtextextended(v_normalized, 1));

  -- Admin-created admin/CSKH contacts use this same claim path. A matching
  -- enabled staff row bypasses the purchase check, but is still bound to
  -- exactly one Google identity.
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

  -- Ordinary users are eligible only when their contact belongs to at least
  -- one Shopify order. This is a purchase check, not per-order/device
  -- activation: the order remains untouched and a successful claim grants
  -- the whole catalog.
  if not v_is_staff and not exists (
    select 1
    from public.orders purchase
    where (
      v_type = 'email'
      and purchase.email is not null
      and lower(btrim(purchase.email)) = v_normalized
    ) or (
      v_type = 'phone'
      and purchase.phone is not null
      and public.normalize_phone_vn(purchase.phone) = v_normalized
    )
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

  -- Keep the profile contact useful for the account/admin UI without
  -- overwriting the Google identity email with a separately claimed email.
  if v_type = 'phone' then
    update public.profiles
    set phone = v_normalized, updated_at = now()
    where id = v_user_id;
  end if;

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

  select count(*)::integer into v_programs_granted
  from public.user_programs
  where user_id = v_user_id;

  return query select v_type, v_value, v_programs_granted, v_roles;
end;
$$;

revoke all on function public.claim_user_access_contact(text) from public, anon;
grant execute on function public.claim_user_access_contact(text) to authenticated;

-- Preserve ownership for already-provisioned staff whose Google identity
-- email matches the allow-listed email. This prevents another signed-in
-- account from winning the first-claim race for an existing admin contact.
update public.web_access_contacts contact
set claimed_by_user_id = identity.id
from auth.users identity
where contact.claimed_by_user_id is null
  and contact.email is not null
  and lower(contact.email) = lower(identity.email);

create unique index if not exists web_access_contacts_claimed_user_key
  on public.web_access_contacts(claimed_by_user_id)
  where claimed_by_user_id is not null;

create or replace function public.lookup_web_access_contact(
  p_phone text default null,
  p_email text default null
)
returns text[]
language sql
security definer
set search_path = ''
as $$
  select claimed.access_roles
  from public.claim_user_access_contact(coalesce(p_email, p_phone)) claimed
  limit 1;
$$;

revoke all on function public.lookup_web_access_contact(text, text) from public, anon;
grant execute on function public.lookup_web_access_contact(text, text) to authenticated;

create or replace function public.current_web_roles()
returns text[]
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (
      select roles
      from public.web_access_contacts
      where claimed_by_user_id = auth.uid()
        and disabled = false
      limit 1
    ),
    array[]::text[]
  );
$$;

revoke all on function public.current_web_roles() from public, anon;
grant execute on function public.current_web_roles() to authenticated;

create or replace function public.provision_new_product_for_claimed_users()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.user_programs (user_id, product_id, order_id)
  select c.user_id, new.id, null
  from public.user_access_contacts c
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

drop trigger if exists provision_new_product_for_claimed_users on public.products;
create trigger provision_new_product_for_claimed_users
after insert on public.products
for each row execute function public.provision_new_product_for_claimed_users();

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
  join public.user_access_contacts c on c.user_id = up.user_id
  where up.product_id = new.product_id
  on conflict (user_program_id, program_day_id) do nothing;

  return new;
end;
$$;

drop trigger if exists provision_new_program_day_for_claimed_users on public.program_days;
create trigger provision_new_program_day_for_claimed_users
after insert on public.program_days
for each row execute function public.provision_new_program_day_for_claimed_users();
