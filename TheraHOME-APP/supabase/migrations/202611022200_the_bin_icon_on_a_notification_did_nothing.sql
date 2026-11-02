-- The notification inbox has had a bin icon on every row since Phase 6, and
-- it has never deleted anything. `notifications` has RLS on with select,
-- update and two web-role policies — and no delete policy at all, so the
-- client's `.delete().eq('id', …)` matched zero rows and returned success.
-- `useDeleteNotification` removes the row optimistically, so it vanished,
-- then `onSuccess` refetched and it came straight back (QA on device,
-- 2026-11-02).
--
-- Scoped exactly like the select and update policies: your own rows, nobody
-- else's. Staff keep read-only access — a CSKH agent has no business
-- deleting a customer's inbox.
create policy "delete own notifications"
  on public.notifications
  for delete
  to authenticated
  using (user_id = (select auth.uid()));
