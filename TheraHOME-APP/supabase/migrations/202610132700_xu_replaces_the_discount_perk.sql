-- Owner 2026-10-13: the xu programme takes the place of the 10%/15% device
-- discount in the plan benefits. Good riddance — that line promised a code
-- the Shopify store has never had, and it had already been softened once to
-- "nhắn CSKH để nhận mã". A benefit that needs a human to honour it is weaker
-- than one the app can hand over by itself.
--
-- perk_discount_percent/code go empty too, so nothing downstream keeps
-- rendering a discount that no longer exists.

update public.subscription_plans set features = jsonb_set(
  features, '{6}',
  '{"icon":"star","vi":"Tích xu mỗi ngày tập · đủ 100 xu nhận quà tặng TheraHOME","en":"Earn xu every training day · 100 xu wins a TheraHOME gift","ms":"Kumpul xu setiap hari latihan · 100 xu dapat hadiah TheraHOME"}'::jsonb
), perk_discount_percent = null, perk_discount_code = null
 where code = 'premium_plus' and features->6->>'icon' = 'shopping-bag';

update public.subscription_plans set features = jsonb_set(
  features, '{5}',
  '{"icon":"star","vi":"Tích xu mỗi ngày tập · đủ 100 xu nhận quà tặng TheraHOME","en":"Earn xu every training day · 100 xu wins a TheraHOME gift","ms":"Kumpul xu setiap hari latihan · 100 xu dapat hadiah TheraHOME"}'::jsonb
), perk_discount_percent = null, perk_discount_code = null
 where code = 'premium_lifetime' and features->5->>'icon' = 'shopping-bag';

-- A gift claim rings the staff phone after all (owner's call). It is the one
-- queue item a customer is actively waiting on with no conversation attached,
-- so nothing else would surface it if the console happened to be closed.
create or replace function public.push_staff_alert_to_phones()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  v_secret text;
begin
  -- Chat and form_review are left out because dispatch-push already reaches
  -- staff for both; pushing here as well would double up.
  if new.kind not in ('subscription', 'subscription_refund', 'coin_gift') then
    return new;
  end if;
  select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'voided_cron_secret';
  if v_secret is null then
    raise warning 'voided_cron_secret missing: staff alert % not pushed', new.id;
    return new;
  end if;
  perform net.http_post(
    url := 'https://nyjvtvmllwbyfokldgtj.supabase.co/functions/v1/notify-staff-alert',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-staff-alert-secret', v_secret
    ),
    body := jsonb_build_object('alertId', new.id)
  );
  return new;
end;
$$;

revoke execute on function public.push_staff_alert_to_phones() from public, anon, authenticated;
