// Client-only app state. Auth (Phase 2), program/pain/water data (Phase 3),
// community (Phase 4), chat (Phase 5), and notifications/profile (Phase 6)
// now all live in real Supabase queries — see src/hooks/useSession.ts,
// usePrograms.ts, useWaterLog.ts, useCommunity.ts, useChat.ts,
// useNotifications.ts, useProfile.ts. What's left here is genuinely
// local/UI-only state: theme preference, in-progress onboarding answers,
// which activated program is selected, and whether the notification
// permission prompt has been dismissed once. See CLAUDE.md.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export type AnswerValue = string | string[];
export type AppLanguage = 'vi' | 'en' | 'ms';
export type AppMarket = 'vietnam' | 'us-eu' | 'malay';

interface AppState {
  // Theme
  darkMode: boolean;
  toggleDarkMode: () => void;
  setDarkMode: (v: boolean) => void;

  language: AppLanguage;
  // True while `language` is still just a passive default (device-locale
  // detected, or synced from a profile row that's never been explicitly
  // set) rather than something the user actually picked. Lets a later
  // device-locale re-check (see `onRehydrateStorage` below) keep following
  // the device's language across app restarts right up until the user (or
  // their profile) makes a real choice — at which point it's pinned and
  // stops following the device.
  languageAutoDetected: boolean;
  setLanguage: (language: AppLanguage, opts?: { auto?: boolean }) => void;
  market: AppMarket | null;
  setMarket: (market: AppMarket) => void;
  /** Drops everything in here that belonged to the account that just signed
   * out. See the implementation for what counts and what deliberately does
   * not. */
  clearAccountPreferences: () => void;
  /** Has this DEVICE ever had a session? False only until the first sign-in
   * or sign-up, which is how the auth stack knows to open on "Tạo tài
   * khoản" rather than on "Đăng nhập" (owner, 2026-10-28). Survives signing
   * out on purpose — a returning person wants the login screen. */
  everSignedIn: boolean;
  markSignedInOnce: () => void;

  // Onboarding
  onboardingAnswers: Record<string, AnswerValue>;
  onboardingQuestionIndex: number;
  /** Who those answers belong to. The questionnaire runs AFTER sign-up, so
   * there is always an account to attribute them to — and a different one
   * must never inherit them (QA pass, 2026-10-30). */
  onboardingOwnerId: string | null;
  claimOnboardingFor: (userId: string) => void;
  setAnswer: (key: string, value: AnswerValue) => void;
  setOnboardingQuestionIndex: (index: number) => void;
  resetOnboardingAnswers: () => void;

  // Multi-device: which activated program the Home/Roadmap switcher shows.
  // Pure client-side UI preference — the actual activated-programs list
  // comes from `useActivatedPrograms()` (real `user_programs` query).
  selectedProductId: string | null;
  selectProduct: (id: string | null) => void;

  // Whether the post-login reminder-time popup has been shown/dismissed
  // once — a one-time UI preference, not server data. (The country/region
  // choice used to live here too, but is now gated server-side via
  // profiles.country_confirmed — see app/(onboarding)/country.tsx.)
  hasSeenReminderPrompt: boolean;
  setHasSeenReminderPrompt: (v: boolean) => void;
  waterRemindersOn: boolean;
  setWaterRemindersOn: (v: boolean) => void;

  // One-time consent for the AI assistant (App Review requirement: the
  // user must be told chat content goes to a third-party AI service and
  // agree before first use). Persisted so it's asked exactly once.
  aiConsentAccepted: boolean;
  acceptAiConsent: () => void;
  /** The customer ticked "Không hiển thị lại" on the upgrade prompt. */
  upgradePromptMuted: boolean;
  muteUpgradePrompt: () => void;
  /** The app version this customer said "Để sau" to, so the optional update
   * nudge asks once per release rather than once per launch. Holds the
   * version that was INSTALLED when they dismissed it; the next release
   * makes it stale and the nudge returns on its own. */
  updateNagDismissedAt: string | null;
  dismissUpdateNag: (version: string) => void;
  // True from confirming a password-reset code until the new password is
  // saved. verifyOtp('recovery') creates a live session, which would
  // otherwise drop the user straight into the app — this keeps the
  // set-new-password screen in front of them until they finish. Not
  // persisted: a fresh launch should never resume mid-reset.
  recoveringPassword: boolean;
  setRecoveringPassword: (value: boolean) => void;
}

