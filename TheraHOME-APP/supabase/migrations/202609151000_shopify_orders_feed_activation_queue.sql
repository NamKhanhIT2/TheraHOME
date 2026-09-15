-- A Shopify order now puts its phone (and email) into the WEB "Kích hoạt" tab
-- by itself, as a row awaiting CSKH approval. Until 2026-09-14 the webhook
-- wrote `orders` and stopped there, so CSKH had to retype every customer's
-- phone into `product_activation_contacts` by hand — 219 orders on file
-- against 30 listed contacts, i.e. most paying customers had no way into the
-- app. Requested 2026-09-15; the "chờ duyệt" (pending) half is deliberate,
-- an order is not by itself proof that access should be granted (nothing
-- un-syncs a cancelled order, see the `orders/cancelled` note in
-- docs/backend.md), so a human still says yes.
--
-- Nothing here changes an RPC name, parameter, return shape, or one of the
-- five error strings `TheraHOME-APP/app/activate.tsx` matches on, and the app
-- never reads `orders`/`product_activation_contacts` directly — so this ships
-- to installed apps with no rebuild. That matters more than usual here:
-- expo-updates is absent and disabled in both native manifests, so there is
-- no OTA path and any contract change would mean a store resubmission.

-- 1. Where a contact came from, and who let it through.
--    `source_order_id is null` is the pre-existing manual row, unchanged.
--    It doubles as the grouping key: the phone row and the email row of one
--    order share it, which is what lets the UI show a single
--    "0856239030 / khach@gmail.com" line instead of two.
alter table public.product_activation_contacts
  add column if not exists source_order_id uuid references public.orders(id) on delete set null,
  add column if not exists approved_at timestamptz,
  add column if not exists approved_by uuid references auth.users(id) on delete set null;

create index if not exists product_activation_contacts_source_order_idx
  on public.product_activation_contacts (source_order_id)
  where source_order_id is not null;

comment on column public.product_activation_contacts.source_order_id is
  'Order this contact was queued from; null = added by hand in the Kích hoạt tab. Also the key the UI groups a phone+email pair by.';

