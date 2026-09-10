-- Username is a display name for EVERY account type now — it may repeat.
--
-- 202609081600 narrowed username uniqueness to staff/issued accounts because
-- those signed in BY username (auth-sign-in resolved name -> email, and the
-- lookup had to be unambiguous). Owner's call 2026-09-10: sign-in is by email
-- only — the username login screen (thera-login) was removed and the app no
-- longer sends a username as a login identifier. With that path retired the
-- staff-only uniqueness has no purpose and only gets in the way (creating an
-- App Review account named "Reviewer" failed as a bare 500 because an older
-- "reviewer" account existed). Drop it, so customers and issued accounts alike
-- treat username as a repeatable display name.
--
-- The one remaining "collision" is intentional and unchanged: an issued
-- account created WITHOUT a real email gets the synthetic <username>@thera.local
-- as its auth email, so two no-email accounts cannot share a username (Supabase
-- Auth rejects the duplicate email). Giving either a real email lifts that.

drop index if exists public.profiles_staff_username_unique_idx;
