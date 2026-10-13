-- A gift claim is work for a person: check the customer, pack it, post it.
-- So it belongs in the same queue as everything else that needs a human,
-- rather than in a spreadsheet somebody has to remember to open.

alter table public.staff_alerts drop constraint if exists staff_alerts_kind_check;
alter table public.staff_alerts add constraint staff_alerts_kind_check
  check (kind in ('chat', 'form_review', 'subscription', 'subscription_refund', 'coin_gift'));

create or replace function public.staff_alert_on_coin_gift()
returns trigger
language plpgsql security definer set search_path = public
as $fn$
declare
  v_name text;
  v_contact text;
begin
  select coalesce(nullif(p.full_name, ''), 'Khách hàng'),
         coalesce(nullif(p.phone, ''), nullif(p.email, ''), '')
    into v_name, v_contact
    from public.profiles p where p.id = new.user_id;

  perform public.raise_staff_alert(
    'coin_gift', new.user_id::text, new.user_id,
    coalesce(v_name, 'Khách hàng') || ' đủ xu nhận quà',
    new.balance_at_claim || ' xu' || case when v_contact <> '' then ' · ' || v_contact else '' end,
    null, null, null
  );
  return new;
end;
$fn$;

revoke execute on function public.staff_alert_on_coin_gift() from public, anon, authenticated;

drop trigger if exists staff_alert_coin_gift on public.coin_gift_claims;
create trigger staff_alert_coin_gift
  after insert on public.coin_gift_claims
  for each row execute function public.staff_alert_on_coin_gift();

-- Posting a gift is not urgent enough to ring a phone at night; the console
-- and the badge are enough. push_staff_alert_to_phones() already restricts
-- itself to the subscription kinds, so nothing to change there.

/** The console's list: who is earning, how much, and where their gift is. */
create or replace function public.coin_holders(p_limit integer default 200)
returns table (
  user_id uuid, full_name text, email text, phone text,
  plan_code text, balance integer, days_claimed integer, streak_claimed integer,
  last_earned_at timestamptz, gift_claimed_at timestamptz, gift_fulfilled_at timestamptz
)
language sql stable security definer set search_path = public
as $$
  select c.user_id,
         p.full_name, p.email, p.phone,
         public.plan_code_for(c.user_id),
         sum(c.amount)::integer,
         count(*) filter (where c.kind = 'day')::integer,
         count(*) filter (where c.kind = 'streak')::integer,
         max(c.created_at),
         g.claimed_at,
         g.fulfilled_at
    from public.coin_entries c
    left join public.profiles p on p.id = c.user_id
    left join public.coin_gift_claims g on g.user_id = c.user_id
   where 'admin' = any (public.current_web_roles())
      or 'cskh' = any (public.current_web_roles())
   group by c.user_id, p.full_name, p.email, p.phone, g.claimed_at, g.fulfilled_at
   order by g.claimed_at desc nulls last, sum(c.amount) desc
   limit greatest(1, least(coalesce(p_limit, 200), 1000));
$$;

revoke execute on function public.coin_holders(integer) from public, anon;
grant execute on function public.coin_holders(integer) to authenticated;

/** Staff ticks it once the parcel is on its way. */
create or replace function public.fulfil_coin_gift(p_user uuid, p_note text default null)
returns public.coin_gift_claims
language plpgsql security definer set search_path = public
as $fn$
declare
  v_row public.coin_gift_claims;
begin
  if not ('admin' = any (public.current_web_roles()) or 'cskh' = any (public.current_web_roles())) then
    raise exception 'staff_required' using errcode = '42501';
  end if;
  update public.coin_gift_claims
     set fulfilled_at = now(), fulfilled_by = (select auth.uid()), note = coalesce(p_note, note)
   where user_id = p_user and fulfilled_at is null
  returning * into v_row;
  if v_row.user_id is null then raise exception 'not_found_or_done' using errcode = '22023'; end if;
  -- Closing the parcel closes the queue item.
  update public.staff_alerts
     set handled_at = now(), handled_by = (select auth.uid())
   where kind = 'coin_gift' and dedupe_key = p_user::text and handled_at is null;
  return v_row;
end;
$fn$;

revoke execute on function public.fulfil_coin_gift(uuid, text) from public, anon;
grant execute on function public.fulfil_coin_gift(uuid, text) to authenticated;