-- 2. Queue one order's contacts. No new "pending" column: `disabled = true`
--    already means "listed but grants nothing" and every access path enforces
--    it — activate_product_by_contact (`and pac.disabled = false`),
--    claim_user_access_contact (twice, including the gate that raises
--    order_contact_not_found), and auto_claim_product_activation_contact
--    (`if new.disabled then return new`). Reusing it keeps the pending state
--    free of any RPC change.
--
--    Both values are validated HERE, against the same patterns the BEFORE
--    trigger uses, and skipped when they fail. That is load-bearing: the
--    trigger raises `invalid_contact`, which inside an AFTER INSERT ON orders
--    would abort the order insert itself and make the webhook 500 forever.
--    There are already two junk phones on file (6 and 9 digits).
create or replace function public.enqueue_order_activation_contacts(p_order_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order   record;
  v_note    text;
  v_phone   text;
  v_email   text;
  v_added   integer := 0;
  v_rows    integer;
begin
  select id, product_id, phone, email, activation_code, order_date
    into v_order
    from public.orders
   where id = p_order_id;
  if not found then
    return 0;
  end if;

  v_note := 'Đơn Shopify ' || coalesce(v_order.activation_code, '?')
         || ' · ' || to_char(v_order.order_date, 'DD/MM/YYYY');

  -- orders.phone is stored in the legacy domestic form ('0912345678') by the
  -- webhook; product_activation_contacts.normalized_value has been E.164
  -- since 202609071400. Route it through the same helper the rest of the
  -- schema uses so the two agree — get_default_product_for_contact already
  -- wraps orders.phone the same way.
  v_phone := public.normalize_phone_e164(coalesce(v_order.phone, ''), '84');
  if v_phone ~ '^\+[1-9][0-9]{6,14}$' then
    insert into public.product_activation_contacts
      (product_id, contact_type, contact_value, normalized_value, disabled, source_order_id, note)
    values
      (v_order.product_id, 'phone', v_phone, v_phone, true, v_order.id, v_note)
    on conflict (product_id, normalized_value) do nothing;
    get diagnostics v_rows = row_count;
    v_added := v_added + v_rows;
  end if;

  v_email := lower(btrim(coalesce(v_order.email, '')));
  if v_email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    insert into public.product_activation_contacts
      (product_id, contact_type, contact_value, normalized_value, disabled, source_order_id, note)
    values
      (v_order.product_id, 'email', v_email, v_email, true, v_order.id, v_note)
    on conflict (product_id, normalized_value) do nothing;
    get diagnostics v_rows = row_count;
    v_added := v_added + v_rows;
  end if;

  -- `do nothing` covers all three collisions at once: already added by hand,
  -- a repeat customer's second order, and Shopify redelivering a webhook.
  return v_added;
end;
$$;

revoke all on function public.enqueue_order_activation_contacts(uuid) from public, anon, authenticated;

-- 3. Fire it on every write to `orders`, not just the webhook's. A trigger
--    beats editing the Edge Function: it catches any path into the table
--    (orders has RLS on with no policies, so only service-role reaches it),
--    and it needs no function redeploy.
create or replace function public.orders_enqueue_activation_contacts()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  begin
    perform public.enqueue_order_activation_contacts(new.id);
  exception when others then
    -- The order matters more than the queue entry. Letting this propagate
    -- would 500 the webhook, and Shopify would redeliver forever while the
    -- order never lands at all.
    raise warning 'enqueue_order_activation_contacts failed for order %: %', new.id, sqlerrm;
  end;
  return new;
end;
$$;

drop trigger if exists c_enqueue_activation_contacts on public.orders;
create trigger c_enqueue_activation_contacts
after insert on public.orders
for each row execute function public.orders_enqueue_activation_contacts();

-- 4. Approving is an UPDATE flipping `disabled` to false. Two existing
--    triggers have to learn about that transition.

-- 4a. Stamp the approver server-side, so the client cannot claim someone
--     else did it. Everything above this addition is the shipped body of
--     202609011000_per_product_activation.sql, unchanged.
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
    if new.normalized_value !~ '^\+[1-9][0-9]{6,14}$' then
      raise exception using errcode = '22023', message = 'invalid_contact';
    end if;
  end if;
  new.contact_value := v_value;

  if tg_op = 'UPDATE' and old.disabled and not new.disabled and new.approved_at is null then
    new.approved_at := now();
    new.approved_by := auth.uid();
  end if;

  return new;
end;
$$;

-- 4b. The auto-claim trigger is what unlocks a product for a customer who
--     already has an account. It was AFTER INSERT only, so approving a queued
--     row would have listed the contact without provisioning anything and the
--     customer would have had to re-activate in the app. Extend it to the
--     disabled-flip instead of duplicating the provisioning logic in a second
--     place. Body below is the shipped one plus the no-op guard.
create or replace function public.auto_claim_product_activation_contact()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid;
begin
  -- An UPDATE that merely restates `disabled` has nothing to do. (The
  -- claimed_by_user_id write below never re-fires this trigger: `update of
  -- disabled` only fires when that column is in the SET list.)
  if tg_op = 'UPDATE' and old.disabled is not distinct from new.disabled then
    return new;
  end if;

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

drop trigger if exists b_auto_claim_product_activation_contact on public.product_activation_contacts;
create trigger b_auto_claim_product_activation_contact
after insert or update of disabled on public.product_activation_contacts
for each row execute function public.auto_claim_product_activation_contact();

-- 5. Backfill: every order already on file joins the queue. All of it lands
--    `disabled = true`, so this grants nobody anything — the count of
--    non-disabled rows must be identical before and after.
do $$
declare
  r record;
  v_added integer := 0;
begin
  for r in select id from public.orders order by order_date, created_at loop
    v_added := v_added + public.enqueue_order_activation_contacts(r.id);
  end loop;
  raise notice 'queued % activation contacts from existing orders', v_added;
end $$;
