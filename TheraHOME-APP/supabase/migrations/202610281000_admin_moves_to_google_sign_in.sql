-- Admin stops being a password account.
--
-- Until now the only way into /admin was hoankenny@therahomeai.com, an
-- email+password identity whose admin powers came from
-- profiles.account_type = 'admin'. The owner asked for that to end: a shared
-- password is the weakest link in a console that can read every customer's
-- phone, email and address.
--
-- Nothing in the sign-in code has to change. current_web_roles() already
-- looks at web_access_contacts FIRST and only falls back to
-- profiles.account_type when no contact row carries a role. Both owner
-- Google accounts already have a row here, already claimed by the right
-- auth.users id, already disabled = false — the rows were simply left with
-- roles = '{}' on 2026-09-16. Filling them in is the whole change.
--
-- The roles are ['admin','cskh'], not ['admin'], to match exactly what
-- account_type='admin' resolved to before, so the Admin <-> CSKH switcher in
-- the shell keeps working rather than quietly disappearing.
--
-- The password account is deliberately LEFT as admin by this migration. It is
-- the way back in if Google sign-in misbehaves. It gets demoted in a separate
-- migration once the owner has confirmed a Google login reaches /admin.
update public.web_access_contacts
set roles = array['admin', 'cskh']::text[]
where email in ('khanha1k59@gmail.com', 'hoankenny2002@gmail.com')
  and claimed_by_user_id is not null;
