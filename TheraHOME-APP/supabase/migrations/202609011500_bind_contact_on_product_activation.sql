-- The Roadmap now shows the device dropdown + per-product inline input even
-- for accounts with NO access contact yet (per explicit request) — so the
-- FIRST per-product activation must also bind the entered contact as the
-- account's user_access_contacts row (otherwise the user never appears in
-- Admin's app-user list, and CSKH adding their contact to another product
-- later wouldn't auto-unlock via auto_claim_product_activation_contact).
-- Accounts that already have a contact are left untouched.

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

  perform pg_advisory_xact_lock(hashtextextended(v_user_id::text, 0));
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

  -- First activation on an account with no access contact yet: bind this
  -- contact as the account's contact (same shape as claim_user_access_contact).
  if not exists (
    select 1 from public.user_access_contacts c where c.user_id = v_user_id
  ) then
    insert into public.user_access_contacts (user_id, contact_type, contact_value, normalized_value)
    values (v_user_id, v_type, v_value, v_normalized)
    on conflict do nothing;

    if v_type = 'phone' then
      update public.profiles
      set phone = v_normalized, updated_at = now()
      where id = v_user_id;
    end if;
  end if;

  perform public.provision_product_for_user(v_user_id, p_product_id);

  return query
  select p.id, p.name from public.products p where p.id = p_product_id;
end;
$$;

revoke all on function public.activate_product_by_contact(text, text) from public, anon;
grant execute on function public.activate_product_by_contact(text, text) to authenticated;
