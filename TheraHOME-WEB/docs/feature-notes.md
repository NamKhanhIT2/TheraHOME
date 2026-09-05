# Status log & dated feature notes

> Split out of `TheraHOME-WEB/CLAUDE.md` (2026-08-28) to keep that file
> small. Content is verbatim from the original — any "see X above/below"
> cross-reference may now live in `../CLAUDE.md` or in
> `TheraHOME-APP/docs/` (backend.md, auth-and-activation.md,
> feature-notes.md, manual-setup.md, roadmap.md).

## Status / next steps

- [x] Pull `TheraHOME Admin.html`, `TheraHOME Customer Care.html`, and the
      shared design-system bundle via `DesignSync` into `.design-reference/`
      (also pulled: `admin.jsx`, `admin-shared.jsx`, `care.jsx`, `data.js`,
      `icons-extra.jsx`, and the four token CSS files + `_ds_bundle.js`).
      **Known gap in the design source itself** (not a pull error):
      `admin-shared.jsx` references a `StaffAccountsView` component (the
      "Tài khoản nội bộ" sub-tab under Admin → User) that is never actually
      defined anywhere in the project — `SAMPLE_STAFF`/`STAFF_ROLE_META`
      data exists but the view was never built. Design it fresh when that
      tab gets built, or ask the user for direction first.
      `TheraHOME Web App.html` and its `web-*.jsx` sources also exist in the
      design project (confirmed via `list_files`) but weren't pulled this
      round — out of scope until the later public-web-app phase.
- [x] Scaffold the Next.js project (TypeScript strict, App Router, no
      Tailwind — design tokens ported to `src/design-tokens/tokens.css` and
      imported from `app/globals.css`, matching how the mobile app ported
      the same tokens into `src/theme/`). Route skeleton in place and
      verified with `next build` + `next dev`: `/` (redirects to
      `/welcome`), `/welcome`, `/verify`, `/admin`, `/care` — all currently
      placeholder UI, not the real translated screens.
      `.design-reference/**` is excluded from ESLint (it's frozen prototype
      source relying on script-tag globals like `React`/`IconX`, never
      meant to be linted/compiled as part of this app).
- [x] Migrated the contact-verification table + `SECURITY DEFINER` RPC in
      the shared Supabase project (`web_access_contacts` +
      `lookup_web_access_contact(p_phone, p_email)`, migrations
      `create_web_access_contacts` / `seed_web_access_contacts`); seeded the
      `khanha1k59@gmail.com` / `0856239030` row with `admin`+`cskh` roles.
      No client RLS policies on the table (same pattern as `orders`);
      `EXECUTE` revoked from `public`/`anon`, granted only to
      `authenticated`. Verified via direct SQL: matches by email, by plain
      phone, and by `+84`-prefixed phone (normalized through the existing
      `normalize_phone_vn`); a non-matching contact correctly returns null.
      `get_advisors` after the migration shows only the same INFO/WARN
      classes already present on `orders` and its RPCs (`rls_enabled_no_policy`,
      `authenticated_security_definer_function_executable`) — no new
      findings.
- [x] Wired Google OAuth (web redirect flow, `src/lib/googleAuth.ts`) and
      the contact-verification gate (`src/lib/webAccess.ts`'s
      `verifyWebAccessContact`, called from `/verify`) for real.
      `/welcome`'s button triggers `signInWithOAuth` → Google → back to
      `/verify`, which waits for the session (`onAuthStateChange`), then
      looks up the entered phone/email and routes to `/admin` or `/care`
      based on the roles returned. `/admin` and `/care` are now wrapped in
      `src/components/AccessGate.tsx`, which re-checks session + the
      granted roles (cached client-side after a successful verify) and
      shows an Admin ⇄ CSKH switcher + sign-out when an account holds both
      roles — as `khanha1k59@gmail.com` does. The Google Cloud OAuth client
      + Supabase provider dashboard steps below are **done** and verified
      working end to end via Supabase's `auth_logs`/`auth.users` (real
      `/authorize` → Google → `/callback` → session round trips recorded for
      `khanha1k59@gmail.com`).
      **Known simplification**: the granted roles are cached in
      `localStorage`, not a server-verified cookie — this is a client-side
      routing convenience, not a security boundary. Real data access on
      `/admin`/`/care` still has to go through the authenticated Supabase
      session + RLS on whatever tables those screens end up reading: don't
      rely on the `localStorage` flag for anything sensitive. Revisit with
      a proper server-side session (e.g. `@supabase/ssr` + middleware) if
      this ever needs to be a hard security boundary rather than a UX one.
- [x] Built the Admin shell and screens — translated `admin.jsx` +
      `admin-shared.jsx`'s views into `src/components/views/` (Dashboard,
      Lộ trình → `RoutineView`, Sản Phẩm → `ProductsView`, Thông báo →
      `NotificationsAdminView`, Cộng đồng → `CommunityView`, User →
      `UsersView`, AI Prompts → `AIPromptsView`) plus shared primitives
      under `src/components/ui/` (`Icon`, `Modal`, `Toast`, `TableShell`,
      `primitives.tsx`) and mock data ported to `src/lib/mockData.ts` /
      `src/lib/adminMockData.ts`. `admin.jsx`'s and `care.jsx`'s
      near-identical sidebar+topbar shells were unified into one
      parameterized `src/components/shell/AppShell.tsx` rather than kept as
      two duplicate copies — it also folds the Admin ⇄ CSKH switcher into
      the existing sidebar footer (via `useWebAccess()` from
      `AccessGate.tsx`, which now also exposes the real signed-in email
      instead of the design's hardcoded `admin@therahome.vn` placeholder).
      **`StaffAccountsView`** (the "Tài khoản nội bộ" sub-tab, referenced in
      `admin-shared.jsx` but never defined there — see the design-gap note
      above) is now implemented in `src/components/views/UsersView.tsx`,
      styled to match the rest but **not a translation of anything in the
      source** — revisit if the real design ever ships one.
      `next build` + `next lint` both pass clean.
- [x] Built the Customer Care shell — `care.jsx` → `ChatView` (in
      `src/components/views/ChatView.tsx`) + reused `NotificationsAdminView`
      and `UsersView role="care"` (read-only mode).
- [x] **Rewired every Admin/CSKH screen from mock data to real Supabase
      queries** (`src/lib/db.ts`), on the same shared project as the mobile
      app. What this took, beyond just swapping imports:
      - **`current_web_roles()`** (migration `web_admin_role_helper_and_columns`) —
        SECURITY DEFINER helper used inside RLS policies to check the caller's
        `web_access_contacts` roles by email; same class of
        `authenticated_security_definer_function_executable` advisor WARN as
        every other RPC in this project, already accepted there.
      - **New RLS policies** (migration `web_admin_rls_policies`) extending —
        not replacing — the mobile app's existing policies: admin-only CRUD on
        `products`/`program_phases`/`program_days`/`store_categories`/
        `store_items`/`web_access_contacts`; admin+cskh SELECT-all on
        `profiles`/`user_programs`/`user_program_days`/`pain_logs`/
        `notifications`/`chat_threads`/`chat_messages`; admin-only moderation
        on `community_posts`/`post_comments`; a second `chat_messages` INSERT
        policy for `sender_type='specialist'` (the mobile app's own policy
        only ever allowed `sender_type='user'`, so specialist replies were
        never possible before this). Verified with `get_advisors` (no new
        finding classes) and by simulating both an admin and a random
        authenticated JWT via `set local request.jwt.claims` — admin can
        read/write cross-user data and random users get exactly what
        `current_web_roles()` returning `{}` implies (none of the new access).
      - **New columns**: `profiles.app_role` + `profiles.locked` (the mock
        UsersView's phân quyền/khóa concepts had no real column before),
        `community_posts.pinned`, `web_access_contacts.disabled` (also wired
        into `lookup_web_access_contact` so a disabled contact can't pass the
        login gate).
      - **Two mock-only features dropped rather than faked**: "Thêm người
        dùng" in UsersView (app users only come from real Google sign-up in
        the mobile app, not an admin form) and "Lên lịch" (schedule-for-later)
        in Notifications (no scheduled-jobs table/worker exists).
      - **Notifications ⇒ real model shift**: the real `notifications` table
        is per-user rows, not a broadcast log, so composing one now fans out
        to one row per targeted user (`sendNotificationBroadcast`), and the
        admin list groups rows back into "campaigns" by
        `(type, title, body, created_at)` for display
        (`fetchNotificationCampaigns`).
      - **UserDrawer's pain trend** now reads that specific user's own
        `pain_logs` (real, personalized) instead of the mock's generic
        per-product illustrative curve — a genuine improvement, not just a
        like-for-like swap.
      - **Chat** reads/writes real `chat_threads`/`chat_messages`, subscribes
        to Realtime on `chat_messages` (already in the `supabase_realtime`
        publication) for live updates, and tracks Presence on
        `specialist-presence` while the CSKH Chat tab is mounted — closing
        the gap the mobile app's `useSpecialistPresence()` was built for but
        never had a real client on the other end of.
      - **Dashboard's WeekChart** is a real per-weekday computation (fraction
        of active `user_programs` with a `user_program_days` row completed
        that weekday), not illustrative mock numbers.
      - **AI Prompts stayed local-only** at this point — there was no
        `ai_prompts` table in the schema yet, so there was nothing real to
        wire it to. Wired for real later — see the 2026-08-19 entry below.
      - `next build` + `next lint` both pass clean; the live dev server
        (already running the real `khanha1k59@gmail.com` session) picked up
        every change via Fast Refresh without a restart.
