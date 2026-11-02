import React, { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { Tabs, router } from 'expo-router';
import * as Notifications from 'expo-notifications';
import { useAppStore } from '@/store/useAppStore';
import { useSession } from '@/hooks/useSession';
import { registerUpsaleNotificationActions, syncPushTokenIfGranted } from '@/lib/pushNotifications';
import { ReminderPopup } from '@/components/ReminderPopup';

/**
 * Every tab paints its own floating glass bar now — Home, Lộ trình, Cửa hàng
 * and Cộng đồng each render `HomeGlassNav` inside their own screen, over
 * their own background. The shared opaque strip that used to live here, and
 * the per-route opt-outs that let it stand down one tab at a time, are gone
 * with the last of the light screens (2026-10-25).
 *
 * The navigator still needs a `tabBar`, so this is it.
 */
function NoTabBar() {
  return null;
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
  // Nothing in the tabs carries the blue assistant bubble any more: Home and
  // Lộ trình seat the mascot in their own floating bar, and the owner asked
  // for it off Cửa hàng and Cộng đồng too (2026-10-25). The chat entrances
  // live in the mascot's sheet and in Hồ sơ.
  const { session } = useSession();
  const userId = session?.user.id;

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

  // A cold launch from a notification tap delivers the SAME response through
  // both paths below — the listener and the getLastNotificationResponse
  // replay — so the destination was pushed onto the stack twice and backing
  // out landed on it again. Remember what has already been handled.
  const handledNotificationIds = useRef(new Set<string>());
  useEffect(() => {
    function openNotification(response: Notifications.NotificationResponse) {
      const responseId = response.notification.request.identifier;
      if (responseId) {
        if (handledNotificationIds.current.has(responseId)) return;
        handledNotificationIds.current.add(responseId);
      }
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
      } else if (data.type === 'call') {
        // A dual-role admin can be rung here too. The call screen works
        // out from the row whether they are the caller or the staff, so
        // this one route serves both.
        if (typeof data.callId === 'string') router.push({ pathname: '/call/[callId]', params: { callId: data.callId } });
        else router.push('/chat/admin-conversations');
      } else if (data.type === 'chat') {
        router.push('/chat/human');
      } else if (data.type === 'inactivity') {
        router.push('/home');
      } else if (data.type === 'roadmap_ready') {
        if (typeof data.productId === 'string') useAppStore.getState().selectProduct(data.productId);
        router.push('/roadmap');
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
      <Tabs tabBar={() => <NoTabBar />} screenOptions={{ headerShown: false }}>
        <Tabs.Screen name="home" />
        <Tabs.Screen name="roadmap" />
        <Tabs.Screen name="store" />
        <Tabs.Screen name="community/index" />
      </Tabs>
      {showReminderPrompt && userId ? (
        <ReminderPopup userId={userId} onDone={() => setReminderDoneThisSession(true)} />
      ) : null}
    </View>
  );
}
