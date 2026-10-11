// Dedicated shell for purely-staff TheraHOME accounts (account_type
// 'admin'/'cskh', no patient program) — Chat / Cộng đồng / Thông báo, the 3
// most important areas per CLAUDE.md. No AssistantBubble/ReminderPopup,
// both patient-only concepts. See app/_layout.tsx's isStaffAccount gate for
// how accounts land here instead of (tabs).
import React, { useEffect, useRef } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Tabs, router } from 'expo-router';
import * as Notifications from 'expo-notifications';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/theme';
import { useSession } from '@/hooks/useSession';
import { useWebRoles } from '@/hooks/useWebRoles';
import { TAB_BAR_BODY_HEIGHT, TAB_BAR_BODY_PADDING_BOTTOM, useTabBarInset } from '@/hooks/useTabBarInset';
import { supabase } from '@/lib/supabase';
import { registerForPushNotifications } from '@/lib/pushNotifications';
import { Icon } from '@/components/icons/Icon';

const STAFF_TAB_ITEMS: { name: string; icon: string; label: string }[] = [
  { name: 'chat', icon: 'message-circle', label: 'Chat' },
  { name: 'community', icon: 'flag', label: 'Cộng đồng' },
  { name: 'notifications', icon: 'bell', label: 'Thông báo' },
];

function StaffHeader() {
  const theme = useTheme();
  const { session } = useSession();
  const rolesQuery = useWebRoles(session?.user.id);
  const roles = rolesQuery.data ?? [];
  const roleLabel = roles.includes('admin') ? 'Quản trị viên' : roles.includes('cskh') ? 'Chăm sóc khách hàng' : '';

  return (
    <SafeAreaView edges={['top']} style={{ backgroundColor: theme.dark ? theme.colors.bgCard : '#fff' }}>
      <View style={[styles.header, { borderBottomColor: theme.colors.borderLight }]}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={[theme.type.h2, { color: theme.colors.textPrimary }]}>TheraHOME</Text>
          {roleLabel ? <Text style={[theme.type.captionSm, { color: theme.colors.textMuted, marginTop: 1 }]}>{roleLabel}</Text> : null}
        </View>
        <Pressable
          onPress={() => void supabase.auth.signOut().catch((e: unknown) => { if (__DEV__) console.warn('signOut failed:', e); })}
          style={[styles.logoutBtn, { backgroundColor: theme.colors.bgCardAlt }]}
          hitSlop={8}
        >
          <Icon name="log-out" size={19} color={theme.colors.textPrimary} />
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

function StaffTabBar({ state, navigation }: Parameters<NonNullable<React.ComponentProps<typeof Tabs>['tabBar']>>[0]) {
  const theme = useTheme();
  // Same rule as the patient tab bar in (tabs)/_layout.tsx: grow only on
  // Android, where the edge-to-edge system navigation bar would otherwise sit
  // on top of the tab labels. On iOS this stays the original 84pt, which
  // already contains the home-indicator strip — my first version added the
  // inset on both platforms and pushed the bar 34pt up on iPhone.
  const tabBarInset = useTabBarInset();
  return (
    <View
      style={[
        styles.bar,
        {
          backgroundColor: theme.dark ? theme.colors.bgCard : '#fff',
          borderTopColor: theme.colors.borderLight,
          height: TAB_BAR_BODY_HEIGHT + tabBarInset,
          paddingBottom: TAB_BAR_BODY_PADDING_BOTTOM + tabBarInset,
        },
      ]}
    >
      {state.routes.map((route, index) => {
        const item = STAFF_TAB_ITEMS.find((i) => i.name === route.name);
        if (!item) return null;
        const isFocused = state.index === index;
        const color = isFocused ? theme.colors.primary : theme.colors.textMuted;
        return (
          <Pressable
            key={route.key}
            onPress={() => {
              const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
              if (!isFocused && !event.defaultPrevented) navigation.navigate(route.name);
            }}
            style={styles.tabBtn}
          >
            <Icon name={item.icon} size={23} color={color} />
            <Text style={[theme.type.captionSm, { color }]}>{item.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/**
 * Registers this device's push token for a staff account.
 *
 * The patient shell has done this since Phase 6, in (tabs)/_layout.tsx. This
 * shell never did, and a CSKH-only account never visits the patient shell —
 * so staff have had NO push token on file, ever. Measured 2026-10-11: zero
 * rows in push_tokens for any staff account, which is why no support-message
 * push and no incoming-call push could ever have arrived.
 *
 * It PROMPTS, unlike the patient shell's equivalent. That was the second
 * half of the same hole: the first version only synced an already-granted
 * permission, on the assumption that staff would be asked somewhere else —
 * and nowhere else asks. A CSKH account never passes through onboarding, so
 * the permission dialog was never shown, the sync found nothing to sync, and
 * push_tokens still held zero staff rows after the fix. Measured again on
 * 2026-10-11, after shipping it: still zero.
 *
 * Prompting here is also the right place on the merits. The staff shell is
 * for people being paid to answer the phone; a notification permission is
 * not an interruption to them, it is the job.
 */
function useStaffPushToken() {
  const userId = useSession().session?.user.id;
  useEffect(() => {
    if (!userId) return;
    void registerForPushNotifications(userId).catch((error: unknown) => {
      if (__DEV__) console.warn('Staff push registration failed:', error);
    });
  }, [userId]);
}

export default function StaffLayout() {
  useStaffPushToken();
  useCallNotificationRouting();
  return (
    <View style={{ flex: 1 }}>
      <StaffHeader />
      <Tabs tabBar={(props) => <StaffTabBar {...props} />} screenOptions={{ headerShown: false }}>
        <Tabs.Screen name="chat" />
        <Tabs.Screen name="community" />
        <Tabs.Screen name="notifications" />
      </Tabs>
    </View>
  );
}

/**
 * Opens the right screen when staff tap a notification.
 *
 * The patient shell has its own, richer version of this in
 * (tabs)/_layout.tsx; this shell had none at all, so a tapped notification
 * just opened the app on whatever tab was last used. Only the two kinds staff
 * actually receive are handled: a call (the one that is time-critical — a
 * missed tap here is a missed customer) and a support message.
 *
 * Same double-delivery guard as the patient version: a cold launch from a tap
 * arrives through both the listener and the replay below.
 */
function useCallNotificationRouting() {
  const handledRef = useRef(new Set<string>());
  useEffect(() => {
    function open(response: Notifications.NotificationResponse) {
      const id = response.notification.request.identifier;
      if (id) {
        if (handledRef.current.has(id)) return;
        handledRef.current.add(id);
      }
      const data = response.notification.request.content.data ?? {};
      if (data.type === 'call' && typeof data.callId === 'string') {
        router.push({ pathname: '/call/[callId]', params: { callId: data.callId } });
      } else if (data.type === 'chat') {
        router.push('/chat/admin-conversations');
      }
    }

    const subscription = Notifications.addNotificationResponseReceivedListener(open);
    void Notifications.getLastNotificationResponseAsync()
      .then((response) => {
        if (!response) return;
        open(response);
        void Notifications.clearLastNotificationResponseAsync().catch(() => undefined);
      })
      .catch((error: unknown) => {
        if (__DEV__) console.warn('Unable to restore the last notification response:', error);
      });
    return () => subscription.remove();
  }, []);
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 12,
  },
  logoutBtn: {
    width: 36,
    height: 36,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bar: {
    borderTopWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  tabBtn: {
    flex: 1,
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
});
