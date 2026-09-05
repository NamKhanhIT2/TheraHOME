# CLAUDE.md

Guidance for Claude Code (and any other agent) working in this repo.

## Where the details live (docs/)

This file used to hold everything and got too long. The always-relevant core
stays here; the rest is split into `docs/` — **read the relevant file before
working on its area** instead of guessing:

- `docs/backend.md` — full Supabase schema (tables, RLS, RPCs, Storage
  buckets) + every Edge Function. Read before any schema/query/Edge
  Function work.
- `docs/auth-and-activation.md` — how activation and Home/Roadmap actually
  work, the three login methods and the single post-auth gate, and
  TheraHOME-issued (admin-created) accounts. Read before touching
  login/onboarding/activation.
- `docs/motion.md` — the Reanimated motion system: shared hooks/components
  and the rules for adding animation. Read before adding/changing motion.
- `docs/feature-notes.md` — the chronological, dated work log (community,
  notifications, market/language architecture, quiz/IAP phase unlock,
  redesigns, bug fixes…). When touching an existing feature, search this
  file for its section first — the design rationale and gotchas are there.
- `docs/manual-setup.md` — external dashboard steps still pending (Apple
  IAP, Google/Apple sign-in, `GROQ_API_KEY`, Shopify webhook). Read when a
  credentialed integration "doesn't work".
- `docs/roadmap.md` — phase roadmap (all 7 phases done) + remaining
  external items and key decisions already made.

## What this is

TheraHOME is a Vietnamese-language companion app for TheraHOME's physical
rehab devices. Only TheraNECK+ has a published roadmap as of 2026-09-05;
TheraNECK PRO / TheraBACK+ / TheraBACK PRO were deleted until their own
videos exist. Core loop: intake questionnaire → device activation → a guided
day-by-day program (currently 14 days, see `products.total_days`)
(daily exercise video + 0–10 pain self-report) → water tracking, a community
feed, and AI + human support chat.

This is a **React Native (Expo) app**. **All 7 planned phases (0–6) are
done**: full click-through UI, real Supabase (schema/RLS/Google OAuth/
activation), Home/Roadmap/pain-logging/water-tracking, Store + Community
(with Realtime), Chat (realtime threads, Claude-backed AI replies via an
Edge Function, human-thread scaffolding), and notifications/push + profile
editing + real account deletion — all on real per-user data. See
`docs/roadmap.md` for what's left, which at this point is exclusively
external credentials/decisions the user still has to provide, not app code.

## Source of truth is a Claude Design project, not this checkout

The product's visual/functional spec lives in a Claude Design project
("TheraHome Design", projectId `d030fe5f-c127-4d8b-8242-ea2ecf0aa2e7`),
reachable through the `DesignSync` MCP tool / `/design-sync` skill. That
project is a **static, no-build HTML/JSX web prototype** (React 18 UMD +
Babel Standalone via CDN) — it is not this app's code and was never meant to
run as-is in React Native (its `<div>`/`<button>`/web `<svg>` JSX doesn't
translate directly).

A frozen copy of the four screens/components files that were translated into
this app lives in `.design-reference/` (`app.jsx`, `screens.jsx`,
`components.jsx`, `profile-screens.jsx`) — **read-only reference material,
never imported or bundled.** When the design changes upstream, re-pull the
relevant files via `DesignSync.get_file` and re-diff against
`.design-reference/` rather than guessing what changed.

The same Claude Design project also contains three other surfaces that were
**not** imported here and are out of scope for this app: `TheraHOME
Admin.html`, `TheraHOME Customer Care.html`, `TheraHOME Web App.html`. The
Customer Care surface is the most likely place a future "specialist chat"
backend gets built against — see Chat in `docs/backend.md`.

## Stack

- **Expo** (managed workflow, SDK 57) + **React Native** + **TypeScript**
  (`strict: true`) + **Expo Router** (file-based routing under `app/`).
