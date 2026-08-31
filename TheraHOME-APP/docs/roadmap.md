# Phase roadmap & remaining external items

> Split out of `TheraHOME-APP/CLAUDE.md` (2026-08-28) to keep that file
> small. Content is verbatim from the original — any "see X above/below"
> cross-reference may now live in `../CLAUDE.md` or a sibling file in
> `docs/` (`backend.md`, `auth-and-activation.md`, `motion.md`,
> `feature-notes.md`, `manual-setup.md`, `roadmap.md`).

## Phase roadmap

- [x] **Phase 0** — Expo/TypeScript scaffold, Expo Router, dependencies.
- [x] **Phase 1** — Theme shell + full click-through on local mock data.
- [x] **Phase 2** — Real Supabase: full schema + RLS applied (see above),
      Google OAuth code path wired (needs the manual dashboard steps above to
      actually authenticate), device activation wired to the real `orders`
      table via `lookup_order`/`activate_order`.
- [x] **Phase 3** — Home/Roadmap/pain-logging/water-tracking on real per-user
      data (`user_programs`/`user_program_days`/`pain_logs`/`water_logs`,
      `complete_day` RPC), multi-device program switcher wired to real
      activated programs. Mock bridge fully removed.
- [x] **Phase 4** — Store (real catalog, no in-app checkout, links out to
      therahomeai.com) + Community with Supabase Realtime (feed, one-level
      comment replies, likes/saves, image upload via the new
      `community-images` Storage bucket). Mock `communityPosts`/
      `storeCategories` removed from `mockData.ts`/`useAppStore`.
- [x] **Phase 5** — Chat: realtime threads (`chat_threads`/`chat_messages`),
      the `chat-ai-reply` Edge Function calling the Groq API for AI replies
      (needs the `GROQ_API_KEY` manual step above to give real answers —
      falls back to a scripted message until then), human-thread scaffolding
      (real send/receive, but nothing replies yet — see below) + a real
      Presence "online" indicator (shows offline until a specialist client
      exists). Also fixed a Phase 4 bug: `community_posts`/`post_comments`
      realtime silently didn't work because the tables were never added to
      the `supabase_realtime` publication — see the Realtime gotcha above.
- [x] **Phase 6** — Notifications (`expo-notifications`: real inbox +
      Realtime, local daily-reminder scheduling, push-token registration
      scaffolding — see Stack above for why remote push delivery itself is
      still blocked on external credentials), profile polish (`edit.tsx`,
      `account.tsx`, `notifications-settings.tsx`, avatar upload all real —
      see Supabase schema above), real `delete_account` RPC replacing the
      sign-out-only stub.

All 7 planned phases are now complete from an app-code standpoint. What's
left is exclusively the external items below — this repo has nothing more to
build against the current plan until the user resolves one of those, or asks
for something beyond the original phase roadmap (e.g. App/Play Store
submission prep, or building the Customer Care surface).

Key decisions already made: single Supabase project (done, see above),
Google-OAuth-only auth (done — Account Settings' password row was
deliberately replaced with a "Quản lý tài khoản Google" label), multi-device
support (done — `user_programs` is one-row-per-device, Home/Roadmap's
switcher reads real activated programs), soft-delete on account deletion
(done — Phase 6, see `delete_account` above), Groq (free tier, switched from
Anthropic 2026-08-19 — see the AI chat replies item under Manual setup) for
the AI assistant (done — Phase 5, via the `chat-ai-reply` Edge Function),
admin-editable system prompt/suggestion chips via `ai_prompts`/
`ai_suggested_replies` (done — see Supabase schema above).

## Remaining external items (nothing left for an agent to build against these)

- Apple Push key + Firebase/FCM service account uploaded to EAS, needed
  before remote push notifications can actually be sent (the device-side
  registration code is already there — see `push_tokens` above — but nothing
  reads that table to call the Expo Push API yet, and that pipeline needs a
  configured EAS project either way).
- A decision on who operates the human side of `chat/human`, and how they'll
  authenticate/reply — most likely the separate "Customer Care" surface in
  the Claude Design project (not built here). Whatever client that becomes
  needs to: insert `chat_messages` rows with `sender_type='specialist'` into
  a user's `kind='human'` thread (as a service-role/admin context, since the
  end-user RLS policy only allows `sender_type='user'` inserts — see Chat
  above), and `channel.track({ role: 'specialist' })` on the
  `specialist-presence` Realtime channel while staffed, to light up
  `useSpecialistPresence()` on the end-user side.
- The three items under Manual setup below (Google OAuth dashboard steps,
  `GROQ_API_KEY`, the Shopify webhook + `SHOPIFY_WEBHOOK_SECRET`) —
  all already have working code paths and graceful fallbacks; they just
  need the credentials/dashboard steps themselves.

Remote push notifications specifically mean moving off pure Expo Go onto an
EAS dev client — everything else in the app (including local reminder
notifications) runs fine in plain Expo Go.

