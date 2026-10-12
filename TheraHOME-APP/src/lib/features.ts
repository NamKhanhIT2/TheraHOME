import { Platform } from 'react-native';

/**
 * App-level feature switches.
 *
 * IAP (the roadmap phase-unlock / paywall) is gated PER PLATFORM (owner,
 * 2026-09-11): Android goes live with Google Play Billing first, while iOS
 * stays off until the first App Store version (build 21, under review) is
 * approved — only then does iOS IAP ship, in a later build. Splitting the flag
 * lets the two roll out independently from one shared codebase.
 *
 * While a platform's flag is false no phase is ever locked there, so the
 * paywall and the "Mở khoá ngay" purchase card are never reachable and
 * `react-native-iap`'s StoreKit/Play Billing connection is never opened —
 * regardless of any `phase_promos` rows. The native module stays installed,
 * so either flag can be flipped and shipped without a native rebuild.
 *
 * Flip order for Android (see plan): Play Console app + Internal testing AAB
 * + merchant profile + in-app products + license testers → service-account
 * secret for `verify-google-purchase` → `google_product_id` set per phase in
 * WEB Admin's Upsell editor → THEN `IAP_ENABLED_ANDROID = true`. Enabling it
 * earlier shows a paywall whose purchases fail.
 */
// Flipped 2026-09-29: the iOS app is live on the App Store, the four
// non-consumable products exist in App Store Connect, the Paid Apps
// agreement is active and `apple_product_id` is set on Giai đoạn 3. Build 22
// goes to TestFlight, where purchases run in Apple's sandbox.
const IAP_ENABLED_IOS = true;
// Android checklist done 2026-09-24: app live on Play, in-app product
// neckplus_phase3 created and activated, payments profile and the
// verify-google-purchase service-account secrets in place, phase 3 and its
// google_product_id configured. iOS stays off until its own build.
const IAP_ENABLED_ANDROID = true;
export const IAP_ENABLED = Platform.OS === 'android' ? IAP_ENABLED_ANDROID : IAP_ENABLED_IOS;

/**
 * The subscription ladder's BUY buttons (app/subscription.tsx). The screen
 * itself is always reachable — a free user is meant to read what the paid
 * tiers contain; this only controls whether anything can be bought.
 *
 * False because buying would grant nothing yet. The purchase path is built
 * (verify-subscription + user_subscriptions + active_plan_code()), but no
 * feature currently ASKS active_plan_code() anything: chấm dáng tập still
 * allows 4 clips a month to everybody, chat AI is unlimited for everybody,
 * and the call button has no tier check. Selling a tier that changes nothing
 * is both a refund waiting to happen and an App Review rejection.
 *
 * Note this is not the only gate: `canBuy` in useSubscription also requires
 * the store to have RETURNED the product, so a product id typed into WEB
 * Admin's "Gói đăng ký" tab can never light up a button on its own. Copy is
 * copy.
 *
 * Flip order (see docs/manual-setup.md "Subscriptions"): create the
 * subscription products on both stores → set their ids per plan in WEB
 * Admin → make the three paid features consult `active_plan_code()` → THEN
 * this, in that same build.
 */
export const SUBSCRIPTIONS_ENABLED = false;