- **Backend**: Supabase (Postgres + Auth), project `nyjvtvmllwbyfokldgtj`
  (Singapore / `ap-southeast-1`, org "TheraHOME", free tier). Client at
  `src/lib/supabase.ts`; generated row/RPC types at `src/types/database.ts`
  (regenerate via `mcp__claude_ai_Supabase__generate_typescript_types` after
  any schema change — don't hand-edit).
- **Auth**: three methods, all funneled through the same post-auth gate in
  `app/_layout.tsx`'s `RootNavigator` — no separate navigation logic per
  method (see `docs/auth-and-activation.md`).
  - **Google**: `src/lib/googleAuth.ts`, the standard Supabase+Expo
    web-based flow (`expo-web-browser` + `expo-auth-session`'s
    `QueryParams` helper) — works in plain Expo Go, no native Google
    Sign-In SDK / EAS dev client needed. **Won't actually work until
    manual setup is done — see `docs/manual-setup.md`.**
  - **Apple**: `src/lib/appleAuth.ts`, native `expo-apple-authentication`
    (chosen over Supabase's web-OAuth Apple flow specifically for App
    Store Guideline 4.8 compliance) → `supabase.auth.signInWithIdToken`.
    This is a **native module** — unlike Google, it does not run in plain
    Expo Go and needs an EAS dev client, plus a real
    `ios.bundleIdentifier` (`app.json`, currently a placeholder
    `com.therahome.app` — confirm before a real build) and Apple
    Developer/Supabase dashboard setup — see `docs/manual-setup.md`.
  - **TheraHOME account**: `app/(onboarding)/thera-login.tsx`, plain
    `supabase.auth.signInWithPassword` (email + password). For accounts an
    Admin issues directly (App Review, staff, partners, testers) — not
    OAuth, no purchase involved. See `docs/auth-and-activation.md`.
- **State**: `zustand` (`src/store/useAppStore.ts`) is now down to genuinely
  local/UI-only state — theme, in-progress onboarding answers, which
  activated program is selected, and whether the notification-permission
  prompt has been dismissed once. `@tanstack/react-query`
  (`src/hooks/usePrograms.ts`, `useWaterLog.ts`, `useCommunity.ts`,
  `useStore.ts`, `useChat.ts`, `useNotifications.ts`, `useProfile.ts`) owns
  all real per-user data: activated programs, program days, pain logs,
  water, community posts/comments/likes, the store catalog, chat
  threads/messages, the notification inbox, the profile row. Community,
  Chat, and Notifications additionally subscribe to Supabase Realtime
  (`postgres_changes` on `community_posts`/`post_comments`/`chat_messages`/
  `notifications`) and invalidate the relevant query on change. **Gotcha**:
  `postgres_changes` only fires for
  tables actually added to the `supabase_realtime` publication — it starts
  out empty on a fresh project, so a table can have working RLS and a
  correctly-written client subscription and still silently receive nothing.
  Phase 4 shipped with this broken for `community_posts`/`post_comments`
  (`alter publication supabase_realtime add table ...` was missing) until the
  `enable_realtime_publication` migration in Phase 5 fixed it. Any future
  table a screen subscribes to via `postgres_changes` needs the same
  `alter publication` line.
- **Chat presence**: `useSpecialistPresence()` (`src/hooks/useChat.ts`) uses
  Realtime Presence on a `specialist-presence` channel — `true` only while
  some client calls `channel.track({ role: 'specialist' })` on that same
  channel name. No such client exists yet (see Chat in `docs/backend.md`),
  so it correctly shows offline rather than a hardcoded "online" badge.
- **Icons**: `lucide-react-native` via `src/components/icons/Icon.tsx`, a
  name-string wrapper matching the prototype's icon names (a few were
  renamed/removed upstream in lucide — see the mapping table + comments in
  that file before assuming a new icon name will just work).
- **Images**: `expo-image-picker` uploads to public Storage buckets under a
  `${userId}/...` path — `community-images` (post photos, Phase 4) and
  `avatars` (profile photos, Phase 6). See `docs/backend.md`.
- **Push/local notifications**: `expo-notifications`, wired in
  `src/lib/pushNotifications.ts`. Two independent pieces: (1)
  `registerForPushNotifications(userId)` requests permission and upserts an
  Expo push token into `push_tokens` — only actually retrieves a token from
  an EAS dev/production client, since Expo Go dropped remote push support in
  recent SDKs, so token failures there are caught and swallowed rather than
  surfaced (permission itself still works fine in Expo Go); and (2)
  `scheduleDailyReminder(enabled, time)` / `scheduleEveningReminder(enabled,
  time)`, two independent local device-scheduled daily notifications (own
  identifiers, own schedule) driven by `profiles.daily_reminder_enabled`/
  `daily_reminder_time` and `evening_reminder_enabled`/`evening_reminder_time`
  respectively — works everywhere, no credentials or server needed. Both
  share one internal `scheduleReminder(identifier, ...)` helper.
  No actual remote-push-sending pipeline exists yet (nothing reads
  `push_tokens` to call the Expo Push API) — that's blocked on the Apple/
  Firebase credentials in `docs/manual-setup.md`, same as EAS itself.
- **Motion**: `react-native-reanimated` 4 + shared motion hooks/components —
  conventions and the do-not-migrate-`Animated` rule live in
  `docs/motion.md`.
- No CSS anywhere — all colors/spacing/type/radius/shadow come from
  `src/theme/` (`useTheme()`), ported once from the design system's CSS
  tokens. Never hardcode a hex value or write a `var(--...)` string.

## Folder structure

