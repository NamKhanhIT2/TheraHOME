-- "Báo cáo tiến độ gửi hàng tuần" — the Premium benefit that did not exist.
-- See supabase/functions/dispatch-weekly-reports/index.ts.
--
-- Monday 01:00 UTC = 08:00 Hanoi. A week-in-review wants to land at the start
-- of the week it is meant to change, not at the end of the one it describes.
-- Reuses the same Vault secret as the refund sweeps and the clip pruner: one
-- shared cron value, read at call time, never pasted into an env var.
select cron.schedule(
  'dispatch-weekly-reports',
  '0 1 * * 1',
  $job$
  select net.http_post(
    url := 'https://nyjvtvmllwbyfokldgtj.supabase.co/functions/v1/dispatch-weekly-reports',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-weekly-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'voided_cron_secret')
    ),
    body := '{}'::jsonb
  );
  $job$
);
