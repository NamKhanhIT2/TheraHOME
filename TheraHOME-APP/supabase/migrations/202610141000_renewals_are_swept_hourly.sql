-- Nothing picked up a renewal.
--
-- verify-subscription writes a PERIOD, and the only thing that ever wrote a
-- new one was a purchase or the catch-up inside `useSubscriptionPurchase` —
-- a hook imported by exactly one screen, app/subscription.tsx. So a renewal
-- was noticed only if the customer opened the paywall, which a person who is
-- already paying has no reason to do. One period after buying, a PAYING
-- customer silently lost AI chat, calls, form checks and xu. Both platforms:
-- StoreKit queues the renewal transaction and replays it, but only to an
-- observer, and the observer lives in that same screen.
--
-- Found by the owner's first real Android purchase, 2026-10-14. A Play
-- licence-test subscription compresses its 3-month period to five minutes,
-- which turned a month of staleness into something visible in one sitting.
--
-- Hourly, not daily: the window between "the store charged them" and "the app
-- agrees" has to be short enough that nobody writes in about it. :25 past the
-- hour, clear of the daily jobs clustered at :00-:40.
select cron.schedule(
  'sync-subscription-renewals-hourly',
  '25 * * * *',
  $job$
  select net.http_post(
    url := 'https://nyjvtvmllwbyfokldgtj.supabase.co/functions/v1/sync-subscription-renewals',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-renewal-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'voided_cron_secret')
    ),
    body := '{}'::jsonb
  );
  $job$
);

-- The query the sweep runs, given an index so it stays cheap as the table
-- grows: it only ever wants rows that are active, not revoked, and past their
-- period.
create index if not exists user_subscriptions_past_due_idx
  on public.user_subscriptions (current_period_end)
  where status = 'active' and revoked_at is null;
