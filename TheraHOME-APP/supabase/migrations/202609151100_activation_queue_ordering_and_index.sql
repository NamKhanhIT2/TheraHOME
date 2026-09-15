-- Follow-up to 202609151000. Two things the backfill got wrong, both about
-- reading the queue rather than about access.
--
-- 1. The backfill looped inside one transaction, so all 321 queued rows share
--    created_at to the microsecond (2026-09-15 04:17:38.95433+00, verified).
--    The WEB tab orders by created_at desc and pages 20 orders at a time, so
--    "newest order first" was really physical row order — and an order placed
--    in August could sit above one from yesterday with no way to tell. The
--    order's own created_at is distinct per row and spans the real
--    2026-08-01..09-15 window, which is what CSKH is actually looking for.
--
--    This UPDATE deliberately does not mention `disabled`, so the auto-claim
--    trigger (AFTER UPDATE OF disabled) does not fire and nothing is granted.
--    The BEFORE normalize trigger does re-run; it is idempotent on values that
--    are already canonical, which every queued row is.
update public.product_activation_contacts pac
   set created_at = o.created_at
  from public.orders o
 where o.id = pac.source_order_id
   and pac.disabled
   and pac.created_at <> o.created_at;

-- 2. The pending queue is its own access pattern — "every disabled row from an
--    order, newest first" — and it is the one the tab opens on. Cheap at 321
--    rows, worth having before the queue grows with every future order.
create index if not exists product_activation_contacts_pending_idx
  on public.product_activation_contacts (created_at desc)
  where disabled and source_order_id is not null;
