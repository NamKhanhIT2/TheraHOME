import React, { useEffect, useRef, useState } from 'react';
import { AppState, LogBox, Platform, Text, View } from 'react-native';
import { NavigationBar } from 'expo-navigation-bar';
import { Stack, router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClient, QueryClientProvider, focusManager } from '@tanstack/react-query';
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
import { useProfile, useUpdateProfile } from '@/hooks/useProfile';
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
  const updateProfile = useUpdateProfile(userId);
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
  // Reaching the tabs only needs a session + a loaded profile that's past
  // onboarding/country — activation status plays no part in this anymore.
  const authed = !!session && !!profile;
  // Driven by the stored flag, not by account type. It used to also require
  // `!isTheraIssuedAccount`, which excluded EVERY admin-issued account and
  // so made the "Yêu cầu onboarding" switch in Admin do nothing at all —
  // the opposite of what that switch and this comment promised. Staff
  // (admin/cskh) are the only accounts that skip regardless: they have no
  // patient program to set up. Review accounts are created with the flag
  // already true, so App Review still lands straight in the app.
  const onboardingPending = authed && !isStaffAccount && profile?.onboardingCompleted === false;
  // Same shape: the stored flag decides. `admin-manage-account` always writes
  // country_confirmed = true for the accounts it creates, so they still skip
  // this; only a real signup that has not picked a region yet sees it.
  // Checked after onboardingPending so the intake questions come first.
  const countryPending = authed && !isStaffAccount && !onboardingPending && profile?.countryConfirmed === false;
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
  // Only PUBLISHED roadmaps can be reminded about — an owner of a device
  // whose roadmap is still "coming soon" has no day to be reminded of.
  const publishedPrograms = programsQuery.data?.filter((p) => p.product.roadmapPublished);
  const reminderProgram =
    publishedPrograms?.find((p) => p.productId === selectedProductIdForReminder) ?? publishedPrograms?.[0];
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
      void supabase.auth.signOut().catch((e: unknown) => { if (__DEV__) console.warn('signOut failed:', e); });
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
  // Read as plain values rather than off `profile` inside the effect, so the
  // dependency list can name exactly what it uses instead of the whole object
  // (which changes identity on every refetch).
  const profileLanguage = profile?.language;
  const profileLanguageExplicit = profile?.languageExplicit;
  const profileAccountType = profile?.accountType;
  const profileCountry = profile?.country;
  useEffect(() => {
    if (profileLanguageExplicit) {
      if (profileLanguage === 'vi' || profileLanguage === 'en' || profileLanguage === 'ms') {
        setLanguage(profileLanguage as AppLanguage, { auto: false });
      }
      return;
    }
    // Admin-issued accounts never see country.tsx (RootNavigator treats them
    // as inApp), so they never get `language_explicit` set and used to sit on
    // whatever this device had — a UK-market account read the app, and its
    // onboarding questionnaire, in Vietnamese. The market an Admin picked for
    // the account IS the deliberate choice here, so derive from it. Normal
    // accounts keep the device-locale default until the user picks for real.
    const fromMarket: AppLanguage | null =
      profileAccountType && profileAccountType !== 'normal' && profileCountry
        ? profileCountry === 'VN' ? 'vi' : profileCountry === 'US' ? 'en' : profileCountry === 'MALAY' ? 'ms' : null
        : null;
    if (fromMarket) setLanguage(fromMarket, { auto: false });

    // Then the sync in the other direction, which was missing entirely (owner
    // report, 2026-09-07: "ngôn ngữ ko đồng bộ" — an English UI getting
    // Vietnamese answers from the assistant).
    //
    // Until someone picks a language for real, the app reads what it decided
    // — the device locale, or the market above — off the store, while
    // `profiles.language` keeps whatever the row was created with. Everything
    // written on the SERVER reads that column and never the store:
    // chat-ai-reply's LANGUAGE RULE, the push dispatchers, the
    // system-notification templates. So a customer reading the app in English
    // was answered in Vietnamese, and their notifications arrived in
    // Vietnamese too. Two rows are in exactly that state today, plus one
    // admin-issued UK account still carrying language 'vi'.
    //
    // Writing `language` alone (never `language_explicit`) keeps this a
    // default, not a choice: the settings screen and country.tsx still own
    // the explicit flag, and this branch stops running the moment either sets
    // it. The profile refetch that follows makes the two equal, so it writes
    // once, not on every launch.
    const effective = fromMarket ?? language;
    if (profileLanguage && profileLanguage !== effective) {
      updateProfile.mutate(
        { language: effective },
        { onError: (e: unknown) => { if (__DEV__) console.warn('language sync failed:', e); } },
      );
    }
    // `updateProfile` is a stable mutation object; listing it re-runs this on
    // every render of the provider.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profileLanguage, profileLanguageExplicit, profileAccountType, profileCountry, language, setLanguage]);

  if (!fontsReady || sessionLoading || profileLoading || !minimumSplashElapsed) {
    return <AppSplashScreen />;
  }

  if (blockedReason) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.colors.bgApp, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 20 }}>
        <StatusBar style={theme.dark ? 'light' : 'dark'} />
        {/* Same idea at the bottom of the screen: Android draws the navigation
            buttons light by default, assuming a dark bar behind them. The tab bar
            paints that strip itself and in light mode it is pale, which left the
            buttons barely legible. No-op on iOS. */}
        <NavigationBar style={theme.dark ? 'light' : 'dark'} />
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
      <NavigationBar style={theme.dark ? 'light' : 'dark'} />
      {/* Android's native-stack default is a fade-and-scale, so tapping a
          roadmap day made the next screen bloom in place while the same tap
          on iOS pushed it in from the right. Matched to iOS on request.
          Scoped to Android: iOS already slides, and leaving it on `default`
          there keeps UIKit's own push/modal behaviour untouched. */}
      <Stack screenOptions={{ headerShown: false, animation: Platform.OS === 'android' ? 'slide_from_right' : 'default' }}>
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
          <Stack.Screen name="profile/delete-account" options={{ presentation: 'modal', animation: Platform.OS === 'android' ? 'slide_from_bottom' : 'default' }} />
          <Stack.Screen name="notifications" />
          <Stack.Screen name="community/[postId]" />
          <Stack.Screen name="community/profile/[userId]" />
          <Stack.Screen name="community/article/[articleId]" />
          <Stack.Screen name="community/create" options={{ presentation: 'modal', animation: Platform.OS === 'android' ? 'slide_from_bottom' : 'default' }} />
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
        <Stack.Screen name="profile/legal/[doc]" options={{ presentation: 'modal', animation: Platform.OS === 'android' ? 'slide_from_bottom' : 'default' }} />
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

  // React Query's focus refetching is a no-op in React Native until
  // `focusManager` is wired to AppState. Without it, admin-managed reference
  // data (the product list, a roadmap's phases) was fetched once per app
  // launch and never again — deleting a phase in WEB Admin left it on screen
  // for everyone who already had the app open, until they force-quit it
  // (owner-reported 2026-09-05). Registered here rather than at module scope:
  // a module-scope listener is never removed, and Fast Refresh leaves the old
  // one bound to a dead module instance.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      focusManager.setFocused(state === 'active');
    });
    return () => sub.remove();
  }, []);

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
