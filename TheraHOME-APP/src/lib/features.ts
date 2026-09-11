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
const IAP_ENABLED_IOS = false; // flip only in a post-approval iOS build
const IAP_ENABLED_ANDROID = false; // flip after the Android checklist above is done
export const IAP_ENABLED = Platform.OS === 'android' ? IAP_ENABLED_ANDROID : IAP_ENABLED_IOS;
