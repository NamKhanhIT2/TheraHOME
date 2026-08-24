import React, { useEffect, useRef, useState } from 'react';
import { AppState, Text, View } from 'react-native';
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
import { useProfile } from '@/hooks/useProfile';
import { useAccessContact } from '@/hooks/useAccessContact';
import { useAppStore, type AppLanguage } from '@/store/useAppStore';
import { supabase } from '@/lib/supabase';
import { scheduleDailyReminder, scheduleEveningReminder, registerLocalReminderInboxSync, backfillTodaysReminders } from '@/lib/pushNotifications';
import { Button } from '@/components/ui/Button';

const LAST_LOGIN_TOUCH_MIN_INTERVAL_MS = 10 * 60 * 1000;

const queryClient = new QueryClient();

type BlockedReason = 'locked' | 'expired' | null;

const BLOCKED_COPY: Record<Exclude<BlockedReason, null>, string> = {
  locked: 'Tài khoản này hiện đã bị khóa.\nVui lòng liên hệ TheraHOME để được hỗ trợ.',
  expired: 'Quyền truy cập của tài khoản đã hết hạn.\nVui lòng liên hệ TheraHOME để gia hạn.',
};

function RootNavigator() {
  const theme = useTheme();
  const { session, loading: sessionLoading } = useSession();
  const userId = session?.user.id;
  const profile = useProfile(userId).data;
  const language = useAppStore((state) => state.language);
  const setLanguage = useAppStore((state) => state.setLanguage);
  const [blockedReason, setBlockedReason] = useState<BlockedReason>(null);
  const lastLoginTouchRef = useRef(0);
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
  // Access now requires a uniquely claimed contact. The claim RPC also
  // provisions every catalog program; orders/device codes are not involved.
  const contactQuery = useAccessContact(userId);
  const programsQuery = useActivatedPrograms(userId);
  const activationLoading = !!userId && (contactQuery.isPending || programsQuery.isPending);
  // 'admin'/'cskh' TheraHOME-issued accounts are pure staff, not patients —
  // they never have a claimed contact or a real program, so they short-
  // circuit straight past the whole patient activation/onboarding/country
  // sequence into the (staff) shell (see the Stack.Protected split below).
  const isStaffAccount = profile?.accountType === 'admin' || profile?.accountType === 'cskh';
  const hasAccess = isStaffAccount || (!!contactQuery.data && (programsQuery.data?.length ?? 0) > 0);
  // Admin-issued accounts can be created with onboarding_completed=false so
  // they walk through the same intake screens a fresh Google/Apple signup
  // would see before /activate — everyone else defaults to true (see
  // theraccount_columns_and_guard migration), so this never affects
  // existing users.
  const onboardingPending = hasAccess && !isStaffAccount && profile?.onboardingCompleted === false;
  // Gates the new pre-tabs country/region screen (app/(onboarding)/country.tsx)
  // — shown once, right after activation, for every account type (default
  // false on new rows; existing rows were backfilled true by the
  // country_confirmed_gate migration so this never affects pre-existing
  // users). Checked after onboardingPending so admin-issued accounts still
  // see the intake questions first. Staff accounts never see it.
  const countryPending = hasAccess && !isStaffAccount && !onboardingPending && profile?.countryConfirmed === false;
  const inApp = !!session && hasAccess && !onboardingPending && !countryPending && !blockedReason;

  // Shared post-auth gate for all 3 login methods (Google/Apple/TheraHOME
  // account) — each just establishes a session and pushes to /activate;
  // everything below decides what actually happens next from there.
  //
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
      supabase.rpc('touch_last_login').then(({ error }) => {
        if (error && __DEV__) console.warn('touch_last_login failed:', error);
      });
    };
    const runReminderBackfill = () => {
      const s = reminderSettingsRef.current;
      if (!s) return;
      void backfillTodaysReminders(s.dailyEnabled, s.dailyTime, s.eveningEnabled, s.eveningTime, s.language, s.dayNumber);
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
  const currentDay = programsQuery.data?.[0]?.currentDay;
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
    void scheduleDailyReminder(profile.dailyReminderEnabled, profile.dailyReminderTime, language as AppLanguage, currentDay);
    void scheduleEveningReminder(profile.eveningReminderEnabled, profile.eveningReminderTime, language as AppLanguage);
    void backfillTodaysReminders(profile.dailyReminderEnabled, profile.dailyReminderTime, profile.eveningReminderEnabled, profile.eveningReminderTime, language as AppLanguage, currentDay);
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
    const expired = !!profile.expiresAt && new Date(profile.expiresAt) < new Date();
    if (profile.locked || expired) {
      setBlockedReason(profile.locked ? 'locked' : 'expired');
      supabase.auth.signOut();
    }
  }, [profile, blockedReason]);

  // A returning user who signed in but never claimed a contact should land
  // back on /activate, not restart at /welcome.
  useEffect(() => {
    if (!sessionLoading && !activationLoading && session && !hasAccess) {
      router.replace('/activate');
    }
  }, [sessionLoading, activationLoading, session, hasAccess]);

  useEffect(() => {
    if (!sessionLoading && !activationLoading && onboardingPending) {
      router.replace('/questions');
    }
  }, [sessionLoading, activationLoading, onboardingPending]);

  useEffect(() => {
    if (!sessionLoading && !activationLoading && !onboardingPending && countryPending) {
      router.replace('/country');
    }
  }, [sessionLoading, activationLoading, onboardingPending, countryPending]);

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

  if (sessionLoading || activationLoading) {
    return <View style={{ flex: 1, backgroundColor: theme.colors.bgApp }} />;
  }

  if (blockedReason) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.colors.bgApp, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 20 }}>
        <StatusBar style={theme.dark ? 'light' : 'dark'} />
        <Text style={{ color: theme.colors.textPrimary, fontSize: 16, fontWeight: '600', textAlign: 'center', lineHeight: 24 }}>
          {BLOCKED_COPY[blockedReason]}
        </Text>
        <Button
          onPress={() => {
            setBlockedReason(null);
            router.replace('/welcome');
          }}
        >
          Quay lại
        </Button>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.bgApp }}>
      <StatusBar style={theme.dark ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Protected guard={inApp && !isStaffAccount}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="day/[dayId]" />
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
  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  if (!fontsLoaded) {
    return null;
  }

  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <RootNavigator />
        </ThemeProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
