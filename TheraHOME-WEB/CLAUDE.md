# CLAUDE.md

Guidance for Claude Code (and any other agent) working in this repo.

## Where the details live (docs/)

This file used to hold everything and got too long. The always-relevant core
stays here; the full chronological build log ("Status / next steps" plus
every dated feature note — quiz/upsell admin, CSKH User-tab powers, orders
table, market/language passes…) moved to **`docs/feature-notes.md`** — when
touching an existing feature, search that file for its section first; the
design rationale and gotchas are there. Backend details shared with mobile
(schema, RLS, Edge Functions) live in `TheraHOME-APP/docs/backend.md`.

## What this is

TheraHOME WEB is the browser counterpart to `TheraHOME-APP` (the Expo/React
Native companion app for TheraHOME's rehab devices — TheraNECK+/PRO,
TheraBACK+/PRO). It is a **Next.js app implementing the Admin + Customer
Care (CSKH) surfaces** — originally planned in this file, since built; see
`docs/feature-notes.md` for the full build log.

The long-term vision is a single Vietnamese-language web app with three
surfaces, matching three HTML prototypes in the design project (see below):

- **Admin** (`TheraHOME Admin.html`) — internal operations dashboard.
- **Customer Care / CSKH** (`TheraHOME Customer Care.html`) — where a human
  specialist handles the `chat/human` threads the mobile app already sends
  messages into (see "Relationship to the mobile app" below).
- **Web App** (`TheraHOME Web App.html`) — a public, customer-facing web
  version of the same experience the mobile app provides. **Out of scope for
  now.**

**This phase builds Admin + Customer Care only.** The public Web App surface
is deliberately deferred — see the access-gate design below for how the
current login flow is built to extend to it later without being reworked.

## Source of truth is a Claude Design project, not this checkout

Same arrangement as `TheraHOME-APP`: the visual/functional spec lives in the
Claude Design project **"TheraHome Design"** (projectId
`d030fe5f-c127-4d8b-8242-ea2ecf0aa2e7`), reachable through the `DesignSync`
MCP tool / `/design-sync` skill. It is a static, no-build HTML/JSX web
prototype (React 18 UMD + Babel Standalone via CDN) — not meant to run as-is,
just translated screen-by-screen.

Relevant files in that project (the Admin/CSKH ones are pulled into
`.design-reference/` here — see `docs/feature-notes.md`):

- `TheraHOME Admin.html`, `TheraHOME Customer Care.html` — the two surfaces
  this phase implements. `TheraHOME Web App.html` also exists there, for the
  later public phase.
- A shared design-system bundle: `_ds/.../_ds_bundle.js`, `styles.css`, and
  token files (`tokens/colors.css`, `tokens/radius-shadow.css`,
  `tokens/spacing.css`, `tokens/typography.css`).
- JSX sources: `admin-shared.jsx`, `admin.jsx`, `data.js`, `icons-extra.jsx`
  (Admin), and `care.jsx` (Customer Care), plus the shared files above.

When the design changes upstream, re-pull the relevant files via
`DesignSync`/`/design-sync` and diff against `.design-reference/` (frozen,
read-only, never imported) rather than re-guessing markup/tokens.

## Stack

- **Next.js (App Router)** + **TypeScript** (`strict: true`) — matches the
  mobile app's TS-strict convention. Chosen over a plain Vite SPA for room to
  grow (the later public Web App surface benefits from routing/SSR
  conventions Next already provides).
- **Backend**: the **same Supabase project as the mobile app**,
  `nyjvtvmllwbyfokldgtj` (Singapore / `ap-southeast-1`, org "TheraHOME").
  Do not create a second project — Admin/CSKH need to read and write the
  same `orders`, `chat_threads`, `chat_messages`, etc. that the mobile app
  already uses. Reuse the same env-var pattern as `TheraHOME-APP/.env`
  (Supabase URL + publishable anon key — safe to commit, RLS is what
  actually protects data).
- **Auth**: Google OAuth via Supabase Auth's **web redirect flow**
  (`supabase.auth.signInWithOAuth({ provider: 'google', options: {
  redirectTo } })`, then Supabase's own callback handling) — simpler than the
  mobile app's `expo-web-browser` session dance, since this runs in a real
  browser natively. This needs **its own** Google Cloud OAuth client (see
  Manual setup below) — the mobile app's client won't have the right
  redirect URI registered.
- **Design tokens**: no hand-written CSS values — the design system's token
  CSS files are ported to `src/design-tokens/tokens.css` (imported from
  `app/globals.css`), the same way `TheraHOME-APP/src/theme/` ported the
  same tokens once for React Native. Never hardcode a hex value.

## Auth & access flow

Google login alone is not enough to get in — same two-step shape as the
mobile app's `login.tsx` → `activate.tsx`, and **the same underlying
mechanism**, not a separate concept. (The current, authoritative access rule
is the "Current shared app-access rule" section below; the design rationale
here still applies.)

1. **Welcome screen** — animated/dynamic landing, then a **"Đăng nhập với
   Google"** entry point (mirror `TheraHOME-APP/app/(onboarding)/login.tsx`'s
   visual approach: full-bleed backdrop, brand mark, single Google button).
