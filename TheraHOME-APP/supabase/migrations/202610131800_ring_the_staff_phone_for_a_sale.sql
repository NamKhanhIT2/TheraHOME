-- The console hears every alert over Realtime. The phone already hears two
-- of the three kinds, because a chat message and a form-check clip both
-- travel as chat messages and `dispatch-push` mode 'chat' reaches staff. A
-- subscription reached nobody.
--
-- Fired from the alert row rather than from verify-subscription on purpose:
-- the payment path should not grow a new reason to fail, and this way an
-- admin's manual grant — which never goes near that function — rings too.
--
-- pg_net queues the request and sends it after commit, so a slow or dead
-- Expo cannot hold a purchase open.

create or replace function public.push_staff_alert_to_phones()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  v_secret text;
begin
  -- Only the kinds nothing else pushes. Chat and form_review would double up
  -- with dispatch-push, and two notifications for one message is worse than
  -- one.
  if new.kind not in ('subscription', 'subscription_refund') then
    return new;
  end if;
  select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'voided_cron_secret';
  -- No secret configured is not a reason to fail an insert that already
  -- succeeded. The row is written; only the push is lost.
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

drop trigger if exists push_staff_alert on public.staff_alerts;
create trigger push_staff_alert
  after insert on public.staff_alerts
  for each row execute function public.push_staff_alert_to_phones();
