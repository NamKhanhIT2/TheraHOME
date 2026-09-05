# Supabase schema & Edge Functions

> Split out of `TheraHOME-APP/CLAUDE.md` (2026-08-28) to keep that file
> small. Content is verbatim from the original — any "see X above/below"
> cross-reference may now live in `../CLAUDE.md` or a sibling file in
> `docs/` (`backend.md`, `auth-and-activation.md`, `motion.md`,
> `feature-notes.md`, `manual-setup.md`, `roadmap.md`).

## Supabase schema

All migrations for Phases 2 **through 6** were applied in one pass back in
Phase 2 (it was cheaper to design the whole schema once than revisit it per
phase) — most tables now have real queries reading/writing them; some are
still waiting on their phase:

- **Reference/admin-managed** (public read, no client write, pre-seeded):
  `products` (1 row as of 2026-09-05: neck-plus — neck-pro/back-plus/back-pro
  were deleted), `program_phases` (2 rows), `program_days` (14 rows — the
  14-day template; `products.total_days` is the number the app counts to),
  `store_categories` (3) + `store_items` (8, real, read by
  `useStoreCategories` — see `app/(tabs)/store.tsx`), `articles` (5, not
  wired to a screen yet).
- **Account** (real, Phase 6): `profiles` (auto-created by a trigger on
  `auth.users` insert from the Google profile's name/avatar). Read/written by
  `src/hooks/useProfile.ts`: `app/profile/edit.tsx` (name, phone,
  treatment_area, goal, avatar upload to the `avatars` bucket),
  `app/profile/account.tsx` (language, data_sharing_enabled),
  `app/profile/notifications-settings.tsx` (daily_reminder_enabled/_time +
  evening_reminder_enabled/_time — two independent morning/evening
  reminders, added 2026-08-19 alongside the onboarding redesign's
  `ReminderPopup`, see "Onboarding redesign" section below — each toggle
  reschedules its own local reminder notification on change),
  `app/(tabs)/home.tsx`/`app/profile/index.tsx` (read-only: name, avatar,
  and — from `useActivatedPrograms`, not `profiles` — streak/adherence/day).
  Also carries `account_type`/`access_level`/`expires_at`/
  `onboarding_completed`/`created_by`/`notes`/`last_login_at` (added for
  TheraHOME-issued accounts — see that section above), `country_confirmed`
  (added 2026-08-19, default `false` on new rows/backfilled `true` on
  existing ones — gates `app/(onboarding)/country.tsx`, see "Onboarding
  redesign" section below), and a `protect_privileged_profile_columns`
  trigger guarding the sensitive ones.
- **Orders (commerce only)**: `orders` — 4 demo rows seeded (matching the
  prototype's mock `landingOrders`: phones `0901234501`–`04`, codes
  `TH-NECK-1037` / `TH-BACK-1074` / `TH-NECK-2210` / `TH-BACK-2381`, all
  `status='pending'` until someone actually activates one), **plus real rows
  synced automatically from the connected Shopify store** — see the
  `shopify-order-webhook` Edge Function below. **No client RLS policy at all
  on this table by design** — reachable only through `SECURITY DEFINER`
  functions, callable by `authenticated` only: `lookup_order(p_phone,
  p_email)`, `lookup_order_by_code(p_code)`, and
  `activate_orders_by_contact(p_phone, p_email)`. Both `p_phone`-taking
  functions normalize through the shared `normalize_phone_vn(text)` helper
  (strips all non-digits, `84`-prefix → `0`) before comparing, since real
  Shopify phone numbers can arrive in `+84`/spaced/dashed formats that
  wouldn't otherwise exact-match what a user types. `orders` also has a
  `shopify_order_id bigint unique` column, used only as the webhook's
  idempotency key (Shopify redelivers webhooks at-least-once) — it's not
  read anywhere in the app. Phone/email are treated as a **permission
  credential, not a single-order claim**: `activate_orders_by_contact` (used
  by `app/(onboarding)/activate.tsx`'s phone/email flow) activates *every*
  order matching the given phone/email in one call, not just one — a
  customer who bought multiple devices under the same phone/email sees all
  of their programs immediately, rather than needing to separately redeem
  each device's own activation code. It loops calling `activate_order` per
  matching order and swallows `order_already_activated` per-order (a
  different account already owns that specific order) so one collision
  doesn't block the rest of this customer's own devices. The manual
  activation-code and QR-scan paths still target one specific order each
  via `lookup_order_by_code` + `activate_order` — a code is inherently tied
  to a single device, unlike phone/email.
- **App access**: `user_access_contacts` owns the post-Google contact gate.
  `claim_user_access_contact(p_contact)` atomically claims one normalized
  phone/email per `auth.users` account, requires that contact to match at
  least one `orders` row, and rejects reuse by any other account. This is a
  purchase check only: it does not activate or mutate the matching order.
  A pre-provisioned, enabled `admin` or `cskh` contact in
  `web_access_contacts` bypasses the purchase check and is atomically bound
  to the claiming `auth.uid()` through the same RPC.
  A successful claim provisions `user_programs` and
  `user_program_days` for every product; orders and activation codes are not
  part of app access. Product/day insert triggers provision future catalog
  additions for all claimed users.
- **Program progress** (real, Phase 3): `user_programs`, `user_program_days`,
  `pain_logs`, `water_logs` — all read/written by
  `src/hooks/usePrograms.ts`/`useWaterLog.ts`. RPCs `activate_order(p_order_id)`
  (`app/(onboarding)/activate.tsx`) and `complete_day(...)` (`useCompleteDay`,
  called from `useRequestDay`'s pain-scale-modal confirm) — as of Phase 6,
  `complete_day` also inserts a real `notifications` row (`type='schedule'`)
  for the newly-unlocked next day, which is the only current writer into the
  notifications table (see below).
- **Community** (real, Phase 4, expanded post-Phase-6 — see "Community
  expansion" below for the full picture): `community_posts`, `post_comments`
  (self-referencing `parent_comment_id`, depth ≤ 1 enforced by
  `enforce_comment_depth`), `post_likes`, `comment_likes`, `post_saves`,
  `content_reports`, `challenges`, `challenge_participants`, all
  read/written by `src/hooks/useCommunity.ts`/`useChallenges.ts`.
  `likes_count`/`comments_count` on `community_posts` and `likes_count` on
  `post_comments` are trigger-maintained (`bump_post_likes`/
  `bump_post_comments`/`bump_comment_likes`) — never written directly by the
  client. Both reaction tables are world-readable on visible content
  (`public read post reactions` / `public read comment reactions`) — the
  post_likes one was missing until the
  `post_reactions_public_read_realtime` migration (2026-09-03), which is
  why other accounts used to aggregate 0 reactions on every post; that
  migration also added `post_likes`+`comment_likes` to the
  `supabase_realtime` publication so reacts push live. `community_posts`/`post_comments` also carry denormalized
  `author_name`/`author_avatar_url` columns, populated by a
  `set_author_info` trigger on insert: `profiles` RLS only allows selecting
  your own row (no public user directory), so the feed can't join author
  display data client-side — copying it once at insert time avoids needing
  to open that up. Comments don't have an `is_official` column (only posts
  do). Official posts can be created either by a direct DB insert or by an
  Admin with the `admin` web role (`web admin insert official posts` RLS
  policy) via TheraHOME WEB's `CommunityView`.
  Screens: `app/(tabs)/community/index.tsx` (feed), `app/community/[postId].tsx`
  (comments), `app/community/create.tsx` (composer, with image upload and an
  optional phase-milestone tag pulled from the user's current program).
- **Notifications/push** (real, Phase 6): `notifications` (read/written by
  `src/hooks/useNotifications.ts`, realtime; only current writer is
  `complete_day` — see above), `push_tokens` (device Expo push tokens,
  `expo_push_token` has a unique constraint so the client can
  `upsert(..., { onConflict: 'expo_push_token' })` instead of accumulating
  duplicates). See the Push/local notifications bullet under Stack above.
- **Chat** (real, Phase 5): `chat_threads` (kind `ai`/`human`, one open thread
  per kind per user — `useChatThread` does get-or-create, never closes one),
  `chat_messages` (`sender_type` `user`/`ai`/`specialist`). RLS lets a client
  INSERT only `sender_type='user'` rows into their own thread — `ai`/
  `specialist` rows can only come from a service-role context (the Edge
  Function below), never the app. Read/written by `src/hooks/useChat.ts`;
  screens `app/chat/ai.tsx`, `app/chat/human.tsx`.
- **Storage**: two public buckets, both path-convention
  `${userId}/${timestamp}.${ext}` with RLS on `storage.objects` restricting
  insert/update/delete to each user's own folder
  (`(storage.foldername(name))[1] = auth.uid()`; reads are public):
  `community-images` (Phase 4, post photos) and `avatars` (Phase 6, profile
  photos — `useProfile.ts`'s `uploadAvatarImage`).
- **Account deletion** (real, Phase 6): the `delete_account()` RPC (no args,
  `SECURITY DEFINER`, operates only on `auth.uid()`) implements the decision
  recorded below — soft-delete/scrub `profiles` (nulls PII, sets
  `deleted_at`) while hard-deleting `user_programs` (cascades
  `user_program_days`/`pain_logs`), `water_logs`, `notifications`, and
  `push_tokens`, matching what `DeleteAccountModal`'s own copy already
  promises the user. It deliberately never deletes the `auth.users` row
  itself — `post_comments.author_id` is `NOT NULL` and FK'd to `auth.users`
  `on delete cascade`, so deleting `auth.users` would cascade-delete this
  user's comments *and*, through `post_comments.parent_comment_id`'s own
  cascade, any other users' replies nested under them. Instead
  `community_posts`/`post_comments` authored by the deleting user are
  anonymized in place (`author_name` → `'Người dùng đã xoá'`, and
  `community_posts.author_id` — nullable, unlike comments' — set `null`).
  Called from `DeleteAccountModal` before `supabase.auth.signOut()`.

RLS is on for every table; user-scoped tables are locked to `auth.uid()`
(written as `(select auth.uid())` in every policy — the wrapped form avoids
Postgres re-evaluating it per row, flagged by the performance advisor and
fixed). All flagged FK columns have covering indexes. Run
`mcp__claude_ai_Supabase__get_advisors` (`security` and `performance`) after
any further migration — it should come back clean apart from harmless
`unused_index` INFO notices on a low-traffic project.

**Applying more migrations**: use `mcp__claude_ai_Supabase__apply_migration`
(project_id `nyjvtvmllwbyfokldgtj`), one logical change per call. Remember
Supabase grants `EXECUTE` on new functions directly to the `anon` and
`authenticated` roles via `ALTER DEFAULT PRIVILEGES` — **not** via `PUBLIC` —
so `revoke ... from public` alone does nothing; always
`revoke all on function f(...) from public, anon, authenticated` then
re-grant only the role that should actually call it. (This bit us once
already — see the `fix_function_privileges` migration.) Also remember any
table a client subscribes to via `postgres_changes` needs an explicit
`alter publication supabase_realtime add table ...` — see the Realtime
gotcha under Stack above.

## Edge Functions

Three, all on project `nyjvtvmllwbyfokldgtj`. None of their source is
checked into this repo — all were deployed directly via
`mcp__claude_ai_Supabase__deploy_edge_function` and live only on Supabase;
use `mcp__claude_ai_Supabase__get_edge_function` to read the current deployed
source before changing either, and `deploy_edge_function` again (same name)
to redeploy — that creates a new version, there's no separate "edit" step.

`shopify-order-webhook` (`verify_jwt: false` — no Supabase JWT exists on an
inbound Shopify webhook) receives Shopify's **"Order creation"**
notification webhook (topic `orders/create` — changed 2026-08-23 from
"Order fulfillment"/`orders/fulfilled`, see below) from the connected
Shopify store ("TheraHOME Vietnam", `therahomeai.com`). It verifies
`X-Shopify-Hmac-Sha256` against the raw request body using a
`SHOPIFY_WEBHOOK_SECRET` secret (rejects with 401 on mismatch — this is the
only thing stopping anyone from POSTing a fake order and minting themselves
a free activation code), then upserts a row into `orders` via a
service-role client (`onConflict: 'shopify_order_id', ignoreDuplicates:
true`, since Shopify redelivers webhooks at-least-once): `phone`/`email`
pulled from the order/customer/shipping-address with fallback and
normalized (digits-only, `84`-prefix → `0`, email lowercased),
`activation_code` = `TH-<order_number>`, `order_date` from the order's
`created_at`. **`product_id` is always hardcoded to `'neck-plus'`** — the
Shopify catalog currently has `TheraNECK+` (the only real device match),
`TheraPillow`, and a `Combo` bundle, none of which map cleanly to the app's
other 3 device programs, and the product decision (made with the user) was
"bought anything → can get into the app" rather than strict product
matching. Revisit this default once TheraNECK PRO / TheraBACK+/PRO exist as
real Shopify products. **Triggers on order creation, not payment or
fulfillment** — moved off "Order fulfillment" per explicit request so a
customer's phone/email is already in `orders`, matchable at the app's
activation code-entry step, the moment they place an order rather than
only once the device ships. Deliberately still not gated on payment status
either way (same reasoning as before the change): most orders show
`financialStatus: PENDING` for a while since COD is common for VN device
sales, so gating on "paid" (or "fulfilled") would both miss real customers
who have a valid order but haven't paid/received yet. The Order payload's
relevant fields (id, order_number, phone/email, customer, shipping_address,
created_at) are the same across every order-related webhook topic, so no
function code changed for this beyond comments — only which Shopify event
calls the URL, which is a **manual Shopify Admin step** (see below) since
this webhook lives in Shopify's legacy per-store notification-webhook
system, not an app-scoped subscription manageable via the Admin GraphQL
API (confirmed: `webhookSubscriptions` returns empty for this store). A
cancelled-right-after-creation order is not un-synced (no
`orders/cancelled` handling) — not requested, and `activate_orders_by_contact`
already only ever grants access to orders a real customer's own phone/
email actually matches, so a stray cancelled-order row is inert, not a
security or UX problem. Only new orders sync this way — no backfill of
pre-existing Shopify orders was done. Needs the `SHOPIFY_WEBHOOK_SECRET`
manual step below; until it's set, every request 500s rather than skipping
verification.

`chat-ai-reply` is the other one.

What it does: the client (`useSendChatMessage` in `src/hooks/useChat.ts`)
calls `supabase.functions.invoke('chat-ai-reply', { body: { thread_id } })`
right after inserting the user's own message. The function verifies the
caller owns that thread and it's `kind='ai'` (using a Supabase client bound
to the caller's own JWT, so this respects RLS rather than trusting the
input), loads the last 20 messages as conversation history, reads the live
system prompt from `ai_prompts` (singleton row, admin-editable — see below),
calls the **Groq** API (`https://api.groq.com/openai/v1/chat/completions`,
OpenAI-compatible, model `llama-3.3-70b-versatile` by default, override via
`GROQ_MODEL`) with that prompt (stays on-topic for TheraHOME/rehab, refuses
to diagnose, nudges toward `chat/human` for concerning symptoms), and
inserts the reply as `sender_type='ai'` using a service-role client — a
service-role client is required there specifically because the
client-facing RLS insert policy only allows `sender_type='user'` rows. The
client never sees the reply text directly; it just arrives through
`useChatMessages`'s existing realtime subscription like any other row, so
the AI and a (future) human specialist path share the same message pipeline.

Switched from Anthropic to Groq's free tier (2026-08-19, at the user's
request — no paid API key was available) — `getGroqReply()` in the function
source is the only place that would need to change to switch providers
again; the rest of the pipeline (thread ownership check, history loading,
service-role insert) is provider-agnostic.

If the `GROQ_API_KEY` secret isn't set (see Manual setup below), the
function doesn't error — it inserts a Vietnamese fallback message pointing
the user at `chat/human` instead, so the chat UI stays fully clickable end
to end even before that key exists. Same fallback fires if the `ai_prompts`
row is somehow missing (falls back to a hardcoded `DEFAULT_SYSTEM_PROMPT`
baked into the function).

**AI Prompts admin screen is now real** (`ai_prompts` / `ai_suggested_replies`
tables, migration `202608192000_ai_assistant_admin.sql`) — previously
`AIPromptsView.tsx` in WEB was pure local `useState` with toast-only fake
saves (see WEB's CLAUDE.md history). `ai_prompts` is a one-row singleton
(`id boolean primary key check(id)` trick) holding the system prompt that
`chat-ai-reply` reads live on every request — editing it from Admin takes
effect immediately, no redeploy. `ai_suggested_replies` backs the AI chat's
empty-state suggestion chips (`useAISuggestedReplies()` in `useChat.ts`),
replacing what used to be a hardcoded 3-string array in `chat/ai.tsx`; falls
back to that same 3-string list client-side if the table has zero active
rows, so the chips are never blank. Both tables are RLS'd to admin/cskh for
writes; `ai_suggested_replies` reads are open to any authenticated user
(mobile), `ai_prompts` reads are admin/cskh-only (mobile doesn't need it —
the Edge Function reads it via service-role, bypassing RLS entirely).

`admin-manage-account` (`verify_jwt: true`) backs TheraHOME WEB's "Tài
khoản TheraHOME" Admin page. Verifies the caller is Admin (via a
JWT-bound client calling `current_web_roles()`, same pattern as
`chat-ai-reply`'s thread-ownership check) before doing anything, then uses
a service-role client for the two things that genuinely need it:
`action: 'create'` (`auth.admin.createUser` + fills in the profiles row +
provisions catalog access — see "TheraHOME-issued accounts" above) and
`action: 'reset_password'` (`auth.admin.updateUserById`). Everything else
about these accounts (editing fields, locking) goes through the normal
authenticated client + RLS from the WEB app directly, not this function —
see `TheraHOME WEB/src/lib/db.ts`. No manual secret needed:
`SUPABASE_SERVICE_ROLE_KEY` is auto-injected into every Edge Function by
Supabase, unlike `GROQ_API_KEY`/`SHOPIFY_WEBHOOK_SECRET` above.


**translate-content** (added 2026-09-04): staff-only VN→EN+MS machine
translation for the WEB Admin's auto-draft feature (see TheraHOME-WEB
docs/feature-notes.md). verify_jwt ON + requires an enabled admin/cskh row
in web_access_contacts claimed by the caller. Uses GROQ_API_KEY (shared
with chat-ai-reply); returns 503 when unset — callers save VN-only.
Source: supabase/functions/translate-content/index.ts.
