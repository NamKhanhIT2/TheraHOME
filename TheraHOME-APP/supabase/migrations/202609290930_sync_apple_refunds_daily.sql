-- Daily Apple refund sweep — the iOS twin of `sync-voided-purchases-daily`
-- (owner 2026-09-29). Without it an Apple refund leaves
-- phase_purchases.revoked_at null and the customer keeps a phase they were
-- paid back for; see supabase/functions/sync-apple-refunds/index.ts for why
-- this polls instead of taking Apple's notification webhook.
--
-- 03:40 UTC = 10:40 Hanoi, twenty minutes after the Google sweep so the two
-- never share a minute. Same Vault secret as that job: one value, read at
-- call time, never pasted into a dashboard env var.
--
-- Safe to schedule before iOS IAP exists: with no iOS purchase on file the
-- function returns before it ever reaches for the APPLE_* secrets.
select cron.schedule(
  'sync-apple-refunds-daily',
  '40 3 * * *',
  $job$
  select net.http_post(
    url := 'https://nyjvtvmllwbyfokldgtj.supabase.co/functions/v1/sync-apple-refunds',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-refunds-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'voided_cron_secret')
    ),
    body := '{}'::jsonb
  );
  $job$
);
