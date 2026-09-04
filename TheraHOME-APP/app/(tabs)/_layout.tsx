import React, { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Tabs, router, usePathname } from 'expo-router';
import * as Notifications from 'expo-notifications';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withSpring } from 'react-native-reanimated';
import { useTheme } from '@/theme';
import { useReduceMotion } from '@/hooks/useReduceMotion';
import { useAppStore } from '@/store/useAppStore';
import { useSession } from '@/hooks/useSession';
import { useIsStaff } from '@/hooks/useWebRoles';
import { registerUpsaleNotificationActions, syncPushTokenIfGranted } from '@/lib/pushNotifications';
import { Icon } from '@/components/icons/Icon';
import { AssistantBubble } from '@/components/AssistantBubble';
import { ReminderPopup } from '@/components/ReminderPopup';
import { useI18n } from '@/lib/i18n';

const TAB_ITEMS: { name: string; icon: string; label: string }[] = [
  { name: 'home', icon: 'home', label: 'Trang chủ' },
  { name: 'roadmap', icon: 'calendar', label: 'Lộ trình' },
  { name: 'store', icon: 'shopping-bag', label: 'Cửa hàng' },
  { name: 'community', icon: 'users-round', label: 'Cộng đồng' },
];

function tabItemForRoute(routeName: string) {
  const normalizedName = routeName === 'community/index' ? 'community' : routeName;
  return TAB_ITEMS.find((item) => item.name === normalizedName);
}

type TabBarProps = Parameters<NonNullable<React.ComponentProps<typeof Tabs>['tabBar']>>[0];

function TabBarButton({ item, isFocused, onPress }: { item: (typeof TAB_ITEMS)[number]; isFocused: boolean; onPress: () => void }) {
  const theme = useTheme();
  const { t } = useI18n();
  const reduceMotion = useReduceMotion();
  const color = isFocused ? theme.colors.primary : theme.colors.textMuted;
  const scale = useSharedValue(1);
  const wasFocused = useRef(isFocused);

  useEffect(() => {
    if (isFocused && !wasFocused.current && !reduceMotion) {
      scale.value = withSequence(withSpring(1.14, { damping: 10, stiffness: 260 }), withSpring(1, { damping: 12, stiffness: 220 }));
    }
    wasFocused.current = isFocused;
  }, [isFocused, reduceMotion, scale]);

  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <Pressable onPress={onPress} style={styles.tabBtn}>
      <Animated.View style={animatedStyle}>
        <Icon name={item.icon} size={23} color={color} />
      </Animated.View>
      <Text style={[theme.type.captionSm, { color }]}>{t(item.name as 'home' | 'roadmap' | 'store' | 'community')}</Text>
    </Pressable>
  );
}

function CustomTabBar({ state, navigation }: TabBarProps) {
  const theme = useTheme();
  return (
    <View
      style={[
        styles.bar,
        theme.shadows.nav,
        { backgroundColor: theme.dark ? theme.colors.bgCard : '#fff', borderTopColor: theme.colors.borderLight },
      ]}
    >
      <View style={styles.barInner}>
        {state.routes.map((route, index) => {
          const item = tabItemForRoute(route.name);
          if (!item) return null;
          const isFocused = state.index === index;
          return (
            <TabBarButton
              key={route.key}
              item={item}
              isFocused={isFocused}
              onPress={() => {
                const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
                if (!isFocused && !event.defaultPrevented) {
                  navigation.navigate(route.name);
                }
              }}
            />
          );
        })}
      </View>
    </View>
  );
}

export default function TabsLayout() {
  // Reaching (tabs) at all already implies activation (root layout's guard).
  // The only first-run popup left here is ReminderPopup (morning/evening
  // reminder times + notification permission) — the country/region choice
  // now happens earlier, as its own gated screen in the onboarding stack
  // (app/(onboarding)/country.tsx, see RootNavigator's countryPending gate),
  // so by the time a user reaches the tabs there's nothing else to ask.
  const hasSeenReminderPrompt = useAppStore((s) => s.hasSeenReminderPrompt);
  const [reminderDoneThisSession, setReminderDoneThisSession] = useState(false);
  // The assistant bubble stays off the Community tab (per explicit request
  // 2026-09-04) — it overlapped the feed's action row; chat stays reachable
  // from every other tab.
  const pathname = usePathname();
  const onCommunityTab = pathname.startsWith('/community');
  const { session } = useSession();
  const userId = session?.user.id;
  const isStaff = useIsStaff(userId);

  const showReminderPrompt = !hasSeenReminderPrompt && !reminderDoneThisSession;

  useEffect(() => {
    if (userId) {
      void syncPushTokenIfGranted(userId).catch((error: unknown) => {
        if (__DEV__) console.warn('Push-token sync skipped while offline:', error);
      });
    }
  }, [userId]);

  useEffect(() => {
    void registerUpsaleNotificationActions().catch((error: unknown) => {
      if (__DEV__) console.warn('Notification actions are unavailable:', error);
    });
  }, []);

  useEffect(() => {
    function openNotification(response: Notifications.NotificationResponse) {
      const data = response.notification.request.content.data ?? {};
      if (typeof data.articleId === 'string') {
        router.push({ pathname: '/community/article/[articleId]', params: { articleId: data.articleId } });
      } else if (typeof data.postId === 'string') {
        router.push({
          pathname: '/community/[postId]',
          params: {
            postId: data.postId,
            ...(typeof data.commentId === 'string' ? { commentId: data.commentId } : {}),
            ...(typeof data.parentCommentId === 'string' ? { parentCommentId: data.parentCommentId } : {}),
          },
        });
      } else if (data.type === 'ad') {
        router.push(data.destination === 'community' ? '/community' : data.destination === 'roadmap' ? '/roadmap' : data.destination === 'home' ? '/home' : '/store');
      } else if (data.type === 'blog') {
        router.push({ pathname: '/community', params: { filter: 'official', content: String(data.type) } });
      } else if (data.type === 'chat') {
        router.push('/chat/human');
      } else if (data.type === 'inactivity') {
        router.push('/home');
      } else if (data.dayNumber != null && typeof data.productId === 'string') {
        router.push({ pathname: '/day/[dayId]', params: { dayId: String(data.dayNumber), productId: data.productId } });
      } else {
        router.push('/roadmap');
      }
    }

    const subscription = Notifications.addNotificationResponseReceivedListener(openNotification);
    void Notifications.getLastNotificationResponseAsync()
      .then((response) => {
        if (response) {
          openNotification(response);
          void Notifications.clearLastNotificationResponseAsync().catch(() => undefined);
        }
      })
      .catch((error: unknown) => {
        if (__DEV__) console.warn('Unable to restore the last notification response:', error);
      });
    return () => subscription.remove();
  }, []);

  return (
    <View style={{ flex: 1 }}>
      <Tabs tabBar={(props) => <CustomTabBar {...props} />} screenOptions={{ headerShown: false }}>
        <Tabs.Screen name="home" />
        <Tabs.Screen name="roadmap" />
        <Tabs.Screen name="store" />
        <Tabs.Screen name="community/index" />
      </Tabs>
      {!onCommunityTab ? (
        <AssistantBubble
          isStaff={isStaff}
          onOpenAIChat={() => router.push('/chat/ai')}
          onOpenSupportChat={() => router.push(isStaff ? '/chat/admin-conversations' : '/chat/human')}
        />
      ) : null}
      {showReminderPrompt && userId ? (
        <ReminderPopup userId={userId} onDone={() => setReminderDoneThisSession(true)} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    borderTopWidth: 1,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
  },
  barInner: {
    height: 84,
    paddingBottom: 8,
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
