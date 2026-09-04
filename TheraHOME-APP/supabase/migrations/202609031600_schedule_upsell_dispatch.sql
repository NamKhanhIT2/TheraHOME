-- Invoke the due Upsale dispatcher every minute.
--
-- Why this exists: the original every-5-minutes job (created outside the
-- migrations flow) failed forever with 401 UNAUTHORIZED_NO_AUTH_HEADER —
-- the Functions gateway rejected the call BEFORE the function's own
-- x-upsell-cron-secret check ever ran, because the function was deployed
-- with verify_jwt enabled and pg_net sent no Authorization header. Fixed
-- 2026-09-03 by redeploying `dispatch-upsell-campaigns` (v15) with
-- verify_jwt DISABLED — auth is the function's own check: the
-- x-upsell-cron-secret header (or a service-role bearer).
--
-- Vault secrets used (already present; a missing one aborts setup instead
-- of leaving campaigns silently stuck in `scheduled` forever):
--   upsell_project_url  = https://<project-ref>.supabase.co
--   upsell_cron_secret  = the same value as the Edge Function secret
--                         UPSELL_CRON_SECRET

create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

do $$
begin
  if not exists (select 1 from vault.decrypted_secrets where name = 'upsell_project_url') then
    raise exception 'Missing Vault secret: upsell_project_url';
  end if;
  if not exists (select 1 from vault.decrypted_secrets where name = 'upsell_cron_secret') then
    raise exception 'Missing Vault secret: upsell_cron_secret';
  end if;

  -- Both the pre-migration job name and this migration's own (for re-runs).
  if exists (select 1 from cron.job where jobname = 'dispatch-upsell-campaigns-every-5-minutes') then
    perform cron.unschedule('dispatch-upsell-campaigns-every-5-minutes');
  end if;
  if exists (select 1 from cron.job where jobname = 'dispatch-upsell-campaigns-every-minute') then
    perform cron.unschedule('dispatch-upsell-campaigns-every-minute');
  end if;

  perform cron.schedule(
    'dispatch-upsell-campaigns-every-minute',
    '* * * * *',
    $job$
      select net.http_post(
        url := rtrim((select decrypted_secret from vault.decrypted_secrets where name = 'upsell_project_url'), '/') || '/functions/v1/dispatch-upsell-campaigns',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'x-upsell-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'upsell_cron_secret')
        ),
        body := jsonb_build_object('triggered_at', now())
      );
    $job$
  );
end
$$;