```
app/                        Expo Router routes (file-based)
  _layout.tsx                Root: fonts, ThemeProvider, QueryClientProvider,
                              real-session gate (Stack.Protected)
  (onboarding)/               welcome → questions → consent → login → activate
                              (login/activate call real Supabase — see
                              docs/auth-and-activation.md)
  (tabs)/                     home, roadmap, store, community + custom tab bar + FAB
  day/[dayId].tsx             day detail
  profile/                    index, edit, notifications-settings, account,
                              help, delete-account, legal/[doc]
  community/[postId].tsx      comments
  community/create.tsx        create post
  chat/ai.tsx, chat/human.tsx  AI assistant (Claude, via Edge Function) /
                              human specialist threads — both real, realtime
  notifications.tsx           notification inbox

src/
  theme/                      colors (light+dark), typography, spacing,
                              radius/shadows, ThemeProvider/useTheme()
  lib/supabase.ts              Supabase client (expo-secure-store-backed auth
                              storage, chunked for tokens >2KB)
  lib/googleAuth.ts            signInWithGoogle() — the OAuth browser-session flow
  lib/mockData.ts              remaining static content with no real-data
                              equivalent: onboarding `questions`, `articles`,
                              a couple of fixed external links — every
                              per-user mock array (products, community,
                              notifications, mockUser, landingOrders, ...)
                              has been removed as its real hook shipped
                              across Phases 3-6
  lib/avatarColor.ts            deterministic colored-initial avatar per
                              author (community posts/comments show no real
                              photo, matching the design)
  lib/timeAgo.ts                 Vietnamese relative-time formatter for
                              community/notification timestamps
  lib/pushNotifications.ts       expo-notifications: push token registration
                              + local daily-reminder scheduling
  lib/legalContent.ts          Terms/Privacy/Security VN text — UNREVIEWED
                              DRAFT, see Legal content below
  types/database.ts            generated Supabase row/RPC types
  hooks/useSession.ts           real auth-session hook (wraps supabase.auth)
  hooks/usePrograms.ts          real per-user program data: useProducts,
                              useActivatedPrograms, useProgramDays,
                              usePainLogs, useCompleteDay (wraps the
                              `complete_day` RPC)
  hooks/useWaterLog.ts          real per-day water tracking (optimistic update)
  hooks/useRequestDay.ts        shared pain-scale-gate-before-opening-a-day
                              logic, now backed by useCompleteDay
  hooks/useStore.ts             real store catalog: useStoreCategories
  hooks/useCommunity.ts         real community data + Realtime: posts, likes,
                              saves, one-level comment replies, image upload
  hooks/useChat.ts               real chat + Realtime: useChatThread
                              (get-or-create), useChatMessages,
                              useSendChatMessage (invokes chat-ai-reply for
                              AI threads), useSpecialistPresence
  hooks/useNotifications.ts      real notification inbox + Realtime:
                              useNotifications, useMarkNotificationRead
  hooks/useProfile.ts            real profile read/write: useProfile,
                              useUpdateProfile, uploadAvatarImage
  store/useAppStore.ts          local/UI-only state — theme, onboarding
                              answers, selected program, notification-prompt
                              dismissed flag
  components/                 shared screen components (PainChart, WaterCard,
                              PathNode, modals, etc.) ported from the
                              prototype's components.jsx/profile-screens.jsx
  components/ui/               generic primitives (Button, Card,
                              ScreenContainer, ProgressDots, BackBar, OptionCard)
  components/icons/Icon.tsx    lucide-react-native name-string wrapper

.design-reference/            frozen copies of the original prototype's JSX —
                              reference only, never imported
docs/                         the split-out detail docs listed at the top of
                              this file
```

## Legal content: entity confirmed, wording not counsel-reviewed

`src/lib/legalContent.ts` (Terms/Privacy/Security, in Vietnamese) now names
the confirmed legal entity — "Công ty H-COMMERCE GLOBAL COMPANY LIMITED"
(owner-confirmed 2026-09-03); no placeholders remain. The wording itself was
authored from a design brief, not by counsel — recommend a legal review pass
before any App Store / Play Store submission. Keep the public web copy
(`TheraHOME-WEB/src/lib/appLegalContent.ts`) in sync with any change.

## Running the app

```
npm install
npx expo start
```

Most of this needs no native build step — `expo-image-picker` and local
`expo-notifications` reminders both run in plain Expo Go (just need their
`app.json` plugin entries, already present), and remote push delivery only
needs an EAS dev client (no rebuild). **Exception**: `react-native-iap`
(phase-unlock purchases) is a native module — an existing dev client
doesn't have it until you run `eas build --profile development` again and
install the new build. Everything else in the app still runs fine without
that rebuild.
`.env` holds the Supabase URL + publishable (anon) key — safe to keep
committed, it's client-safe by design (RLS is what actually protects data,
not key secrecy).
