# Auth, activation, and the three login methods

> Split out of `TheraHOME-APP/CLAUDE.md` (2026-08-28) to keep that file
> small. Content is verbatim from the original — any "see X above/below"
> cross-reference may now live in `../CLAUDE.md` or a sibling file in
> `docs/` (`backend.md`, `auth-and-activation.md`, `motion.md`,
> `feature-notes.md`, `manual-setup.md`, `roadmap.md`).

## How activation and Home/Roadmap actually work now

No mock bridge remains — `app/_layout.tsx`'s gate is fully real:
`useSession()` wraps `supabase.auth.getSession()`/`onAuthStateChange` for
sign-in, and `useActivatedPrograms(userId).data.length > 0` (a live
`user_programs` query) for activation. `app/(onboarding)/activate.tsx`'s
phone/email flow calls `activate_orders_by_contact` directly (activates
every matching order in one call — see Supabase schema above); its manual
code / demo QR-scan flows call `lookup_order_by_code` then `activate_order`
for that one order. Either way it finishes with
`queryClient.invalidateQueries({queryKey: ['user_programs', userId]})` —
that refetch updates the same query instance mounted in the root layout, so
`Stack.Protected` reacts and swaps in `(tabs)` on its own; no explicit
navigation call needed.

Home and Roadmap (`app/(tabs)/home.tsx`, `roadmap.tsx`) and day detail
(`app/day/[dayId].tsx`) all read `useActivatedPrograms`/`useProgramDays`/
`usePainLogs`/`useWaterLog`. `useAppStore()`'s `selectedProductId` is now
pure client-side UI state (which activated program the multi-device switcher
shows) — it no longer implies anything about auth/activation. Sign-out
(`app/profile/index.tsx`) calls `supabase.auth.signOut()` and resets that
selection to `null`. Delete-account (`DeleteAccountModal`) does the same
after first calling the real `delete_account` RPC — see Supabase schema
above — so by the time the session ends, `useActivatedPrograms` for that
user is already empty even in the unlikely event sign-out itself failed.

`useRequestDay` (`src/hooks/useRequestDay.ts`) gates opening a `current` day
behind the pain-scale modal, submits via `useCompleteDay`'s `complete_day`
RPC (which flips that day to `done` and the next one to `current` server-side
— no separate "already logged" flag needed, `status !== 'current'` alone is
now a correct and sufficient gate — and, as of Phase 6, inserts a real
notification for the newly-unlocked day). `app/notifications.tsx` reads that
real inbox via `useNotifications`; tapping a `type='schedule'` row deep-links
to `/day/[dayId]` using the day number joined from `related_day_id` (a
`program_days` uuid) — day detail resolves the real day from
`useProgramDays` by that day number, including locked state.

## Three login methods, one gate

Google (`login.tsx`), Apple (`login.tsx`), and TheraHOME account
(`thera-login.tsx`) each do nothing more than obtain a session and
`router.push('/activate')` — exactly what Google already did before this
phase. All the actual post-auth decision-making (locked/expired check,
onboarding routing, activation routing) lives in exactly one place,
`RootNavigator` (`app/_layout.tsx`), rather than three near-duplicate
per-screen implementations of a `handleAuthenticatedUser`-style function:

1. `touch_last_login()` RPC fires once per new session (any method) —
   powers "Lần đăng nhập cuối" in the Admin UI.
2. `profile.locked` (existing column, previously unread by this app —
   Admin's "Khóa tài khoản" button had no real effect before this phase)
   or an expired `profile.expiresAt` immediately force `signOut()` and show
   a full-screen Vietnamese message ("đã bị khóa" / "đã hết hạn") instead
   of the app shell. Applies to every account, not just TheraHOME-issued
   ones.
3. No claimed `user_access_contacts` row → `/activate` (unchanged).
4. Has access but `profile.onboardingCompleted === false` → `/questions`,
   reusing the same welcome/questions/consent screens a fresh signup sees
   (no separate onboarding was built for this). `consent.tsx` detects an
   existing session and, on "Đồng ý & Tiếp tục", flips
   `onboarding_completed` to `true` via `useUpdateProfile` instead of
   pushing to `/login` — `RootNavigator`'s own reactive gate takes it from
   there.
5. Otherwise → the app shell.

## TheraHOME-issued accounts (Admin-issued, no OAuth)

Extends `profiles` rather than a parallel table (migration
`theraccount_columns_and_guard`): `account_type`
(`normal`/`admin_issued`/`review`/`staff`/`partner`/`tester`),
`access_level` (`free`/`premium`/`admin_granted` — informational only for
now, nothing in the client actually gates on it since there's no real
Free/Pro system to plug into yet), `expires_at`, `onboarding_completed`
(default `true`, so every existing/Google/Apple profile is unaffected —
only Admin-issued rows are ever created with `false`), `created_by`,
`notes`, `last_login_at`. `locked`/`full_name` (both pre-existing) are
reused as `is_active`/`display_name` rather than duplicated.

Created via the TheraHOME WEB Admin's "Tài khoản TheraHOME" page, which
calls the `admin-manage-account` Edge Function (needs the service role to
call `auth.admin.createUser`/`updateUserById` — see Edge Functions below).
Creation always provisions full catalog access immediately
(`user_access_contacts` + every `user_programs`/`user_program_days` row,
mirroring `claim_user_access_contact`'s provisioning block) regardless of
the onboarding choice — `onboarding_completed` only controls whether
`RootNavigator` detours through the intake screens first, not whether the
account has programs. This is why `activate.tsx` (a purchase-verification
screen) is never involved for these accounts.

A `protect_privileged_profile_columns` trigger blocks a signed-in user from
UPDATE-ing `account_type`/`access_level`/`expires_at`/`app_role`/`locked`/
`created_by`/`notes` on their own row unless they're Admin
(`current_web_roles()`) or the caller is the service-role Edge Function —
closes a **pre-existing gap** found while building this (the old "update
own profile" RLS policy had no column restriction at all, so any signed-in
user could already rewrite their own `app_role`/`locked`). Verified via a
rolled-back transaction against a throwaway `auth.users`/`profiles` row —
see the migration's own inline test notes if repeating this.

**2026-08-23 additions** (see "TheraHOME account login for WEB admin/cskh +
`(staff)` mobile shell" below for the full picture): `account_type` gained
`'admin'` (exactly one seeded row, DB-enforced via a partial unique index)
and `'cskh'`; login switched from a literal email field to a plain
`profiles.username`, resolved to the account's real synthetic
`<username>@thera.local` address via `resolve_thera_login_email` before
`signInWithPassword` (`app/(onboarding)/thera-login.tsx`); `'cskh'`
creations skip the catalog-provisioning block entirely (not patients); and
`current_web_roles()` — previously `web_access_contacts`-only — now also
derives roles straight from `account_type`, so these accounts work as WEB
admin/cskh logins too, not just mobile ones.

