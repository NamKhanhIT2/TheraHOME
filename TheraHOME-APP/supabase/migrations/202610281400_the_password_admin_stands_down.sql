-- The password account stops being an admin.
--
-- Companion to 202610281000. That migration gave the two owner Google accounts
-- ['admin','cskh'] in web_access_contacts but deliberately left
-- hoankenny@therahomeai.com as profiles.account_type = 'admin', so there was a
-- way back in if Google sign-in misbehaved. The owner confirmed on 2026-10-28
-- that a Google login reaches /admin, so the shared password stands down.
--
-- 'tester', not 'normal'. Nine functions read account_type, and two of them
-- treat a non-staff value as a CUSTOMER rather than as "no powers":
--   * get_community_highlights excludes 'admin', 'cskh' and 'tester' from the
--     app's community leaderboard. 'normal' would make this internal account
--     eligible to appear there in front of customers. (It cannot today — it
--     has no avatar and no completed days, both of which that function
--     requires — but that is luck, not a guarantee, and someone setting an
--     avatar on it later should not publish it.)
--   * notify_roadmap_published skips 'review', 'admin' and 'cskh', so this
--     account will now receive roadmap notifications. Harmless, and the price
--     of not being staff any more.
-- 'tester' is read by nothing except that first exclusion, so it grants
-- exactly nothing while keeping the account out of customer-facing lists.
-- 'staff' would have been the obvious name but is NOT excluded from the
-- leaderboard, which is the one thing that mattered here.
--
-- Checked before running: staff_user_ids() unions web_access_contacts with
-- profiles.account_type, so after this the staff set is still the two owner
-- Google accounts plus support@therahomeai.com and cskh01@thera.local —
-- nobody is orphaned. provision_new_product_for_claimed_users also unions both
-- sources, so the owners keep receiving newly created products; this account
-- stops, which is correct now that it is not staff.
-- account_type is guarded by protect_privileged_profile_columns(), which
-- raises 42501 unless the caller is service_role or already holds the admin
-- web role. A migration connection is neither, so it announces itself as
-- service_role for this transaction — the branch that trigger already honours
-- for server-side administration. Without these two lines this file fails with
-- privileged_profile_column_change_forbidden.
set local request.jwt.claims = '{"role":"service_role"}';

update public.profiles
set account_type = 'tester'
where id = 'c71c9b2c-846c-491c-bae2-517950f54ab9'
  and account_type = 'admin';