// Best-effort device-locale detection for the language a brand-new install
// should default to (welcome/questions/login all read `language` off this
// store before any account/profile exists, so there's nowhere else to pull
// a starting language from). Uses the JS engine's own `Intl` — already
// available in Hermes with no extra native module — rather than
// `expo-localization`, which isn't a dependency of this project and would
// need a rebuild that can't be verified without a device/simulator here.
export function detectDeviceLanguage(): AppLanguage {
  try {
    const primary = Intl.DateTimeFormat().resolvedOptions().locale.split('-')[0].toLowerCase();
    if (primary === 'vi') return 'vi';
    if (primary === 'ms') return 'ms';
    // Any other foreign locale (fr, ko, ja, zh…) reads English far more
    // likely than Vietnamese — per explicit request 2026-09-03.
    return 'en';
  } catch {
    // Intl unavailable or locale unparsable — we know nothing about the
    // device, so fall back to the product's home market.
    return 'vi';
  }
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      darkMode: false,
      toggleDarkMode: () => set((s) => ({ darkMode: !s.darkMode })),
      setDarkMode: (v) => set({ darkMode: v }),
      language: detectDeviceLanguage(),
      languageAutoDetected: true,
      setLanguage: (language, opts) => set({ language, languageAutoDetected: opts?.auto ?? false }),
      market: null,
      setMarket: (market) => set({ market }),
      everSignedIn: false,
      markSignedInOnce: () => set({ everSignedIn: true }),
      // This store is persisted per DEVICE, but some of what it holds was
      // chosen by one ACCOUNT. Picking Malaysia in onboarding sets the
      // language explicitly; signing out used to leave the phone in Malay —
      // login screen included — and hand that language to whoever signed in
      // next, until their own profile overrode it (owner, 2026-10-26).
      //
      // The language goes back to following the device, and the market goes
      // back to unknown so `useMarket()` falls through to the next account's
      // own country instead of the last one's.
      //
      // Onboarding answers deliberately stay: "Tài khoản của bạn đã được
      // tạo. Bạn có thể đăng nhập lại để tiếp tục bất cứ lúc nào" is a
      // promise that a half-finished questionnaire survives a sign-out.
      clearAccountPreferences: () =>
        set({
          language: detectDeviceLanguage(),
          languageAutoDetected: true,
          market: null,
          selectedProductId: null,
        }),

      onboardingAnswers: {},
      onboardingQuestionIndex: 0,
      onboardingOwnerId: null,
      claimOnboardingFor: (userId) =>
        set((s) =>
          s.onboardingOwnerId === userId
            ? {}
            : // Someone else's half-finished questionnaire: drop it rather
              // than write their treatment area and goal onto this profile.
              { onboardingOwnerId: userId, onboardingAnswers: {}, onboardingQuestionIndex: 0 },
        ),
      setAnswer: (key, value) =>
        set((s) => ({ onboardingAnswers: { ...s.onboardingAnswers, [key]: value } })),
      setOnboardingQuestionIndex: (index) => set({ onboardingQuestionIndex: index }),
      resetOnboardingAnswers: () => set({ onboardingAnswers: {}, onboardingQuestionIndex: 0, onboardingOwnerId: null }),

      selectedProductId: null,
      selectProduct: (id) => set({ selectedProductId: id }),

      hasSeenReminderPrompt: false,
      setHasSeenReminderPrompt: (v) => set({ hasSeenReminderPrompt: v }),

      // The water switch on Home. Device-local, like the reminders it
      // schedules — there is no server state to keep in step.
      waterRemindersOn: false,
      setWaterRemindersOn: (v) => set({ waterRemindersOn: v }),

      aiConsentAccepted: false,
      acceptAiConsent: () => set({ aiConsentAccepted: true }),

      // "Không hiển thị lại" on the upgrade prompt. Same shape as
      // hasSeenReminderPrompt: persisted, so a customer who says no once is
      // not asked again on the next launch.
      upgradePromptMuted: false,
      muteUpgradePrompt: () => set({ upgradePromptMuted: true }),

      updateNagDismissedAt: null,
      dismissUpdateNag: (version) => set({ updateNagDismissedAt: version }),
      recoveringPassword: false,
      setRecoveringPassword: (value) => set({ recoveringPassword: value }),
    }),
    {
      name: 'therahome-app-state',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({
        darkMode: s.darkMode,
        everSignedIn: s.everSignedIn,
        language: s.language,
        languageAutoDetected: s.languageAutoDetected,
        market: s.market,
        onboardingAnswers: s.onboardingAnswers,
        onboardingQuestionIndex: s.onboardingQuestionIndex,
        onboardingOwnerId: s.onboardingOwnerId,
        selectedProductId: s.selectedProductId,
        hasSeenReminderPrompt: s.hasSeenReminderPrompt,
        waterRemindersOn: s.waterRemindersOn,
        aiConsentAccepted: s.aiConsentAccepted,
        upgradePromptMuted: s.upgradePromptMuted,
        updateNagDismissedAt: s.updateNagDismissedAt,
      }),
      // Re-checks the device locale against the *persisted* state once
      // rehydration actually completes (not at module-load time, before
      // AsyncStorage has resolved) — this is what keeps a returning user's
      // language following their device across app restarts, not just on a
      // brand-new install: if nothing has explicitly picked a language yet
      // (`languageAutoDetected` still true — the profile-sync effect in
      // app/_layout.tsx only ever flips it false once `language_explicit`
      // is true server-side), re-run detection in case the device's own
      // language changed since the last launch. Once anything sets an
      // explicit choice, this stops touching it.
      onRehydrateStorage: () => (state) => {
        if (!state?.languageAutoDetected) return;
        const detected = detectDeviceLanguage();
        if (detected !== state.language) state.setLanguage(detected, { auto: true });
      },
    },
  ),
);
