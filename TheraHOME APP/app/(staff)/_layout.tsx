// Dedicated shell for purely-staff TheraHOME accounts (account_type
// 'admin'/'cskh', no patient program) — Chat / Cộng đồng / Thông báo, the 3
// most important areas per CLAUDE.md. No AssistantBubble/ReminderPopup,
// both patient-only concepts. See app/_layout.tsx's isStaffAccount gate for
// how accounts land here instead of (tabs).
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Tabs } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/theme';
import { useSession } from '@/hooks/useSession';
import { useWebRoles } from '@/hooks/useWebRoles';
import { supabase } from '@/lib/supabase';
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
          onPress={() => supabase.auth.signOut()}
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
  return (
    <View
      style={[
        styles.bar,
        { backgroundColor: theme.dark ? theme.colors.bgCard : '#fff', borderTopColor: theme.colors.borderLight },
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
    height: 84,
    paddingBottom: 8,
  },
  tabBtn: {
    flex: 1,
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
});
