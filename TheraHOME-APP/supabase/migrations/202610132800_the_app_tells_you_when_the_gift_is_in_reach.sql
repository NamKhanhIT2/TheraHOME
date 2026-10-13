-- Two moments the customer should hear about without opening the app: the xu
-- crossing the threshold, and the parcel going out. Everything else about the
-- programme is visible where it happens, and a notification per 10 xu would
-- be the fastest way to get the whole thing muted.
--
-- Written as `type = 'schedule'` with `destination = 'coins'`, deliberately.
-- A brand-new notification type renders as a blank row in every build already
-- installed; an existing type with a destination the older builds ignore
-- degrades to a notification that simply does not navigate.

alter table public.notifications drop constraint if exists notifications_destination_check;
alter table public.notifications add constraint notifications_destination_check
  check (destination is null or destination = any (array['store','home','roadmap','community','community_post','chat','coins']));

create or replace function public.notify_coin_threshold()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  v_threshold integer;
  v_before integer;
  v_after integer;
  v_lang text;
  v_title text;
  v_body text;
begin
  select gift_threshold into v_threshold from public.coin_settings where id;
  select coalesce(sum(amount), 0)::integer into v_after
    from public.coin_entries where user_id = new.user_id;
  v_before := v_after - new.amount;

  -- Only on the crossing. Every later claim is already above it, and nobody
  -- wants to be told twice.
  if v_before >= v_threshold or v_after < v_threshold then
    return new;
  end if;
  -- Already asked for the gift: the news is stale.
  if exists (select 1 from public.coin_gift_claims where user_id = new.user_id) then
    return new;
  end if;

  v_lang := public.profile_language(new.user_id);
  if v_lang = 'en' then
    v_title := 'You have enough xu!';
    v_body := 'You have reached ' || v_threshold || ' xu. Open TheraHOME to claim your gift.';
  elsif v_lang = 'ms' then
    v_title := 'Xu anda sudah cukup!';
    v_body := 'Anda telah mencapai ' || v_threshold || ' xu. Buka TheraHOME untuk menuntut hadiah anda.';
  else
    v_title := 'Bạn đã đủ xu nhận quà!';
    v_body := 'Bạn đã tích đủ ' || v_threshold || ' xu. Mở TheraHOME để nhận phần quà của mình nhé.';
  end if;

  insert into public.notifications (user_id, type, title, body, destination, push_title, push_body)
  values (new.user_id, 'schedule', v_title, v_body, 'coins', v_title, v_body);
  return new;
end;
$$;

revoke execute on function public.notify_coin_threshold() from public, anon, authenticated;

drop trigger if exists notify_coin_threshold on public.coin_entries;
create trigger notify_coin_threshold
  after insert on public.coin_entries
  for each row execute function public.notify_coin_threshold();

create or replace function public.notify_coin_gift_sent()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  v_lang text;
  v_title text;
  v_body text;
begin
  if new.fulfilled_at is null or old.fulfilled_at is not null then
    return new;
  end if;
  v_lang := public.profile_language(new.user_id);
  if v_lang = 'en' then
    v_title := 'Your gift is on its way';
    v_body := 'A specialist has sent your gift. Thank you for training so steadily!';
  elsif v_lang = 'ms' then
    v_title := 'Hadiah anda dalam perjalanan';
    v_body := 'Pakar telah menghantar hadiah anda. Terima kasih kerana berlatih dengan tekun!';
  else
    v_title := 'Quà của bạn đã được gửi';
    v_body := 'Chuyên viên đã gửi phần quà cho bạn. Cảm ơn bạn đã tập luyện đều đặn!';
  end if;

  insert into public.notifications (user_id, type, title, body, destination, push_title, push_body)
  values (new.user_id, 'schedule', v_title, v_body, 'coins', v_title, v_body);
  return new;
end;
$$;

revoke execute on function public.notify_coin_gift_sent() from public, anon, authenticated;

drop trigger if exists notify_coin_gift_sent on public.coin_gift_claims;
create trigger notify_coin_gift_sent
  after update of fulfilled_at on public.coin_gift_claims
  for each row execute function public.notify_coin_gift_sent();
