-- CSKH can read the approval queue. Only admin can decide it.
--
-- The Agent console opens to the customer-care accounts (owner, 2026-10-09):
-- they are the staff this business actually has, so "nhân viên" and `cskh` are
-- the same people. They need to see what an agent has proposed and the figures
-- behind it — a proposal they cannot read is a proposal they cannot discuss.
--
-- Releasing it stays with admin. The original `for all` policy is left exactly
-- as it was and this only adds SELECT, so write access is untouched: a cskh
-- UPDATE matches no policy, changes no row, and PostgREST reports zero rows —
-- which the web client already turns into an error rather than a silent
-- success (src/lib/agentApprovals.ts). The console also hides the buttons, so
-- the rule is enforced twice and neither place is the only one holding it.
drop policy if exists "web admin cskh reads agent_approvals" on public.agent_approvals;
create policy "web admin cskh reads agent_approvals"
  on public.agent_approvals for select
  to authenticated
  using ('admin' = any (current_web_roles()) or 'cskh' = any (current_web_roles()));
