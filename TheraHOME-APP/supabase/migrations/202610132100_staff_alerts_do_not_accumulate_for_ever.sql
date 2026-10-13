-- staff_alerts had no end. Closing a row only stamps handled_at; nothing ever
-- deleted one, so a busy support line would have left tens of thousands of
-- settled rows sitting under every query and every cascade. The queue is a
-- work list, not an archive — what happened is already recorded in the
-- thread, the review and the subscription row.
--
-- Ninety days: long enough to answer "who dealt with this and when", short
-- enough that the table stays small. SQL straight from pg_cron — no Edge
-- Function, no shared secret, nothing to deploy.
select cron.schedule(
  'prune-staff-alerts-weekly',
  -- 04:40 UTC Sunday = 11:40 Hanoi. Clear of the daily jobs at :00-:40.
  '40 4 * * 0',
  $job$
  delete from public.staff_alerts
   where handled_at is not null and handled_at < now() - interval '90 days';
  $job$
);

-- The four foreign keys that cascade from parents which really do get
-- deleted — an account closing, a thread going, a review pruned. Without a
-- covering index each of those deletes sequentially scans staff_alerts.
create index if not exists staff_alerts_customer_idx on public.staff_alerts (customer_id);
create index if not exists staff_alerts_thread_idx on public.staff_alerts (thread_id);
create index if not exists staff_alerts_form_review_idx on public.staff_alerts (form_review_id);
create index if not exists staff_alerts_subscription_idx on public.staff_alerts (subscription_id);
