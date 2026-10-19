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
 * It was false until build 35, and for a good reason: the purchase path was
 * built (verify-subscription + user_subscriptions + active_plan_code()) but
 * no feature ASKED active_plan_code() anything, so buying granted nothing.
 * Selling a tier that changes nothing is both a refund waiting to happen and
 * an App Review rejection.
 *
 * That is no longer the case, and this list is the answer to "does the
 * paywall promise anything the code does not enforce?" — a question worth
 * re-asking every time a benefit line is added in WEB Admin → "Gói đăng ký",
 * because that editor can write a promise nothing implements:
 *
 *   ai_chat_daily_allowance()    chat AI, per local day
 *   call_minutes_allowance()     1-1 calls, per local month
 *   form_review_mb_allowance()   chấm dáng tập, megabytes per month
 *   has_paid_access()            tập cùng chuyên viên + its reference clips
 *   suggested_reminder_hour()    reminders that follow the customer's habits
 *   dispatch-weekly-reports      the weekly progress report
 *   coin_settings.plan_codes     the xu programme (Plus and Trọn Đời only)
 *
 * The free tier is the floor in `baseline_limits()` — two AI messages a day,
 * no call minutes, no form-check megabytes — so the gap a customer pays to
 * cross is real. Review accounts are exempt from every one of these, checked
 * individually inside each function (see the memory rule: account_type
 * 'review' bypasses every gate).
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
// Flipped 2026-10-13 for build 35. Safe on its own: `canBuy` in
// useSubscription also requires the store to have RETURNED the product, so on
// a platform whose products do not exist yet (Android has none at all, and
// Apple's are still being created) every button stays "Sắp mở". Step 0 of
// docs/manual-setup.md is done — every benefit line is enforced — so this no
// longer sells anything that does nothing.
export const SUBSCRIPTIONS_ENABLED = true;

/**
 * "Tập cùng chuyên viên" — the live form check (app/train/[dayId].tsx).
 *
 * TWO SWITCHES, and they are not redundant:
 *
 * - THIS one is the build. False means the feature is not in this version
 *   at all: no card, no route, nothing for App Review to see and nothing
 *   for a customer to find. That is the honest way to ship a version whose
 *   native pose module has not been tested yet — inert, not hidden.
 * - `app_config.motion_tracking_enabled`, edited in WEB Admin → "Nội dung
 *   ứng dụng", is the kill switch for a version where it IS shipped and
 *   reviewed. It reaches every phone in about five minutes.
 *
 * The distinction matters for Guideline 2.3.1: a remote switch may turn a
 * reviewed feature OFF, but using one to light up functionality App Review
 * never saw is what that rule forbids. So a build either contains this
 * feature and shows it, or does not contain it.
 */
export const MOTION_TRACKING_ENABLED = true;
