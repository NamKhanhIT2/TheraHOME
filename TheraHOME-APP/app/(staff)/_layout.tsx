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
import { Icon } from '@/components/icons/Icon';
import { IncomingCallSheet } from '@/components/call/IncomingCallSheet';

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

export default function StaffLayout() {
  useCallNotificationRouting();
  return (
    <View style={{ flex: 1 }}>
      <StaffHeader />
      <Tabs tabBar={(props) => <StaffTabBar {...props} />} screenOptions={{ headerShown: false }}>
        <Tabs.Screen name="chat" />
        <Tabs.Screen name="community" />
        <Tabs.Screen name="notifications" />
      </Tabs>
      {/* Everyone in this shell is staff, so the incoming-call sheet is
          always armed. It is mounted here rather than per-tab so a call
          reaches CSKH whichever tab they happen to be on. */}
      <IncomingCallSheet enabled />
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