- [x] **Added "Tài khoản TheraHOME" to Admin** — manages the mobile app's
      new admin-issued, password-based login method (App Review, staff,
      partners, testers; see `TheraHOME-APP/CLAUDE.md`'s "TheraHOME-issued
      accounts" section for the full design). `src/components/views/TheraAccountsView.tsx`
      reads/writes `profiles.account_type <> 'normal'` — most fields go
      straight through the authenticated client + RLS (same as
      `updateAppUser`), and only account creation / password resets call
      the new `admin-manage-account` Edge Function (needs the service role
      for `auth.admin.*`). Admin-only nav item — not added to `NAV_CARE`,
      since these rows carry a password.
- [x] **Community expansion (reports, challenges)** — mirrors the mobile
      app's Community expansion (see `TheraHOME-APP/CLAUDE.md`'s "Community
      expansion" section for the full picture). New "Báo cáo" page
      (`src/components/views/ReportsView.tsx`, Admin + CSKH per
      `content_reports`' RLS) — hide/delete reported content, lock the
      author's account, resolve/dismiss. New "Thử thách" sub-tab inside
      `CommunityView.tsx` — create/end challenges, see participant/
      completion counts. Also fixed two bugs found while touching
      `CommunityView.tsx`: the "Badge" field on official posts was captured
      but silently never persisted (replaced with a proper content-type
      dropdown feeding the existing `tag` column), and `TableShell`'s
      search/filter inputs were decorative — extended `TableShell` itself
      with optional controlled `searchValue`/`onSearchChange`/
      `filterValue`/`onFilterChange` props (benefits every view that uses
      it, not just Community/Reports).
- [x] **AI Prompts wired for real (2026-08-19)** — added `ai_prompts`
      (singleton system-prompt row) + `ai_suggested_replies` tables
      (`TheraHOME-APP/supabase/migrations/202608192000_ai_assistant_admin.sql`).
      `AIPromptsView.tsx` now does real fetch-on-mount + save via new
      `db.ts` functions (`fetchAIPrompt`/`updateAIPrompt`/
      `fetchAISuggestedReplies`/`addAISuggestedReply`/
      `deleteAISuggestedReply`) instead of local `useState` + toast-only
      fake saves. Critically, the mobile app's `chat-ai-reply` Edge
      Function was also changed to read `ai_prompts.system_prompt` live on
      every request (service-role client, bypasses RLS) instead of a
      hardcoded constant — so edits made here take effect immediately with
      no redeploy, which is what makes this wiring actually meaningful
      rather than just cosmetic. `ai_suggested_replies` backs the AI chat's
      empty-state suggestion chips on mobile (previously a hardcoded
      3-string array) — the "Phản hồi mẫu" card's add/delete actions are
      real now. Also switched `chat-ai-reply` from the Anthropic API to
      Groq's free tier (no paid API key was available) — see
      `TheraHOME-APP/CLAUDE.md`'s Edge Functions section for the provider
      details; nothing on the WEB side needed to change for that part.
- [x] **Community pin discoverability + editable notification content
      (2026-08-22)** — CSKH reported never seeing the pin-post control on
      `/care`. It existed (`togglePin`, gated on `it.official`) but lived
      in a column with an empty `""` header and rendered as a bare
      unlabeled icon, invisible unless you already knew it was there;
      `pinOnly` mode also rendered an always-empty "Thao tác" column with
      nothing under its header, adding to the "is this broken?" read.
      Fixed in `CommunityView.tsx`: the pin column now has a real "Ghim"
      header and a labeled pill button ("Ghim"/"Đã ghim", not just an
      icon); the "Thao tác" column is omitted entirely in `pinOnly` mode
      instead of rendering empty. No RPC/RLS change needed — the backend
      (`set_official_post_pinned`) already allowed both `admin` and `cskh`
      roles; this was purely a frontend visibility bug.
      Separately: composing a post with "Gửi thông báo đến người dùng"
      checked used to push the post's own title/`text.slice(0,180)`
      verbatim with no way to write a shorter/different push blurb. Added
      editable "Tiêu đề thông báo"/"Nội dung thông báo" fields (shown only
      once the checkbox is checked, prefilled from the post's title/text
      on first check but never overwritten after that) — `createOfficialPost`
      in `db.ts` now takes optional `notifyTitle`/`notifyBody` and falls
      back to the post's own title/text when left blank. `next build` +
      `next lint` both pass clean.
- [x] **"Đăng nhập bằng tài khoản TheraHOME" replaces Google as the primary
      staff login (2026-08-23)** — WEB admin/cskh access no longer has to go
      through Google + the `/verify` contact-check. `/welcome` now offers
      three entry points: Google and Apple (both OAuth, unchanged flow into
      `/verify`) and a new "Đăng nhập bằng tài khoản TheraHOME" button
      (`/thera-login`, username/password, no OAuth). Reuses the exact
      mechanism `TheraHOME-APP` already built for mobile-only admin-issued
      accounts (`profiles.account_type`, the `admin-manage-account` Edge
      Function) rather than inventing a second one — see
      `TheraHOME-APP/CLAUDE.md`'s "TheraHOME-issued accounts" section and
      migration `202608230900_thera_accounts_web_roles_and_admin_seed.sql`.
      Concretely:
      - `current_web_roles()` (the single role source read by every RLS
        policy, `admin-manage-account`, and mobile's `useWebRoles`/
        `useIsStaff`) now has a second fallback branch: if the signed-in
        user's own `profiles` row has `account_type='admin'` →
        `{admin,cskh}`, `'cskh'` → `{cskh}` (gated on not-locked/not-expired),
        on top of the pre-existing `web_access_contacts` lookup. One change,
        threads through everywhere automatically.
      - New `resolve_thera_login_email(p_username)` SQL RPC (security
        definer, granted to `anon`) — TheraHOME accounts log in with a
        plain username, not a real email; Supabase Auth still needs an
        email-shaped identifier, so every such account actually has a
        synthetic `<username>@thera.local` address under the hood
        (`profiles.username` holds the real typed value). The RPC only ever
        resolves `account_type <> 'normal'` rows, never ordinary users, to
        limit the enumeration surface. `src/lib/theraAccountAuth.ts`'s
        `signInWithTheraAccount()` calls it then `signInWithPassword`.
      - Because `current_web_roles()` resolves straight from `account_type`
        once a session exists, `/thera-login` skips `/verify` entirely —
        it just pushes to `/admin`, and the unchanged `AccessGate` self-
        corrects to `/care` for a cskh-only account.
      - **Exactly one seeded admin account**: `TheraHOME` / `TheraHOME@/123`
        (`account_type='admin'`), created directly in the migration (SQL
        insert into `auth.users`/`auth.identities` using `pgcrypto`'s
        `crypt()`, since there was no existing admin session yet to call
        the Edge Function through the normal path). A partial unique index
        (`profiles_single_admin_idx`, on `(true) where account_type='admin'`)
        makes "exactly one" a hard DB invariant, not just a UI rule; the
        `admin-manage-account` Edge Function's `ACCOUNT_TYPES` whitelist
        also excludes `'admin'` from creation. **The password lives only in
        that migration file and this note — never re-committed elsewhere.**
      - The two previously-Google-based admin contacts (`khanha1k59@gmail.com`,
        `hoankenny2002@gmail.com`) had their `web_access_contacts.roles`
        cleared to `{}` by the same migration — they're ordinary (roleless)
        contacts now, not deleted, matching this file's existing
        "future ordinary customer contact" shape.
      - `src/lib/appleAuth.ts` mirrors `googleAuth.ts` exactly
        (`signInWithOAuth({provider:'apple', ...})`) but Apple Sign-In
        itself needs its own manual Apple Developer + Supabase-dashboard
        setup (Services ID, Key, redirect URIs) before it actually works —
        not something completable from this repo alone, same caveat as
        Google's existing "Manual setup needed" section.
      - **`TheraAccountsView.tsx` (Admin → "Tài khoản TheraHOME")**: gained
        a creatable `cskh` type ("Chăm sóc khách hàng") alongside the
        existing admin_issued/review/staff/partner/tester — `'admin'` stays
        excluded from the creatable list for the reason above. The create
        form's "Username / Email" field is now plain "Username" (no more
        email framing — `admin-manage-account` derives the synthetic email
        itself), plus a "Nhập lại Password" confirm field and a show/hide
        eye-icon toggle on both password fields (new `Icon` `"eye-off"`
        case). The one seeded admin row can't have its type changed or be
        locked/deleted from this screen — losing it has no recovery path
        short of re-running the seed migration.
      - `cskh` accounts skip the Edge Function's patient-catalog
        provisioning block entirely (no `user_access_contacts`/
        `user_programs` rows) — they aren't patients; see
        `TheraHOME-APP/CLAUDE.md`'s `isStaffAccount` RootNavigator gate for
        how mobile grants them app access a different way.
      - `next build`/`npm run lint`/`npx tsc --noEmit` all pass clean.
- [x] **Fixed `<div>` inside `<tbody>` hydration error, TableShell-wide
      (2026-08-23)** — reported from creating a TheraHOME account, but the
      root cause was in the shared `TableShell` component, not that one
      screen: `TableShell` puts its entire `children` prop inside
      `<tbody>`, and four views (`TheraAccountsView.tsx`, `UsersView.tsx`,
      `CommunityView.tsx` twice — challenges and posts) were passing their
      modals as trailing children alongside the `<tr>` rows, landing every
      `Modal`'s backdrop `<div>` inside `<tbody>` — invalid HTML, and a
      hydration mismatch since the browser silently relocates it out of
      the table on the client while SSR keeps it where React put it.
      `TableShell` gained a `modals?: ReactNode` prop, rendered as a
      sibling after `</table>` instead of inside it; all four call sites
      moved their modal JSX there. Checked every other `<tbody>` user in
      the codebase (`RoutineView.tsx`, `UpsaleNotificationsView.tsx`) —
      both already render modals as proper siblings outside `</tbody>`,
      not affected. `next build`/`next lint`/`tsc` all clean.
- [x] **Fixed account creation actually failing: `admin-manage-account` had
      no CORS/`OPTIONS` handling (2026-08-23)** — the `<tbody>` fix above
      resolved the console warning, but creating a TheraHOME account still
      silently failed. Root cause was different and pre-existing:
      `admin-manage-account` (unlike `dispatch-push` and every other
      browser-called function) never had `corsHeaders` or an `OPTIONS`
      short-circuit — confirmed via `query_logs` against `function_edge_logs`,
      which showed the browser's CORS preflight getting `OPTIONS | 405`
      every time, so the real `POST` never even left the browser. This
      likely predates every change made to this function this session —
      per this file's earlier notes, no `admin-manage-account`-created
      account existed in the database until now, meaning this code path
      had apparently never been successfully exercised from a browser
      before. Fixed by adding the same `corsHeaders` +
      `if (req.method === "OPTIONS") return new Response("ok", {headers: corsHeaders})`
      pattern every other function already uses, applied to all response
      paths via `jsonResponse`. Redeployed (v15); verified the preflight
      directly with `curl -X OPTIONS` (200, was 405), and confirmed the
      seeded `therahome` admin profile is still valid
      (`account_type='admin'`, not locked, no expiry) so
      `current_web_roles()` grants it through the function's admin check.
      Also grabbed a local copy at
      `TheraHOME-APP/supabase/functions/admin-manage-account/index.ts` —
      this function had never had one before, unlike every other function
      in this project.
- [ ] (Later, separate phase) Design and build the public Web App surface
      (`TheraHOME Web App.html` / `web-*.jsx` in the design project, not yet
      pulled), extending the same contact-verification gate to real
      customer contacts instead of the admin/CSKH-only seed data.
- [x] **Modal backdrop-click bug fixed, pin-with-display-info flow, Admin
      nav trimmed (2026-08-23)** — three related changes from the same
      request, alongside a larger mobile-app-side pass (see
      `TheraHOME-APP/CLAUDE.md`'s matching entry for the "Gợi ý cho bạn"
      article card / feed truncation / store-prefetch / local-reminder
      half of this same request).
      - **Root-caused "tạo tài khoản TheraHOME đang làm dở là bị thoát ra"**
        (the create-account form silently closing mid-edit) to
        `Modal.tsx`'s backdrop: `onClick={onClose}` on the backdrop plus
        `stopPropagation` on the content div looks correct for a normal
        click, but a click/drag that *starts* inside a field (e.g.
        selecting text in the "Ghi chú" textarea) and *releases* outside
        the modal's bounds still resolves the synthetic click's target to
        the backdrop — `stopPropagation` never runs because the event
        never actually bubbles up from inside the content div in that
        case. Fixed with the standard robust pattern (used by most modal
        libraries): track whether the *mousedown* itself started on the
        backdrop in a ref, and only close on `click` if both the mousedown
        and the click resolved to the backdrop element directly
        (`e.target === e.currentTarget`). This is the shared `Modal`
        component every modal in the app uses, so the fix isn't specific
        to account creation.
      - **Pinning an official post now asks what to actually show**, per
        request ("cskh khi tích chọn 1 bài để ghim cần phải chọn thêm
        thông tin hiển thị"). `community_posts` gained 3 nullable columns
        — `pinned_title`, `pinned_content`, `pinned_thumbnail_url` — and
        `set_official_post_pinned` (the existing SECURITY DEFINER RPC that
        already enforces "only one official post pinned at a time") now
        takes 3 more optional params and sets them alongside `pinned`
        (only when pinning — unpinning leaves them as-is, they're just
        inert while unpinned). The old 2-arg overload was dropped rather
        than left alongside the new 5-arg one — PostgREST resolves an RPC
        call by matching the JSON body's keys against parameter names, and
        with the 3 new params all defaulted, a call passing only
        `p_post_id`/`p_pinned` would otherwise match *both* overloads
        ("function is not unique"). `CommunityView.tsx`'s `togglePin` now
        branches: unpinning still calls the RPC directly with no prompt,
        but pinning opens a new `PinDisplayModal` first — prefilled from
        the post's own title/text/image (a sensible starting point,
        editable), with an optional thumbnail upload
        (`uploadPostThumbnail`, reusing the mobile app's `community-images`
        Storage bucket under the signed-in staff account's own
        `auth.uid()` — its existing RLS already permits that, no bucket
        change needed) or a pasted URL as a fallback. Both `admin` and
        `cskh` go through this same modal — `CommunityView`'s `pinOnly`
        prop (used by `/care`) only hides the *other* moderation actions
        (edit/hide/delete), pinning was already available to both roles
        via the RPC's own role check.
      - **Removed "Cộng đồng" from Admin's sidebar** (`NAV_ADMIN` in
        `adminMockData.ts`, the `community` case in `app/admin/page.tsx`,
        and the matching quick-link in `DashboardView.tsx`) — per explicit
        request. `NAV_CARE` (CSKH's nav) keeps it unchanged: CSKH's
        `CommunityView` usage was already scoped via `pinOnly` and is
        where the new pin-with-display-info flow above actually lives, so
        removing it there would have broken the very feature this request
        also asked for.
      `next build`/`npm run lint`/`tsc` all clean after every step;
      re-verified via `get_advisors` that the two new/changed RPCs show
      only the same class of expected "SECURITY DEFINER callable by
      authenticated" advisory every other self-scoped RPC in this project
      already shows (e.g. `complete_day`, `touch_last_login`) — not a new
      class of issue.
- [x] **Full admin review, requested after account creation "filled
      everything but couldn't create" (2026-08-23)** — the Modal fix two
      entries above turned out to only cover part of it. Diagnosed with
      `query_logs`: the account-creation `POST` was reaching
      `admin-manage-account` and getting a genuine **401**, not the earlier
      CORS 405. Reproduced directly with `curl` (signed in as the seeded
      `therahome` admin, called the function with a real access token +
      apikey header) — that call succeeded (reached "Unknown action" for a
      bogus action, proving the auth/role check itself is fine), which
      ruled out the function and pointed at the browser-side session
      instead. Two real bugs found, both fixed:
      - **`db.ts`'s `createTheraAccount`/`resetTheraAccountPassword` were
        silently discarding the actual failure reason.**
        `supabase.functions.invoke()` sets `error` to a `FunctionsHttpError`
        for any non-2xx response, and that error's `.message` is *always*
        the same hardcoded string ("Edge Function returned a non-2xx status
        code") — never the JSON body the function actually sent back
        (`"username_already_registered"`, `"invalid_username"`, or, in this
        case, `"Missing Authorization header"`). The real body only exists
        on `error.context` (the raw `Response`), which nothing was reading.
        So every distinct failure reason from this function — including a
        stale/expired session, indistinguishable from a real validation
        error — collapsed into the same generic "Không thể tạo tài khoản."
        toast. Fixed with a shared `invokeAdminManageAccount()` helper that
        reads `error.context.clone().json()` and throws the real message
        when present, falling back to the generic error only if the body
        genuinely isn't JSON.
      - **A stale session had no visible symptom until an action failed.**
        Supabase access tokens expire (~1h); if a background refresh
        silently fails (revoked refresh token, or a backgrounded tab having
        its refresh timer throttled long enough to matter — plausible for
        a long, many-field form like account creation), supabase-js fires
        `SIGNED_OUT` on its own, but `AccessGate` only ever checked the
        session *once*, on mount — nothing reflected the session going bad
        afterward, so the UI kept rendering as if signed in until the next
        action failed with a bare auth error. Fixed by adding an
        `onAuthStateChange` listener in `AccessGate` that redirects to
        `/welcome` the moment `SIGNED_OUT` fires, turning a confusing
        silent failure into an ordinary re-login prompt — this is a page
        wide fix, not specific to account creation. `TheraAccountsView`
        also special-cases the "Missing Authorization header" message
        specifically (now reachable thanks to the `db.ts` fix) with a clear
        toast + immediate sign-out, as defense in depth for the narrow
        window before the proactive listener catches it.
      - **Found the same backdrop-click bug fixed in `Modal.tsx` earlier,
        duplicated in `UsersView.tsx`'s `UserDrawer`** — a hand-rolled
        overlay (predates `Modal.tsx`) with the identical
        `onClick={onClose}` + child `stopPropagation()` pattern, same
        mousedown-tracking fix applied.
      - **Read through every other admin/CSKH view**
        (AIPromptsView/ChatView/DashboardView/NotificationsAdminView/
        ProductsView/ReportsView/RoutineView/UpsaleNotificationsView, plus
        re-checking CommunityView/TheraAccountsView) looking for the same
        two bug classes (swallowed edge-function errors, hand-rolled
        backdrop-click overlays) and anything else obviously broken —
        `admin-manage-account` was the only function with response-parsing
        logic to get wrong (the three `dispatch-push` call sites are
        deliberately fire-and-forget), and `UserDrawer` was the only
        duplicated backdrop pattern. Nothing else stood out.
      `next build`/`npm run lint`/`tsc` all clean after every step.
    - **CSKH's "Cộng đồng" tab (`CommunityView.tsx`, rendered `pinOnly` from
      `app/care/page.tsx`) split into two genuinely separate lists instead
      of one filterable list (2026-08-24)**: previously a `TableShell`
      dropdown filter (`AUTHOR_FILTERS`: "Tất cả"/"Bài của
      TheraHOME"/"Bài của người dùng") mixed both kinds of post in one
      table by default. Replaced with a second row of pill-tabs (same
      visual pattern as the existing "Bài viết"/"Thử thách" `subTab`
      switcher just above it) — "Từ TheraHOME" / "Khác" — backed by new
      `authorTab` state; there's no "all" option anymore, matching the
      explicit "tách ra, đừng để trong cùng 1 danh sách" (separate them,
      don't keep them in one list) request. The underlying data/filter
      predicate was already correct (`it.official`, from
      `community_posts.is_official`) — only the UI and default state
      changed. The "Đăng bài viết mới" action button and the table
      subtitle are now conditional on `authorTab === "official"`, since
      composing a new official post doesn't make sense while browsing the
      "Khác" (regular app-user posts) list.
    - **Investigated, deliberately left unchanged: CSKH's Chat list only
      shows patients who have opened the mobile Chat tab at least once**
      (`fetchChatThreads()`, `db.ts:886-931`, filters `chat_threads` where
      `kind='human'` — a thread already exists with zero messages the
      moment a patient opens `chat/human.tsx` in the app, shown here as
      "Chưa có tin nhắn", so this is "never opened chat," not "hasn't sent
      a message yet"). Confirmed this isn't a one-line query fix either:
      RLS on `chat_threads` gives admin/cskh `SELECT`/`UPDATE` on every
      row but no `INSERT` for a `user_id` that isn't their own
      (`"own chat_threads"` policy requires `user_id = auth.uid()`), so
      CSKH has no way to proactively start a thread with a patient who's
      never opened Chat even if the list itself were widened. Asked the
      user whether to build this (new RLS + a "browse all patients" UI) —
      confirmed **not** wanted; current behavior is correct as-is.

## Market content (VN/UK/ML) vs. UI language, separated for real (2026-08-24)

Large cross-repo pass — see `TheraHOME-APP/CLAUDE.md`'s entry of the same
name for the full data-model reasoning (per-market columns on
`program_days`, `group_key`-grouped `store_items`/`store_categories`,
`target_markets` on `community_posts`, `language` on
`system_notification_templates`, language variant columns on
`upsell_campaigns`). This entry covers the WEB-side admin UI changes only.

Removed the global market `<select>` from `AppShell.tsx` (`therahome:
admin-market` localStorage key and all) — its only consumer was
`ProductsView`, and the whole point of this pass was to stop making staff
pick one country and edit it in isolation. New shared `PillTabs`
(`src/components/ui/primitives.tsx`) — same pill-button convention already
used ad hoc throughout Admin (product switcher, `subTab` rows) — is what
every new market/language tab switcher below is built from, instead of
each view hand-rolling its own.

- **`ProductsView.tsx`** fully rewritten: was market-scoped (`{ market }`
  prop from the removed selector, one flat list per market). Now lists
  `group_key`-grouped products/categories (one row per conceptual
  product, not per market-row) via new `fetchStoreCategoryGroups()`; the
  edit modal has VN/UK/ML tabs and creates/updates up to 3
  `store_items`/`store_categories` rows at once (`saveStoreItemGroup`/
  `saveStoreCategoryGroup` in `db.ts`), all 3 required before save. The
  old single-market `createStoreCategory`/`createStoreItem`/
  `updateStoreItem`/`deleteStoreItem` functions were removed (only this
  view used them); `fetchStoreCategories(market)` itself is unchanged and
  still used by `RoutineView.tsx` for its VN product-link lookup.
- **`RoutineView.tsx`**: day-edit modal's Video/Support-tools fields
  became 3 tabbed sets (VN/UK/ML), all-3-required-or-all-empty (a rest day
  can have no video at all, but can't have it for only some markets).
  `ProgramDay.video`/`.supportToolsUrl` (`mockData.ts`) changed shape from
  a single string to a new `MarketContent { vn, us, malay }` type.
- **`CommunityView.tsx`**: "Đăng bài viết mới" compose modal gained a
  VN/UK/ML checkbox row (VN always included via the existing title/text
  fields; checking UK/ML reveals its own required title+text pair and
  adds it to the post's `target_markets`) — per explicit clarification,
  this is optional/targeted, not "always fill 3" like Products/Routine.
- **`NotificationsAdminView.tsx`**: template edit modal gained VN/EN/MS
  tabs; `SystemNotificationTemplate` reshaped from one flat
  `{title,body}` per key to `byLanguage: Partial<Record<...>>` grouping
  the now-multiple `(template_key, language)` rows per key.
- **`UpsaleNotificationsView.tsx`**: each scheduled day in the compose
  form gained its own VN/EN/MS tabs (optional per language) —
  `dispatch-upsell-campaigns` (redeployed) resolves each recipient's
  `profiles.language` and sends their matching variant at send time,
  falling back to the base VN/default text.

`npx tsc --noEmit`/`npm run lint`/`npm run build` all clean throughout and
at the end of the pass.

## Market/language pass — closing the push-notification gap (2026-08-24)

Follow-up to the previous entry's acknowledged gap: `dispatch-push`'s
`broadcast` mode (used by `createOfficialPost`'s optional "Gửi thông báo")
sent one flat message to every user regardless of the post's own
`target_markets` — a UK-only article's push notification was reaching VN
users too, who couldn't even see the linked post. See `TheraHOME
APP/CLAUDE.md`'s entry of the same name for the edge function's side of
this fix (now filters recipients by `profiles.language`-derived market and
optionally personalizes text per language, redeployed).

`createOfficialPost` (`db.ts`) now passes the post's own
`targetMarkets`/`titleUs`/`titleMalay` through to `dispatch-push`, plus 4
new optional inputs (`notifyTitleUs`/`notifyBodyUs`/`notifyTitleMalay`/
`notifyBodyMalay`) giving the push blurb the same "defaults to the post's
own market content, editable" relationship the existing VN
`notifyTitle`/`notifyBody` already had. `CommunityView.tsx`'s compose
modal's notification section reuses the same `PillTabs` VN/UK/ML switcher
already added to the post-content section above it (only shown once a
market checkbox is checked) — UK/ML notification text is optional, falls
back to that market's own post title/text when left blank.

`npx tsc --noEmit`/`npm run lint`/`npm run build` all clean.

## Quiz + phase-unlock admin (2026-08-26)

WEB-side half of the mobile app's new "quiz at end of phase, then a
promo/unlock screen" feature — see `TheraHOME-APP/CLAUDE.md`'s entry of the
same name for the full data-model/mobile picture (`quiz_questions`,
`phase_promos`, `phase_purchases`, `verify-apple-purchase`).

`RoutineView.tsx` gained a "Giai đoạn · Quiz &amp; Upsell" section listing
each product's phases with a "Quản lý Quiz &amp; Upsell" button per phase,
opening the new `PhaseContentModal.tsx` (VN/EN/MS `PillTabs` question
editor — question text + 2–6 options + correct-answer radio, matching the
`content jsonb` shape mobile reads — plus a promo-content form for both the
cross-sell card and the IAP-unlock card, including an `apple_product_id`
field and image upload via a new `uploadPhasePromoImage()` reusing the
existing `store-images` Storage bucket, no new bucket/RLS needed since that
bucket's policies are role-scoped, not path-scoped).

`ProgramPhase` (`mockData.ts`) gained an `id` field — previously admin only
ever kept the phase *name* around (day-edit dropdown matched a day to a
phase by name), which wasn't enough to key `quiz_questions`/`phase_promos`
lookups by; `fetchRoutineProducts()` now threads `program_phases.id`
through.

`npx tsc --noEmit`/`npm run lint`/`npm run build` all clean.

## "Tài khoản nội bộ" removed, CSKH's User tab gained edit powers (2026-08-26)

Per explicit request: the "Tài khoản nội bộ" sub-tab in `UsersView.tsx`
(reading/writing `web_access_contacts` — the original Google-login-bound
staff table) was redundant with **"Tài khoản TheraHOME"**
(`TheraAccountsView.tsx`, `profiles.account_type`), which is the actually-used
mechanism today (see the 2026-08-23 entry above — `web_access_contacts`
roles were already cleared to `{}` by that migration). Removed the `subTab`
state, tab-switcher buttons, `StaffAccountsView`/`StaffModal` components, and
the now-dead `fetchStaff`/`createStaffContact`/`toggleStaffDisabled`
(`db.ts`) + `StaffMember`/`StaffRole`/`STAFF_ROLE_META` (`adminMockData.ts`).
**`web_access_contacts` itself and `current_web_roles()`'s first-branch check
on it are untouched** — still live plumbing, just no UI to manage it; a row
would need direct SQL to add one now.

Separately, CSKH's "User" tab was read-only (banner: "Chế độ chỉ xem"),
showing only name/area/day/adherence/status. Per request, both Admin and
CSKH can now view **and edit** a user's email, phone, and roadmap phase —
plus view their orders — from the same `UserDrawer`. Deliberately still
admin-only: role (`permRole`)/lock toggle and removing a product
(`deleteUserProgram`) — those stayed gated on `!readOnly`, only the three new
capabilities below were opened to both roles per the actual request.

New `UserDrawer` sections (both roles):
- **"Thông tin liên hệ"** — editable email/phone inputs, saved via new
  `updateUserContact()` → `admin_update_user_contact(p_user_id, p_email,
  p_phone)` RPC (SECURITY DEFINER, gated on
  `current_web_roles() && array['admin','cskh']`). Deliberately narrow —
  only touches `profiles.email`/`.phone`, not the general "admin update any
  profile" RLS policy, so cskh doesn't gain write access to
  `account_type`/`app_role`/`locked`/etc. Doesn't touch
  `user_access_contacts` (the claimed-contact record used for order
  matching) — this is just correcting the profile's own contact fields.
- **"Đơn hàng đã đặt"** — read-only list from new `fetchUserOrders()` →
  `admin_fetch_user_orders(p_user_id)` RPC. `orders` has zero client RLS by
  design (same as `lookup_order`), so this had to go through a new
  SECURITY-DEFINER RPC rather than a direct `.from("orders")` query; matches
  by the user's `user_access_contacts.normalized_value` against
  `orders.phone`/`.email` (both already stored normalized — same comparison
  `claim_user_access_contact`/`activate_orders_by_contact` already rely on).
- **Phase selector on each "Sản phẩm sở hữu" row** — `fetchUserPrograms()`
  now also fetches `program_phases` and derives each program's
  `currentPhaseId`/`currentPhaseName` (`day_start <= current_day <=
  day_end`) plus the full phase list for that product. Picking a different
  phase + "Chuyển giai đoạn" calls new `setUserProgramPhase()` →
  `admin_set_user_phase(p_user_program_id, p_phase_id)` RPC. Went through an
  RPC rather than a new UPDATE RLS policy on `user_programs` (neither admin
  nor cskh had one) specifically so it could also reconcile
  `user_program_days.status` in the same transaction (days before the new
  phase → `done`, the phase's first day → `current`, days after → `locked`)
  — mirrors the done/current/locked bookkeeping `complete_day` already does
  for the mobile app's own day-by-day flow, instead of leaving `current_day`
  out of sync with per-day status the way a bare column UPDATE would.

All three new RPCs: `revoke ... from public` + explicit `revoke ... from
anon` (schema-level default privileges otherwise still grant `anon` EXECUTE
on new `public` functions — confirmed via `has_function_privilege`, same as
`get_default_product_for_contact`'s pre-existing advisor WARN), `grant ...
to authenticated`. `get_advisors` shows only the same
`anon_security_definer_function_executable`/
`authenticated_security_definer_function_executable` WARN classes already
accepted throughout this project — not a new class of finding.

`npx tsc --noEmit`/`npm run lint`/`npm run build` all clean.

## Orders table + admin phase activation in the User drawer (2026-08-26)

Follow-up to the 2026-08-26 CSKH user-management entry above, per explicit
request: the "Đơn hàng đã đặt" list is now a real `<table>` (Sản phẩm /
Trạng thái / Ngày đặt columns) instead of stacked cards. More importantly,
"Chuyển giai đoạn" now actually **unlocks** a payment-gated phase, not just
moves `current_day` into it — `admin_set_user_phase` (SQL) was extended: if
the target phase has `phase_promos.apple_product_id` set and the user has
no existing non-revoked `phase_purchases` row for it, the RPC inserts one
(`platform = 'admin_granted'`, distinct from a real `'ios'` IAP purchase so
it's identifiable later). Without this, moving a user's `current_day` into
a gated phase would leave them stuck — mobile's `roadmap.tsx` force-locks
every day of a phase that has `apple_product_id` set and no purchase,
regardless of `current_day`, so the two states (progress moved forward,
paywall still up) would otherwise directly contradict each other.

`fetchUserPrograms()` now also joins `phase_promos`/`phase_purchases` to
compute `requiresPayment`/`purchased` per phase (`db.ts`'s `UserProgramPhase`
gained both fields) — the phase `<select>` options show "(cần kích hoạt trả
phí)" / "(đã kích hoạt trả phí)" per phase, the current phase gets an
amber/green badge, and the move button relabels to "Chuyển & kích hoạt giai
đoạn" when the selected target actually needs the grant.

`npx tsc --noEmit`/`npm run lint`/`npm run build` all clean. `get_advisors`
shows no new finding classes.


## Paywall content editor in the phase Quiz & Upsell modal (2026-08-30)

WEB half of the mobile paywall redesign (see `TheraHOME-APP/docs/
feature-notes.md`, same date): `PhaseContentModal.tsx`'s promo tab's unlock
card was renamed "Màn paywall mở khoá giai đoạn" and gained fields for
badge, title, subtitle, benefits (textarea, one per line — stored as a
jsonb string array), package name, package description, and a fallback
display price. `db.ts`'s `PhasePromoAdmin`/`fetchPhasePromo`/
`savePhasePromo` extended to match (`unlockBenefits` is newline-joined text
in the admin type, split/joined at the DB boundary). Empty fields save as
NULL and the app shows its built-in defaults.

## Phase-promo image uploads are downscaled client-side (2026-08-30)

`uploadPhasePromoImage` (`db.ts`) now runs the file through a new
`downscaleImage` helper before upload: longest edge capped at 1600px,
PNG→WebP (keeps alpha; stays PNG on browsers whose canvas can't encode
WebP), others→JPEG at 0.82 quality, falling back to the original bytes on
any failure or when re-encoding didn't actually shrink the file. The
pre-check limit rose to 15MB (big originals get compressed instead of
rejected) while the post-compression cap stays 5MB. Fixes the mobile
paywall's slow hero load from multi-MB admin uploads.

## Community moderation queue in CSKH/Admin Community view (2026-08-31)

WEB half of the mobile post-moderation feature (see
`TheraHOME-APP/docs/feature-notes.md`, same date). `db.ts`:
`fetchCommunityPosts` now returns `status`
(pending/approved/rejected) and `setCommunityPostStatus()` updates it
(the DB trigger notifies the author). `CommunityView.tsx`: the "Khác"
(user posts) tab shows a "· N chờ duyệt" counter, pending posts sort to
the top with a "Chờ duyệt" badge ("Không duyệt" for rejected), and the
actions column gains approve (green check) / reject (red X) buttons for
pending posts (re-approve available on rejected ones). Both Admin and
CSKH can moderate — a new RLS policy grants CSKH post updates.

## Store-item + pinned-thumbnail uploads now downscaled (2026-08-31)

`uploadStoreItemImage` and `uploadPostThumbnail` (db.ts) run through the
same `downscaleImage` helper as phase-promo images (max edge 1600px,
WebP/JPEG re-encode, original kept on failure; 15MB pre-check / 5MB
post-compression cap). Mobile's Store tab and Home's pinned card were
loading multi-MB admin originals. Previously-uploaded images stay heavy
until re-uploaded through admin.

## Public /privacy and /terms pages (2026-08-31)

App Store Connect requires a publicly reachable privacy-policy URL, so the
web app now serves the mobile app's legal documents at
https://ad.therahomeai.com/privacy and /terms — static server-rendered
pages (app/privacy, app/terms → src/components/LegalPage.tsx), no auth,
outside every AccessGate. Content lives in src/lib/appLegalContent.ts, a
copy of TheraHOME-APP/src/lib/legalContent.ts (source of truth — keep in
sync; header comments in both files say so). Compared against
workoutinc.net's policies before publishing: ours already covers
everything theirs does plus third-party-AI processing and cross-border
transfer, so nothing was borrowed. Deployed via the normal Vercel push;
verified live (200 + section 5.1 present). The legal entity placeholders
("[Tên pháp nhân…]") still need filling before App Store submission.

## 3-market coverage audit + phase-promo translations (2026-09-01)

Audit per explicit request ("các tab admin/cskh quản lý được nội dung 3
thị trường"): Routine/Products (market dropdown + 3-market forms), Quiz
(vi/en/ms), system notification templates (vi/en/ms), Upsale campaigns
(vi + optional en/ms with VN fallback) and Community official posts
(VN + optional US/MALAY variants) were already covered. The one gap was
`phase_promos` (upsell card + paywall): single-language columns, so
UK/ML users saw Vietnamese. Fixed via a `translations` jsonb column
(migration `202609011100_phase_promo_translations`, keys = language →
snake_case column; images + apple_product_id stay shared) — the
PhaseContentModal Upsell editor gained VN/EN/MS tabs (empty field =
falls back to VN; placeholder shows the VN value), db.ts got
parse/serializePromoTranslations. Mobile merges in `usePhasePromo`.
Known remaining single-language content, deliberately out of scope:
`products.name`/`program_phases.name` (mobile hardcodes en/ms for the
seeded catalog in `src/lib/adminContent.ts` — a renamed/new product
shows its VN name in all languages) and `articles` (mobile ships static
vi/en/ms arrays in mockData.ts, no admin tab at all).

## Auto-draft EN/MS translations on admin authoring (2026-09-04)

Per explicit request: staff writes VN only; on save, empty EN/MS variants
are machine-drafted (Groq, same account as chat-ai-reply) and stored in the
SAME slots the app already reads — so an untouched draft simply ships, and
staff can refine it later in the existing VN/EN/MS tabs. New Edge Function
`translate-content` (verify_jwt + admin/cskh check against
web_access_contacts, source in
TheraHOME-APP/supabase/functions/translate-content/) + `src/lib/translate.ts`
helper (`translateDrafts` — resolves null on any failure so saving never
blocks). Wired into: PhaseContentModal (quiz questions + upsell
translations), CommunityView official-post composer (UK/ML variants no
longer block publish when empty — they auto-draft, incl. notify blurbs),
UpsaleNotificationsView (per-day EN/MS, batched 15 days/call). URLs and the
fallback price label are never auto-translated. Toasts say "đã tự dịch
nháp" so staff knows to review. Requires GROQ_API_KEY to be set; without it
everything saves VN-only exactly as before.

## Sửa nhắm thị trường + ghim theo quốc gia + mở tab Cộng đồng cho Admin (2026-09-04)

Ba việc theo yêu cầu:

**1. Bug: bài đăng cho UK vẫn tới người dùng VN.** Composer luôn ép VN vào
danh sách: `targetMarkets: extraMarkets.length ? ["VN", ...extraMarkets]`
— nên không có cách nào đăng riêng cho UK/ML. Nay có 3 checkbox VN/UK/ML
(VN mặc định tick, bỏ tick được); tick đủ 3 => gửi null (mọi thị trường,
kể cả thị trường thêm sau); bỏ hết => chặn kèm toast. Dữ liệu cũ: 2 bài
"relax in 5 minutes" (nội dung 100% tiếng Anh) đang là {VN,US} đã đổi về
{US}. Kiểm chứng bằng cách mô phỏng bộ lọc feed: VN 7 bài, US 9, MALAY 7.

**2. Ghim theo quốc gia.** `set_official_post_pinned` trước đây bỏ ghim MỌI
bài official khác => một slot ghim toàn cầu, ghim bài UK là VN mất bài
ghim. Migration `pin_per_market`: chỉ bỏ ghim những bài có thị trường CHỒNG
LẤN (target_markets NULL = mọi nơi nên vẫn đá tất cả). Giờ VN/UK/ML mỗi
thị trường giữ được bài ghim riêng. Mobile không cần sửa — feed đã lọc
theo thị trường trước khi tìm bài pinned. Danh sách bài trên admin nay có
badge thị trường (trước đó không hiển thị ở đâu cả).

**3. Mở tab "Cộng đồng" cho Admin.** `ChallengesAdminView` đã code xong
nhưng KHÔNG có đường vào: CommunityView chỉ mount ở CSKH với `pinOnly`,
mà chế độ đó lại ẩn đúng tab Thử thách; NAV_ADMIN không có mục Cộng đồng.
Thêm `{ id: "community" }` vào NAV_ADMIN + mount `<CommunityView />`
(không pinOnly) ở app/admin/page.tsx. Hợp với RLS: policy "web admin
manage challenges" vốn chỉ cho role admin ghi.

## Sản Phẩm: xoá theo từng thị trường, tab trống = không bán (2026-09-05)

Thùng rác giờ chỉ gỡ nhóm/sản phẩm khỏi thị trường ĐANG XEM (checkbox
"Xoá ở mọi thị trường" nếu cần). Luật "điền đủ 3 thị trường" bị bỏ: tab để
trống = không bán ở đó; tab đã có dữ liệu mà bỏ trống thì bị từ chối và
chỉ về thùng rác. Chi tiết + lý do trong
`TheraHOME-APP/docs/feature-notes.md` (mục cùng ngày) — cùng ngày, app
đổi sang lấy thị trường theo `profiles.country` thay vì ngôn ngữ.

## Đăng bài Cộng đồng chỉ cho một số quốc gia (2026-09-05)

Composer đã cho bỏ tick VN từ 04/09, nhưng phần "Tiêu đề/Nội dung (VN)"
vẫn BẮT BUỘC nên muốn đăng bài chỉ cho UK vẫn phải gõ một bản tiếng Việt
không ai đọc. Giờ: VN không tick → phần VN được bỏ trống (nhãn đổi thành
"có thể bỏ trống"), bản UK/ML điền đầu tiên trở thành nội dung gốc (DB bắt
buộc `text`; app dùng gốc làm fallback cho thị trường chưa có bản riêng).
Tick thêm thị trường khác mà chưa điền → dịch nháp từ bản gốc đó. Thông
báo đẩy cũng lấy tiêu đề/nội dung thông báo của bản gốc nếu phần VN trống.
Ảnh chụp chủ sở hữu gửi là bản Vercel cũ ("Cũng hiển thị bản riêng cho…") —
production chưa nhận các commit trên nhánh feature.

## Đăng bài: ghim ngay khi đăng; push đúng ngôn ngữ/thị trường (2026-09-05)

Composer có ô "Ghim bài lên đầu Cộng đồng ngay khi đăng". `createOfficialPost`
trả về id bài. Bug lớn hơn nằm ở server: `dispatch-push` cũ bỏ qua
`targetMarkets/titleUs…` mà composer gửi từ 04/09 → push tiếng Việt cho mọi
người; đã viết lại (v26) — chi tiết ở `TheraHOME-APP/docs/feature-notes.md`.

## Cộng đồng: bài dài không còn chiếm cả màn (2026-09-05)

Ô Nội dung in nguyên văn bài → một bài dạng blog đẩy mọi hàng khác ra khỏi
màn. Giờ clamp 3 dòng (`-webkit-line-clamp`), giữ xuống dòng, nút "Xem
thêm / Thu gọn" theo từng hàng (state `expandedIds`); chỉ hiện nút khi bài
> 180 ký tự hoặc > 3 dòng. Ô nội dung rộng tối đa 420px, căn trên.

## CSKH xoá được bài TheraHOME (2026-09-05)

Trước đây chủ ý chỉ cho CSKH xoá bài thành viên (RLS `NOT is_official` +
UI ẩn nút). CSKH đã được đăng và sửa bài chính thức nên chặn xoá là lệch;
đổi policy thành "web cskh delete any post" (migration
202609051200) và bỏ điều kiện ẩn nút. Xoá bài cascade sang bình luận,
cảm xúc, lưu, và dòng hộp thư thông báo — vẫn qua hộp xác nhận.

## Ghim theo thị trường, sửa bài đủ 3 thị trường (2026-09-05)

Modal Sửa bài chỉ ghi được bản VN (bản UK/ML sau khi đăng là không sửa được),
và modal Ghim không cho chọn ghim ở quốc gia nào — thẻ ghim lại dùng chung
một bộ cột cho cả 3 thị trường. Đã sửa cả 3 tầng; chi tiết + kịch bản kiểm
chứng ở `TheraHOME-APP/docs/feature-notes.md` mục cùng ngày.

## Cộng đồng chuyển sang CSKH, bỏ bản rút gọn (2026-09-05)

NAV_ADMIN mất "Cộng đồng" và "Khảo sát & Giao dịch"; NAV_CARE nhận cả hai.
CommunityView bỏ prop `pinOnly` — CSKH giờ dùng bản đầy đủ (bài viết +
Thử thách). Kèm migration nới policy `challenges` từ admin-only sang
admin+cskh, nếu không tab Thử thách sẽ không đọc/ghi được.

## Rà soát toàn diện (2026-09-05, chiều)

Chi tiết đầy đủ ở `TheraHOME-APP/docs/feature-notes.md` mục cùng tên. Phía
web: modal Sửa bài không còn chặn bài cũ thiếu bản UK/ML; link sản phẩm ở
Lộ trình key theo products.id và chỉ ghi row VN, không bao giờ ghi ""; Lộ
trình hiện đủ 28 ngày; UsersView bỏ "/14" cứng và bộ lọc "Tạm dừng" chết;
chat ký URL ảnh theo lô; sửa target markets đối chiếu pin; bình luận ẩn
có badge + bỏ ẩn; hủy Upsale/lưu prompt/khoá tài khoản báo đúng kết quả;
onboarding tạo được bản ngôn ngữ thiếu; quiz đồng bộ số option 3 ngôn ngữ;
đăng bài báo khi push lỗi; nav parent "notifications-group"; lint 0 error.

## Lộ trình tách khỏi Sản phẩm; xuất bản/ẩn/xoá độc lập (2026-09-05)

App không còn đọc "nhóm chính" của Cửa hàng để quyết định lộ trình nào
hiện; đọc `products.roadmap_published` do tab Lộ trình quản. Tab có badge
trạng thái, bảng sẵn-sàng video theo thị trường, Xuất bản/Ẩn/Xoá (xoá bị
chặn khi đã có khách), sửa tên giai đoạn VN, và khoá "Đang mở bán" cho giai
đoạn thiếu/lặp video. Chi tiết ở `TheraHOME-APP/docs/feature-notes.md`.

## Xoá hẳn 3 lộ trình nháp; Xoá không còn chặn theo khách (2026-09-05, tối)

Chủ sở hữu chốt: chỉ còn TheraNECK+. Migration `202609051700` chuyển FK
`user_programs.product_id` sang CASCADE (kèm pain_logs/ngày/quiz), rồi xoá
neck-pro / back-plus / back-pro. `deleteRoutineProduct` chỉ còn chặn khi
sản phẩm đã có `orders` (`has_orders`); confirm xoá hiện số tài khoản sẽ
mất tiến trình (`countRoadmapOwners`). Tab Kích hoạt đọc cùng bảng
`products` nên danh sách sản phẩm luôn khớp tab Lộ trình. Chi tiết ở
`TheraHOME-APP/docs/feature-notes.md`.

## Giai đoạn: thêm/sửa/xoá; bảng sẵn sàng theo 1 thị trường (2026-09-05, tối)

**Yêu cầu chủ sở hữu:** (1) cho thêm/sửa/xoá giai đoạn — hiện mới làm 14
ngày nên phải bỏ được giai đoạn 3; (2) đang chọn thị trường VN mà bảng vẫn
hiện UK/ML thì rối, các thị trường quản lý độc lập.

**db.ts:** `createProgramPhase` / `updateProgramPhase` / `deleteProgramPhase`
/ `fetchPhaseDeleteImpact` / `reassignDaysToPhases`. `updateProductInfo` nhận
thêm `totalDays` (con số app đếm tới: "NGÀY 12 / 14").

**RoutineView:**
- Thẻ Giai đoạn có nút Thêm giai đoạn, mỗi dòng có bút sửa + thùng rác, hiện
  số ngày đã tạo và tên UK/ML. Modal sửa: tên VN/UK/ML + ngày bắt đầu/kết
  thúc; chặn trùng tên (vì `createProgramDay` tra giai đoạn theo tên) và
  chặn trùng khoảng ngày.
- Xoá giai đoạn: confirm nêu rõ số ngày tập, số lượt mua và số lượt khảo sát
  sẽ mất (tất cả đều CASCADE từ `program_phases`).
- Ngày lệch khoảng giai đoạn → hiện cảnh báo + nút "Gán lại ngày theo khoảng
  giai đoạn" (`reassignDaysToPhases`), không tự đổi ngầm.
- Bảng sẵn sàng video chỉ hiện thị trường đang chọn ở đầu trang. Confirm
  Xuất bản mới là nơi nêu tên thị trường còn thiếu/lặp video.
- Ô "Nội dung theo thị trường" trong modal Ngày bỏ ràng buộc điền đủ cả 3 —
  lưu riêng từng thị trường được; thêm nút "Dùng link này cho cả 3 thị
  trường" (hợp với cách dùng 1 link YouTube auto-dubbing cho mọi thị trường).
- Modal "Sửa thông tin" bỏ khối tên giai đoạn (đã có editor riêng), thay bằng
  ô Thời lượng lộ trình.

## Chọn quốc gia khi tạo tài khoản TheraHOME (2026-09-05, tối)

Tài khoản do Admin cấp (App Review, tester, đối tác…) không đi qua màn chọn
quốc gia lúc onboarding, nên `profiles.country` bỏ trống và app phải đoán thị
trường theo ngôn ngữ máy — sai với quy tắc "nội dung theo quốc gia, chữ theo
ngôn ngữ". Nay modal Tạo tài khoản và modal Chỉnh sửa đều có ô **Quốc gia /
Thị trường** (VN / UK / ML, mặc định VN), bảng có thêm cột Thị trường.
`admin-manage-account` (v25) nhận `country`, kiểm tra thuộc VN/US/MALAY
(thiếu thì mặc định VN để caller cũ không vỡ) và ghi vào `profiles.country`
cạnh `country_confirmed`. `COUNTRY_META` / `COUNTRY_OPTIONS` ở
`adminMockData.ts`.

## Lộ trình đọc theo thị trường + tự dịch nháp tên (2026-09-05, tối)

Chủ sở hữu báo: chọn thị trường UK nhưng tab Lộ trình vẫn hiện toàn tiếng
Việt; và mong muốn chung là "tạo nội dung VN xong thì các thị trường khác tự
dịch sẵn bản nháp để sửa sau".

- `marketText(vn, en, ms, market)` mới: tên sản phẩm, tên giai đoạn, cột
  Giai đoạn trong bảng ngày, và `<select>` giai đoạn trong modal Ngày đều đọc
  theo thị trường đang chọn. Giá trị LƯU vẫn là tên VN (vì
  `createProgramDay`/`updateProgramDay` tra giai đoạn theo tên) — chỉ đổi
  phần hiển thị. Thiếu bản UK/ML thì hiện bản VN kèm chú thích vàng
  "Chưa có bản UK — đang hiện bản VN."
- `translateDrafts` (Edge Function `translate-content`, Groq — đã có sẵn và
  đang dùng ở Cộng đồng / Upsell / FAQ / Quiz / AI Prompts) nay nối vào tab
  Lộ trình: lưu giai đoạn hoặc lưu thông tin sản phẩm mà ô UK/ML trống thì
  hệ thống tự dịch từ bản VN và điền nháp. Dịch lỗi thì vẫn lưu bản VN,
  không chặn thao tác lưu.

## Nối nốt tự dịch: Cửa hàng, Onboarding, Thông báo hệ thống (2026-09-05, tối)

- **Cửa hàng (`ProductsView`)** — dùng NÚT, không tự điền khi lưu. Lý do: ở
  đây tab trống nghĩa là "không bán ở thị trường đó", nên tự điền sẽ vô tình
  mở bán; và giá/link/ảnh không phải thứ dịch được. Modal nhóm có "Dịch tên
  nhóm từ bản VN sang UK/ML"; modal sản phẩm có "Dịch tên & mô tả từ bản VN
  sang UK/ML" (chỉ chữ, kèm chú thích rằng giá và link vẫn nhập riêng). Cả
  hai chỉ điền vào ô đang trống, không đè bản đã có.
- **Onboarding (`OnboardingContentView`)** — nút "Tạo bản UK/ML từ bản VN"
  trước đây SAO CHÉP nguyên văn tiếng Việt; nay dịch thật qua
  `translateDrafts` (tiêu đề + mô tả phụ + từng đáp án). Số lượng đáp án giữ
  nguyên tuyệt đối vì câu trả lời cũ map theo VỊ TRÍ; field nào dịch hỏng thì
  rơi về bản VN. Dịch lỗi hoàn toàn thì vẫn tạo bản sao chép như cũ.
- **Thông báo hệ thống (`NotificationsAdminView`)** — modal sửa một ngôn ngữ
  mỗi lần, nên có nút "Dịch từ bản VN" hiện khi đang ở tab EN/MS.
- **`translate-content` v2**: thêm luật giữ nguyên placeholder dạng
  `{{day}}` / `{{days}}` — mẫu thông báo và upsell đều dùng.

**Cố ý KHÔNG nối:** Nội dung pháp lý (`LegalContentView`). Bản tiếng Anh và
Malay đã được viết tay sẵn trong `appLegalContent.ts`, editor mở ra là đúng
ngôn ngữ đó rồi; máy dịch đè lên văn bản pháp lý là hạ chất lượng và rủi ro.
