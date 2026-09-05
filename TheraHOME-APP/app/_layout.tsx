import React, { useEffect, useRef, useState } from 'react';
import { AppState, LogBox, Text, View } from 'react-native';
import { Stack, router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  useFonts,
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from '@expo-google-fonts/inter';
import { ThemeProvider, useTheme } from '@/theme';
import { useSession } from '@/hooks/useSession';
import { useActivatedPrograms } from '@/hooks/usePrograms';
import { useAccessibleProgress } from '@/hooks/useAccessibleProgress';
import { useProfile } from '@/hooks/useProfile';
import { useAppStore, type AppLanguage } from '@/store/useAppStore';
import { translate } from '@/lib/i18n';
import { supabase } from '@/lib/supabase';
import { scheduleDailyReminder, scheduleEveningReminder, registerLocalReminderInboxSync, backfillTodaysReminders } from '@/lib/pushNotifications';
import { Button } from '@/components/ui/Button';
import { AppSplashScreen } from '@/components/onboarding/AppSplashScreen';

const LAST_LOGIN_TOUCH_MIN_INTERVAL_MS = 10 * 60 * 1000;

const queryClient = new QueryClient();

// Known-benign RN core noise: native-driven Animated values (e.g. Home's
// scroll parallax) can emit one update after their JS listeners are gone
// (unmount/tab switch/fast refresh). Nothing is wrong or leaking — see the
// long-standing facebook/react-native issue thread on this exact warning.
// Deliberately NOT "fixed" by adding a no-op JS listener: that would force
// native→JS traffic on every scroll frame just to silence a false alarm.
LogBox.ignoreLogs(['Sending `onAnimatedValueUpdate` with no listeners registered.']);

// Module-level, not component state: fixed once when this module first
// evaluates (real app boot), so a RootNavigator remount can't restart this
// clock and keep the splash screen stuck forever. Investigated a real case
// of this (2026-08-26, see login.tsx's `startOAuthOnboarding` fix) where a
// forced onboarding-state reset on every Google login raced RootNavigator's
// gate into repeated remounts — this alone can't prevent that class of bug,
// but it guarantees the splash can't hang indefinitely even if some other
// future edge case causes repeated remounts here.
const APP_BOOT_TIME = Date.now();
// Dev builds skip the enforced minimum: a Metro-connected launch often boots
// twice in a row (cached bundle first, then the freshly built one triggers a
// reload), and holding the full brand animation on each pass made startup
// feel like it "loads twice". Production keeps the branded minimum.
const MIN_SPLASH_MS = __DEV__ ? 0 : 1820;

type BlockedReason = 'locked' | 'expired' | null;


function RootNavigator({ fontsReady }: { fontsReady: boolean }) {
  const theme = useTheme();
  const { session, loading: sessionLoading } = useSession();
  const userId = session?.user.id;
  const profileQuery = useProfile(userId);
  const profile = profileQuery.data;
  const profileLoading = !!userId && profileQuery.isPending;
  const language = useAppStore((state) => state.language);
  const setLanguage = useAppStore((state) => state.setLanguage);
  const [blockedReason, setBlockedReason] = useState<BlockedReason>(null);
  const [minimumSplashElapsed, setMinimumSplashElapsed] = useState(() => Date.now() - APP_BOOT_TIME >= MIN_SPLASH_MS);
  const lastLoginTouchRef = useRef(0);

  useEffect(() => {
    if (minimumSplashElapsed) return;
    const remaining = MIN_SPLASH_MS - (Date.now() - APP_BOOT_TIME);
    const timeout = setTimeout(() => setMinimumSplashElapsed(true), Math.max(remaining, 0));
    return () => clearTimeout(timeout);
  }, [minimumSplashElapsed]);
  // Latest reminder settings, read by the AppState 'active' handler below to
  // backfill today's local reminder(s) into the notification center on every
  // foreground — not just when settings/day/language actually change (see
  // the effect that populates it further down, and `backfillTodaysReminders`
  // in pushNotifications.ts for why a foreground-triggered check is what
  // actually fixes "reminder fired but never shows up in the inbox").
  const reminderSettingsRef = useRef<{
    dailyEnabled: boolean;
    dailyTime: string;
    eveningEnabled: boolean;
    eveningTime: string;
    language: AppLanguage;
    dayNumber?: number;
  } | null>(null);
  // Activation (claiming a contact, which also provisions every catalog
  // program) is no longer required to enter the app at all — only to unlock
  // the Roadmap tab's real content (see roadmap.tsx's own gate, which
  // computes this itself). `programsQuery` is still needed here for the
  // reminder-scheduling effect below (`currentDay`).
  const programsQuery = useActivatedPrograms(userId);
  // 'admin'/'cskh' TheraHOME-issued accounts are pure staff, not patients —
  // they never have a claimed contact or a real program, so they short-
  // circuit straight past the whole patient onboarding/country sequence
  // into the (staff) shell (see the Stack.Protected split below).
  const isStaffAccount = profile?.accountType === 'admin' || profile?.accountType === 'cskh';
  const isTheraIssuedAccount = !!profile && profile.accountType !== 'normal';
  // Reaching the tabs only needs a session + a loaded profile that's past
  // onboarding/country — activation status plays no part in this anymore.
  const authed = !!session && !!profile;
  // Admin-issued accounts can be created with onboarding_completed=false so
  // they walk through the same intake screens a fresh Google/Apple signup
  // would see — everyone else defaults to true (see
  // theraccount_columns_and_guard migration), so this never affects
  // existing users.
  const onboardingPending = authed && !isStaffAccount && !isTheraIssuedAccount && profile?.onboardingCompleted === false;
  // Gates the pre-tabs country/region screen (app/(onboarding)/country.tsx)
  // — shown once, right after onboarding, for every account type (default
  // false on new rows; existing rows were backfilled true by the
  // country_confirmed_gate migration so this never affects pre-existing
  // users). Checked after onboardingPending so admin-issued accounts still
  // see the intake questions first. Staff accounts never see it.
  const countryPending = authed && !isStaffAccount && !isTheraIssuedAccount && !onboardingPending && profile?.countryConfirmed === false;
  const inApp = authed && !onboardingPending && !countryPending && !blockedReason;

  // Also doubles as the "last active" heartbeat the win-back notification
  // job reads (profiles.last_login_at) — a persisted session means most
  // opens never re-authenticate, so touching only on session-id change would
  // almost never fire after the first login. The AppState listener below
  // additionally touches it on every foreground, throttled client-side so a
  // user bouncing in and out doesn't spam the RPC.
  useEffect(() => {
    if (!session?.user.id) return;
    const touch = () => {
      const now = Date.now();
      if (now - lastLoginTouchRef.current < LAST_LOGIN_TOUCH_MIN_INTERVAL_MS) return;
      lastLoginTouchRef.current = now;
      void (async () => {
        try {
          const { error } = await supabase.rpc('touch_last_login');
          if (error && __DEV__) console.warn('touch_last_login failed:', error);
        } catch (error) {
          if (__DEV__) console.warn('touch_last_login skipped while offline:', error);
        }
      })();
    };
    const runReminderBackfill = () => {
      const s = reminderSettingsRef.current;
      if (!s) return;
      void (async () => {
        try {
          await backfillTodaysReminders(s.dailyEnabled, s.dailyTime, s.eveningEnabled, s.eveningTime, s.language, s.dayNumber);
        } catch (error) {
          if (__DEV__) console.warn('Reminder inbox sync skipped while offline:', error);
        }
      })();
    };
    touch();
    runReminderBackfill();
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        touch();
        runReminderBackfill();
      }
    });
    return () => sub.remove();
  }, [session?.user.id]);

  // Registered once (not per session change) — the listener itself reads
  // the *current* user id via this ref on every notification it receives,
  // rather than closing over a value from whenever it was registered.
  const userIdRef = useRef(userId);
  useEffect(() => {
    userIdRef.current = userId;
  }, [userId]);
  useEffect(() => {
    return registerLocalReminderInboxSync(() => userIdRef.current);
  }, []);

  // Refreshes the two local daily reminders with the user's current roadmap
  // day every time the app opens with an active program — see the comment
  // on `scheduleDailyReminder` for why this is needed (local notifications
  // can't self-update their content). Only depends on primitive values so it
  // re-fires exactly when something relevant actually changed (day advanced,
  // settings changed, language changed), not on every render.
  // ACCESSIBLE day, not raw calendar day — an IAP-locked, unpurchased
  // phase 3 caps this at 14, so the daily reminder never announces "ngày
  // thứ 15..28" for content the user can't open (per explicit request
  // 2026-09-04). Same source Home's "Ngày N/X" hero uses. With several
  // activated programs the reminder follows the one the user actually has
  // selected (falling back to the first), matching Home/Roadmap.
  const selectedProductIdForReminder = useAppStore((s) => s.selectedProductId);
  const reminderProgram =
    programsQuery.data?.find((p) => p.productId === selectedProductIdForReminder) ?? programsQuery.data?.[0];
  const accessibleProgress = useAccessibleProgress(userId, reminderProgram);
  // undefined until the lock/purchase queries settle — the effect below
  // must not run on the provisional (possibly uncapped) value, because
  // backfillTodaysReminders writes a PERMANENT inbox row and dedupes per
  // day, so a wrong day number would stick.
  const currentDay = !accessibleProgress.isReady
    ? undefined
    : accessibleProgress.day > 0
      ? accessibleProgress.day
      : reminderProgram?.currentDay;
  useEffect(() => {
    if (!inApp || !profile || currentDay == null) return;
    reminderSettingsRef.current = {
      dailyEnabled: profile.dailyReminderEnabled,
      dailyTime: profile.dailyReminderTime,
      eveningEnabled: profile.eveningReminderEnabled,
      eveningTime: profile.eveningReminderTime,
      language: language as AppLanguage,
      dayNumber: currentDay,
    };
    void scheduleDailyReminder(profile.dailyReminderEnabled, profile.dailyReminderTime, language as AppLanguage, currentDay)
      .catch((error: unknown) => {
        if (__DEV__) console.warn('Daily reminder scheduling failed:', error);
      });
    void scheduleEveningReminder(profile.eveningReminderEnabled, profile.eveningReminderTime, language as AppLanguage)
      .catch((error: unknown) => {
        if (__DEV__) console.warn('Evening reminder scheduling failed:', error);
      });
    void backfillTodaysReminders(profile.dailyReminderEnabled, profile.dailyReminderTime, profile.eveningReminderEnabled, profile.eveningReminderTime, language as AppLanguage, currentDay)
      .catch((error: unknown) => {
        if (__DEV__) console.warn('Reminder inbox backfill skipped while offline:', error);
      });
  }, [
    inApp,
    profile?.dailyReminderEnabled,
    profile?.dailyReminderTime,
    profile?.eveningReminderEnabled,
    profile?.eveningReminderTime,
    currentDay,
    language,
  ]);

  useEffect(() => {
    if (!profile || blockedReason) return;
    // App Review accounts are never blocked or expired (per explicit
    // request 2026-09-03) — a reviewer hitting a lock screen mid-review is
    // an instant rejection. Revoke one by deleting the account instead.
    if (profile.accountType === 'review') return;
    const expired = !!profile.expiresAt && new Date(profile.expiresAt) < new Date();
    if (profile.locked || expired) {
      setBlockedReason(profile.locked ? 'locked' : 'expired');
      supabase.auth.signOut();
    }
  }, [profile, blockedReason]);

  useEffect(() => {
    if (!sessionLoading && !profileLoading && onboardingPending) {
      router.replace('/questions');
    }
  }, [sessionLoading, profileLoading, onboardingPending]);

  useEffect(() => {
    if (!sessionLoading && !profileLoading && !onboardingPending && countryPending) {
      router.replace('/country');
    }
  }, [sessionLoading, profileLoading, onboardingPending, countryPending]);

  // Only trust `profile.language` once it's an actual deliberate choice
  // (country.tsx's confirm step, or the Account Settings picker — both set
  // `language_explicit: true` alongside it). Every profile row otherwise
  // defaults to 'vi' at creation regardless of the device's real locale —
  // syncing that unconditionally used to silently overwrite the client's
  // own device-locale-detected default (see useAppStore.ts) back to
  // Vietnamese for any account (including every pre-existing one) that has
  // never actually picked a language.
  useEffect(() => {
    if (!profile?.languageExplicit) return;
    if (profile.language === 'vi' || profile.language === 'en' || profile.language === 'ms') {
      setLanguage(profile.language as AppLanguage, { auto: false });
    }
  }, [profile?.language, profile?.languageExplicit, setLanguage]);

  if (!fontsReady || sessionLoading || profileLoading || !minimumSplashElapsed) {
    return <AppSplashScreen />;
  }

  if (blockedReason) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.colors.bgApp, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 20 }}>
        <StatusBar style={theme.dark ? 'light' : 'dark'} />
        <Text style={{ color: theme.colors.textPrimary, fontSize: 16, fontWeight: '600', textAlign: 'center', lineHeight: 24 }}>
          {translate(language, blockedReason === 'locked' ? 'accountLocked' : 'accountExpired')}
        </Text>
        <Button
          onPress={() => {
            setBlockedReason(null);
            router.replace('/login');
          }}
        >
          {translate(language, 'backLabel')}
        </Button>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.bgApp }}>
      <StatusBar style={theme.dark ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false }}>
        {/* Stable cold-launch/deep-link entry. Kept outside every protected
            group so `/` always exists while auth/profile guards switch. */}
        <Stack.Screen name="index" />
        <Stack.Protected guard={inApp && !isStaffAccount}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="activate" />
          <Stack.Screen name="day/[dayId]" />
          <Stack.Screen name="paywall/[phaseId]" />
          <Stack.Screen name="profile/index" />
          <Stack.Screen name="profile/edit" />
          <Stack.Screen name="profile/notifications-settings" />
          <Stack.Screen name="profile/account" />
          <Stack.Screen name="profile/help" />
          <Stack.Screen name="profile/delete-account" options={{ presentation: 'modal' }} />
          <Stack.Screen name="notifications" />
          <Stack.Screen name="community/[postId]" />
          <Stack.Screen name="community/profile/[userId]" />
          <Stack.Screen name="community/article/[articleId]" />
          <Stack.Screen name="community/create" options={{ presentation: 'modal' }} />
          <Stack.Screen name="chat/ai" />
          <Stack.Screen name="chat/human" />
          <Stack.Screen name="quiz/[phaseId]" />
        </Stack.Protected>
        {/* Staff chat screens are reachable from BOTH shells (AssistantBubble
            shows the conversation list to staff inside (tabs) too), so they
            gate on being signed in rather than on a specific shell. */}
        <Stack.Protected guard={inApp}>
          <Stack.Screen name="chat/admin-conversations" />
          <Stack.Screen name="chat/admin-thread/[threadId]" />
        </Stack.Protected>
        {/* Purely-staff TheraHOME accounts (admin/cskh, no patient program)
            — a dedicated 3-tab shell (Chat/Cộng đồng/Thông báo), not the
            patient (tabs). See CLAUDE.md's CSKH-vs-dual-role-admin note. */}
        <Stack.Protected guard={inApp && isStaffAccount}>
          <Stack.Screen name="(staff)" />
        </Stack.Protected>
        <Stack.Protected guard={!inApp}>
          <Stack.Screen name="(onboarding)" />
        </Stack.Protected>
        {/* Legal docs are reachable from onboarding (pre-auth) as well as
            Profile settings (post-auth), so this route is registered
            unconditionally rather than inside either Stack.Protected group. */}
        <Stack.Screen name="profile/legal/[doc]" options={{ presentation: 'modal' }} />
      </Stack>
    </View>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  useEffect(() => {
    if (fontError && __DEV__) console.warn('Unable to load Inter fonts; using system fallback:', fontError);
  }, [fontError]);

  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <RootNavigator fontsReady={fontsLoaded || !!fontError} />
        </ThemeProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
