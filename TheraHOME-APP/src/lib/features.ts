/**
 * App-level feature switches.
 *
 * IAP (the roadmap phase-unlock / paywall) is intentionally OFF for now
 * (owner, 2026-09-09: "chưa cần IAP trong app"). While `IAP_ENABLED` is false
 * no phase is ever locked, so the paywall and the "Mở khoá ngay" purchase card
 * are never reachable and `react-native-iap`'s StoreKit/Play Billing
 * connection is never opened — regardless of any `phase_promos` rows. The
 * native module stays installed, so this can be flipped back to `true` and
 * shipped without a native rebuild once purchasing is actually wanted.
 */
export const IAP_ENABLED = false;