2. **Google sign-in** — Supabase Auth web redirect flow (see Stack above).
3. **Contact-verification gate** — after Google login, the user enters a
   **phone number or email**, checked against what's already in the
   database. This is **exactly the mobile app's pattern**
   (`activate_orders_by_contact`-style lookup against a matching Supabase
   table/RPC) — it is *not* a separate "employee login" or "staff auth"
   system. The reason to build it this way: this is the same gate the public
   Web App surface will use for ordinary customers once that phase ships
   (very likely against the mobile app's own `orders` table at that point).
   Right now the table backing this lookup simply only contains the two
   admin/CSKH contacts this phase needs — the mechanism itself is already
   general.
   - Backed by the `web_access_contacts` table (deliberately not named
     "staff"/"employee" — it will hold ordinary customer contacts too once
     the public phase ships) with `phone`, `email`, and a roles column
     (`text[]`, values like `admin`, `cskh`; a future public-customer row
     would simply have no such role). Like `orders`, it has **no direct
     client RLS access** — looked up only through a `SECURITY DEFINER` RPC
     callable by `authenticated`, so a client can't `select *` the whole
     contact list.
   - **Provisioned admins**: `khanha1k59@gmail.com` / `0395581037` and
     `hoankenny2002@gmail.com` / `0328552894`. Migration preserves any
     existing roles on these rows and ensures `admin` is present.
   - No match → access-denied state. No self-serve path — rows are added
     manually for this phase (an actual signup/provisioning flow is public
     Web App scope, not this one).
   - A contact row is bound to exactly one `auth.users` identity through
     `claimed_by_user_id`. The RPC rejects a second Google account trying to
     reuse the same phone/email. Existing staff rows are backfilled to the
     Google identity whose email matches the allow-listed email.
   - Match → session carries whatever role(s) that row has. If it has both
     `admin` and `cskh` (as the seed row does), the app shows **one app
     shell with an Admin ⇄ CSKH switcher** in the nav, not two separate
     logins or a strict per-account role split.

## Current shared app-access rule

The mobile app no longer activates access through `orders`. After Google
login it calls `claim_user_access_contact(p_contact)`: the normalized
phone/email must match at least one `orders` row, belongs to one account,
and one account owns one contact. The order is only checked, never activated
or mutated. An enabled, pre-provisioned `admin` or `cskh` contact in
`web_access_contacts` bypasses the purchase check and is bound to the first
Google identity that claims the exact contact. Both mobile and web call this
same RPC. A successful claim provisions every current product program, while database
triggers provision products/days added later. Admin's app-user list reads
`user_access_contacts`, so an OAuth login alone is not counted as an active
app user. The migration is stored in
`TheraHOME-APP/supabase/migrations/202608180001_unique_contact_catalog_access.sql`.

## Relationship to the mobile app / shared backend

Same Supabase project as `TheraHOME-APP` — a schema change here is visible
there and vice versa. The concrete integration point for the Customer Care
surface:

- `chat_threads` (`kind='human'`) / `chat_messages` — the mobile app's
  `app/chat/human.tsx` already sends real messages into these tables and
  reads replies via Realtime. The CSKH surface built here is the client
  that replies as a specialist: it inserts `chat_messages` rows with
  `sender_type='specialist'` into a user's open `kind='human'` thread
  (end-user RLS only allows `sender_type='user'` inserts — `specialist`
  rows need a service-role context).
- `specialist-presence` Realtime channel — the mobile app's
  `useSpecialistPresence()` hook (`TheraHOME-APP/src/hooks/useChat.ts`)
  shows an "online" badge only while something calls
  `channel.track({ role: 'specialist' })` on this channel. The CSKH surface
  should track presence on this channel while a specialist is actively
  staffing it, so the mobile app's existing indicator lights up for real
  instead of always showing offline.
- Admin surface data (orders, products, program content, etc.) reads/writes
  tables mobile already defines — see `TheraHOME-APP/docs/backend.md` for
  the full schema before designing any Admin screen's queries, to avoid
  inventing a parallel shape for data that already exists.

## Manual setup needed (external dashboard actions)

Same three-step shape as `TheraHOME-APP/docs/manual-setup.md`, but this
needs its **own** OAuth client — the mobile app's client is configured for
its own redirect scheme and won't work here:

1. Create a **new** OAuth client in Google Cloud Console (Web application
   type) for this web app's own redirect URI (Supabase's standard callback:
   `https://nyjvtvmllwbyfokldgtj.supabase.co/auth/v1/callback`, plus
   whatever local-dev URL Next.js runs on, both registered as authorized
   redirect URIs).
2. This can reuse the **same Google Cloud project** as mobile, and the
   **same Supabase Google provider config** — Supabase allows only one
   Google provider per project, so if the mobile app's client ID/secret is
   already set there, this app's redirect URI just needs to be added to
   that *same* Google Cloud OAuth client rather than creating a second
   provider entry. Confirm this against the mobile app's actual Google
   Cloud client before assuming a second client is even needed.

## Running the app

```
npm install
npm run dev
```

`.env.local` holds `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
(same values as `TheraHOME-APP/.env`, same Supabase project) — safe to keep
committed, RLS is what actually protects data, not key secrecy.
