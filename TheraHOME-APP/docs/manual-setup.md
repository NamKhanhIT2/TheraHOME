# Manual setup still needed (external dashboard actions)

> Split out of `TheraHOME-APP/CLAUDE.md` (2026-08-28) to keep that file
> small. Content is verbatim from the original — any "see X above/below"
> cross-reference may now live in `../CLAUDE.md` or a sibling file in
> `docs/` (`backend.md`, `auth-and-activation.md`, `motion.md`,
> `feature-notes.md`, `manual-setup.md`, `roadmap.md`).

## Manual setup still needed (external dashboard actions — nothing here can do these)

**Apple In-App Purchase (phase unlock)** — `verify-apple-purchase` needs
these before any purchase can be verified (until then every purchase
attempt fails at the `apple_auth_setup_invalid`/`transaction_not_found`
step — see the function's own error responses):

1. App Store Connect → your app → In-App Purchases → create a
   **non-consumable** product for each phase that should require payment
   to unlock. Copy its Product ID into that phase's `phase_promos.apple_product_id`
   from WEB Admin (Lộ trình → pick product → Giai đoạn → "Quản lý Quiz &
   Upsell" → tab Nội dung Upsell).
2. App Store Connect → Users and Access → Integrations → App Store Server
   API → create a new API key (Team Key) → note the **Issuer ID**, the
   **Key ID**, and download the `.p8` file (only downloadable once).
3. Set 4 Supabase secrets for `verify-apple-purchase`: `APPLE_ISSUER_ID`,
   `APPLE_KEY_ID`, `APPLE_PRIVATE_KEY` (paste the full `.p8` file contents,
   including the `BEGIN/END PRIVATE KEY` lines), `APPLE_BUNDLE_ID` (must
   match `app.json`'s `ios.bundleIdentifier`).
4. `react-native-iap` is a **native module** — the current dev client does
   not have it. Run `eas build --profile development` again and install
   the new build before testing any purchase flow; plain Metro reload is
   not enough (see "Running the app" below, which used to say no native
   build was ever needed — that's no longer true once this feature is
   touched).
5. App Store Connect → Users and Access → Sandbox Testers → create a test
   Apple ID to actually complete a purchase without being charged.
6. **Not done in this pass, do next**: Android/Google Play Billing. Same
   `react-native-iap` library covers it (its Android API, not the iOS one
   used here), but needs a Google Play Console product per phase and a
   separate edge function verifying against the Google Play Developer API
   instead of Apple's App Store Server API — `usePhasePurchase.ts` and
   `verify-apple-purchase` are both iOS-only right now (`platform: 'ios'`
   hardcoded in `phase_purchases`). Also not done: an Apple Server
   Notifications V2 webhook to catch refunds after the fact (`revoked_at`
   exists on `phase_purchases` but nothing sets it yet) — worth adding
   once the iOS purchase flow itself is confirmed working end to end.

**Google sign-in** — until all three are done, tapping "Đăng nhập với Google"
fails with a friendly Vietnamese error (`login.tsx` catches and displays it)
rather than crashing; check the dev console for the underlying Supabase error
if debugging:

1. Create an OAuth client in Google Cloud Console (Web application type is
   enough for this flow — no native Android/iOS client needed since
   `googleAuth.ts` uses the browser-session flow, not native Google Sign-In).
2. In the Supabase dashboard → Authentication → Providers → Google: enable
   it and paste that client's ID + secret.
3. Back in Google Cloud Console, add the redirect URI shown on that same
   Supabase provider page (`https://nyjvtvmllwbyfokldgtj.supabase.co/auth/v1/callback`)
   as an authorized redirect URI on the OAuth client.

**Sign in with Apple** — needs all of this before it works on a real
device/simulator (until then, tapping the button just fails with the
friendly Vietnamese error `login.tsx` shows):

1. Apple Developer Program membership (paid) → Certificates, Identifiers &
   Profiles → Identifiers → register an App ID matching `app.json`'s
   `ios.bundleIdentifier` (currently the placeholder `com.therahome.app` —
   confirm/replace this first) → enable the "Sign In with Apple"
   capability on it.
2. Certificates, Identifiers & Profiles → Keys → create a new Key with
   "Sign In with Apple" enabled → download the `.p8` file (only
   downloadable once) and note its Key ID and your Team ID.
3. Supabase dashboard → Authentication → Providers → Apple: enable it and
   fill in the Services ID (or bundle ID), Team ID, Key ID, and the `.p8`
   private key contents from step 2.
4. This app needs an **EAS dev client** to test this specific flow —
   `expo-apple-authentication` is a native module, unlike Google's
   browser-based flow, so it does not run in plain Expo Go. Everything
   else in the app still runs fine in Expo Go.

**AI chat replies** — `chat-ai-reply` needs a `GROQ_API_KEY` secret (free
tier, chosen 2026-08-19 over a paid provider):
1. Sign up at [console.groq.com](https://console.groq.com) (free, no card
   required) → API Keys → Create API Key → copy it.
2. Set it as a Supabase secret: `supabase secrets set GROQ_API_KEY=gsk_...`
   (Supabase CLI, needs the project linked locally) or dashboard → Edge
   Functions → `chat-ai-reply` → Secrets.
3. Optional: `GROQ_MODEL` secret to override the default
   `llama-3.3-70b-versatile` (e.g. `llama-3.1-8b-instant` for a faster/lower
   free-tier-limit model).

Until the key is set, `chat/ai.tsx` still works end to end (thread creation,
sending, realtime) but every reply is the canned Vietnamese fallback message
rather than an actual model response — check that function's logs
(`mcp__claude_ai_Supabase__query_logs` or the dashboard) if replies look
wrong after the key is set, since a bad key fails the same way as no key.
The system prompt itself is no longer in the function source — it's read
live from the `ai_prompts` table, editable from WEB Admin's "AI Prompts"
screen (see Supabase schema above).

**Shopify order sync** — `shopify-order-webhook` needs both a webhook
created on the Shopify side and its signing secret set on the Supabase
side; until then every request to the function 500s and no real orders
flow into `orders`:

1. Shopify Admin ("TheraHOME Vietnam", `therahomeai.com`) → Settings →
   Notifications → Webhooks → Create webhook → Event **"Order
   creation"** → Format **JSON** → URL =
   `https://nyjvtvmllwbyfokldgtj.supabase.co/functions/v1/shopify-order-webhook`.
   (Changed 2026-08-23 from "Order fulfillment" — see the dated note below
   this list. This is Shopify's legacy per-store notification-webhook
   system, confirmed via the Admin GraphQL API's `webhookSubscriptions`
   query returning empty — it is **not** an app-scoped webhook subscription
   manageable through that API, so switching the event is a manual Shopify
   Admin step, not something doable from here. If an "Order fulfillment"
   webhook to this same URL already exists from an earlier setup pass,
   delete it and create the new one instead of trying to edit its event —
   this legacy webhook type doesn't support changing the event after
   creation.)
2. Copy the **signing secret** shown on that same Notifications page, set it
   as a Supabase secret: `supabase secrets set SHOPIFY_WEBHOOK_SECRET=...`
   (Supabase CLI) or dashboard → Edge Functions → `shopify-order-webhook` →
   Secrets.

