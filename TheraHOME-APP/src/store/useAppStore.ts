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

  // Onboarding
  onboardingAnswers: Record<string, AnswerValue>;
  onboardingQuestionIndex: number;
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

  // One-time consent for the AI assistant (App Review requirement: the
  // user must be told chat content goes to a third-party AI service and
  // agree before first use). Persisted so it's asked exactly once.
  aiConsentAccepted: boolean;
  acceptAiConsent: () => void;
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
    if (primary === 'en') return 'en';
    if (primary === 'ms') return 'ms';
  } catch {
    // Intl unavailable or locale unparsable — fall through to the default.
  }
  return 'vi';
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

      onboardingAnswers: {},
      onboardingQuestionIndex: 0,
      setAnswer: (key, value) =>
        set((s) => ({ onboardingAnswers: { ...s.onboardingAnswers, [key]: value } })),
      setOnboardingQuestionIndex: (index) => set({ onboardingQuestionIndex: index }),
      resetOnboardingAnswers: () => set({ onboardingAnswers: {}, onboardingQuestionIndex: 0 }),

      selectedProductId: null,
      selectProduct: (id) => set({ selectedProductId: id }),

      hasSeenReminderPrompt: false,
      setHasSeenReminderPrompt: (v) => set({ hasSeenReminderPrompt: v }),

      aiConsentAccepted: false,
      acceptAiConsent: () => set({ aiConsentAccepted: true }),
    }),
    {
      name: 'therahome-app-state',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({
        darkMode: s.darkMode,
        language: s.language,
        languageAutoDetected: s.languageAutoDetected,
        market: s.market,
        onboardingAnswers: s.onboardingAnswers,
        onboardingQuestionIndex: s.onboardingQuestionIndex,
        selectedProductId: s.selectedProductId,
        hasSeenReminderPrompt: s.hasSeenReminderPrompt,
        aiConsentAccepted: s.aiConsentAccepted,
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
