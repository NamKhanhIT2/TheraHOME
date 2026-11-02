import React, { useMemo, useState } from 'react';
import { Alert, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { homeGlassColors, useTheme } from '@/theme';
import { useSession } from '@/hooks/useSession';
import { isCommunityNotification, useDeleteNotification, useMarkAllNotificationsRead, useMarkNotificationRead, useNotifications, type NotificationRow, type NotificationType } from '@/hooks/useNotifications';
import { POST_REACTIONS } from '@/hooks/useCommunity';
import { timeAgo } from '@/lib/timeAgo';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { SkeletonRow } from '@/components/ui/Skeleton';
import { useSteadyLoading } from '@/hooks/useSteadyLoading';
import { BackBar } from '@/components/ui/BackBar';
import { Icon } from '@/components/icons/Icon';
import { translate, useI18n, type TranslationKey } from '@/lib/i18n';
import { useAppStore } from '@/store/useAppStore';
import type { AppLanguage } from '@/store/useAppStore';
import { RemoteImage } from '@/components/ui/RemoteImage';

type TimeGroup = 'new' | 'today' | 'earlier';
/** Only the icon's own colour: on the dark palette the initial-avatar
 * circle is a plain raised surface for every type, so the one coloured thing
 * in the row is the little badge — which is enough to tell a heart from a
 * calendar at a glance. */
type NotificationStyle = { icon: string; color: string };
const THERAHOME_AVATAR = require('../assets/icon.png');
const SPECIALIST_AVATAR = require('../assets/therahome-specialist.png');

function startOfToday() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
}

function timeGroup(notification: NotificationRow, todayStart: number): TimeGroup {
  // Keep unread items in “New” even after midnight, like Facebook's inbox.
  if (!notification.read) return 'new';
  return new Date(notification.createdAt).getTime() >= todayStart ? 'today' : 'earlier';
}

function fallbackActorName(notification: NotificationRow, language: AppLanguage) {
  if (notification.actorName) return notification.actorName;
  if (notification.type === 'chat') return translate(language, 'supportTeamName');
  if (notification.type === 'blog' || notification.type === 'ad') return 'TheraHOME';
  return 'TheraHOME';
}

/** Social notifications are re-rendered from their structured columns so
 * the title follows the user's CURRENT app language — the DB stores a
 * Vietnamese title at insert time (see notifications_localized migration). */
function socialTitle(notification: NotificationRow, t: (key: TranslationKey, values?: Record<string, string | number>) => string): string | null {
  const actor = notification.actorName?.trim() || t('notifSomeone');
  const count = notification.groupActorIds?.length ?? 1;
  const who =
    count >= 3
      ? t('notifAndOthers', { a: actor, n: count - 1 })
      : count === 2
        ? t('notifAndOne', { a: actor, b: notification.secondActorName?.trim() || t('notifSomeone') })
        : actor;
  switch (notification.type) {
    case 'post_reaction': return t('notifReactedPost', { who });
    case 'comment_reaction': return t('notifReactedComment', { who });
    case 'post_comment': return t('notifCommented', { who: actor });
    case 'comment_reply': return t('notifReplied', { who: actor });
    default: return null;
  }
}

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(-2).map((word) => word[0]).join('').toUpperCase() || 'T';
}

export default function NotificationInboxScreen() {
  const theme = useTheme();
  const { t, language } = useI18n();
  const { session } = useSession();
  const userId = session?.user.id;
  const notificationsQuery = useNotifications(userId);
  const showSkeleton = useSteadyLoading(notificationsQuery.isPending);
  // Opened from Cộng đồng's own bell: that bell answers for community
  // things only, so the list it opens must not show water reminders either
  // (owner, 2026-10-26).
  const { scope } = useLocalSearchParams<{ scope?: string }>();
  // Rule 31: each surface keeps its own ground. Reached from Cộng đồng's bell
  // this inbox is that tab's violet; from Home's bell it is the blue sky.
  const violet = scope === 'community';
  const tone = violet ? 'violet' : 'glass';
  const accent = violet ? homeGlassColors.purple : homeGlassColors.tick;
  // What the round badge's rim is drawn against — opaque, because `surface`
  // is translucent and a rim in it would show the avatar through.
  const ground = violet ? homeGlassColors.purpleSky[2] : homeGlassColors.sky[4];
  const notifications = useMemo(() => {
    const all = notificationsQuery.data ?? [];
    return scope === 'community' ? all.filter((item) => isCommunityNotification(item.type)) : all;
  }, [notificationsQuery.data, scope]);
  const markRead = useMarkNotificationRead(userId);
  const markAllRead = useMarkAllNotificationsRead(userId);
  const deleteNotification = useDeleteNotification(userId);
  const [visibleEarlier, setVisibleEarlier] = useState(2);
  const [loadingEarlier, setLoadingEarlier] = useState(false);

  // Amber and the old light-mode blues went muddy on a near-black row, so
  // these are drawn from the glass palette instead of the hex literals this
  // screen used to carry.
  const stylesByType: Record<NotificationType, NotificationStyle> = {
    schedule: { icon: 'calendar', color: homeGlassColors.tick },
    inactivity: { icon: 'activity', color: homeGlassColors.badge },
    ad: { icon: 'megaphone', color: homeGlassColors.accent },
    blog: { icon: 'book', color: homeGlassColors.dotDone },
    chat: { icon: 'message-circle', color: homeGlassColors.link },
    post_comment: { icon: 'message-circle', color: homeGlassColors.accent },
    comment_reply: { icon: 'message-circle', color: homeGlassColors.accent },
    post_reaction: { icon: 'heart', color: homeGlassColors.focus },
    comment_reaction: { icon: 'heart', color: homeGlassColors.focus },
    streak_milestone: { icon: 'trending-up', color: homeGlassColors.purple },
    post_moderation: { icon: 'shield-check', color: homeGlassColors.dotDone },
    roadmap_ready: { icon: 'calendar', color: homeGlassColors.tick },
  };

  const sections = useMemo(() => {
    const headings: { id: TimeGroup; labelKey: TranslationKey }[] = [
      { id: 'new', labelKey: 'notificationNew' },
      { id: 'today', labelKey: 'notificationToday' },
      { id: 'earlier', labelKey: 'notificationEarlier' },
    ];
    const todayStart = startOfToday();
    return headings.map((heading) => ({ ...heading, items: notifications.filter((item) => timeGroup(item, todayStart) === heading.id) })).filter((section) => section.items.length > 0);
  }, [notifications]);

  /** Where a row's own `destination` column points, for the types that carry
   * one instead of a related row id. */
  function destinationRoute(destination: string | null, fallback: '/roadmap' | '/store') {
    if (destination === 'community') return '/community' as const;
    if (destination === 'roadmap') return '/roadmap' as const;
    if (destination === 'home') return '/home' as const;
    if (destination === 'store') return '/store' as const;
    return fallback;
  }

  function openNotification(notification: NotificationRow) {
    if (!notification.read) markRead.mutate(notification.id);
    if (notification.type === 'chat' && notification.relatedChatThreadId) {
      router.push('/chat/human');
    } else if (notification.type === 'blog' && notification.relatedArticleId) {
      router.push({ pathname: '/community/article/[articleId]', params: { articleId: notification.relatedArticleId } });
    } else if (notification.type === 'blog' && notification.relatedPostId) {
      router.push({ pathname: '/community/[postId]', params: { postId: notification.relatedPostId } });
    } else if (notification.type === 'schedule' && notification.relatedDayNumber != null && notification.relatedProductId) {
      router.push({ pathname: '/day/[dayId]', params: { dayId: String(notification.relatedDayNumber), productId: notification.relatedProductId } });
    } else if (notification.type === 'schedule') {
      // The two daily reminders are written by `record_local_reminder_notification`,
      // which has no day or product to record — only `destination`. Without this
      // they fell to the catch-all below, so "Đã đến giờ tập luyện · bài tập hôm
      // nay đã sẵn sàng" opened Home and left the customer to find the roadmap
      // themselves (QA on device, 2026-11-02).
      router.push(destinationRoute(notification.destination, '/roadmap'));
    } else if (notification.type === 'roadmap_ready') {
      // Jump straight to the roadmap that just got published.
      if (notification.relatedProductId) useAppStore.getState().selectProduct(notification.relatedProductId);
      router.push('/roadmap');
    } else if (notification.type === 'ad') {
      router.push(destinationRoute(notification.destination, '/store'));
    } else if (notification.type === 'blog') {
      router.push({ pathname: '/community', params: { filter: 'official', content: 'blog' } });
    } else if (notification.type === 'post_moderation') {
      if (notification.relatedPostId) {
        router.push({ pathname: '/community/[postId]', params: { postId: notification.relatedPostId } });
      } else {
        router.push('/community');
      }
    } else if ((notification.type === 'post_comment' || notification.type === 'comment_reply' || notification.type === 'post_reaction' || notification.type === 'comment_reaction') && notification.relatedPostId) {
      router.push({
        pathname: '/community/[postId]',
        params: {
          postId: notification.relatedPostId,
          ...(notification.relatedCommentId ? { commentId: notification.relatedCommentId } : {}),
          ...(notification.relatedParentCommentId ? { parentCommentId: notification.relatedParentCommentId } : {}),
        },
      });
    } else if (notification.type === 'streak_milestone') {
      router.push({ pathname: '/community/create', params: { achievement: 'streak', milestone: notification.title.match(/\d+/)?.[0] ?? '7' } });
    } else {
      router.push('/home');
    }
  }

  function confirmDelete(notification: NotificationRow) {
    Alert.alert(t('deleteNotification'), t('deleteNotificationConfirm'), [
      { text: t('cancel'), style: 'cancel' },
      { text: t('delete'), style: 'destructive', onPress: () => deleteNotification.mutate(notification.id) },
    ]);
  }

  function loadEarlierNotifications() {
    if (loadingEarlier) return;
    setLoadingEarlier(true);
    // The rows are already available locally, but this brief state preserves the same
    // progressive-loading feedback we will use when the inbox becomes paginated.
    setTimeout(() => {
      setVisibleEarlier((count) => count + 10);
      setLoadingEarlier(false);
    }, 320);
  }

  return (
    <ScreenContainer tone={tone}>
      <BackBar
        tone={tone}
        onBack={() => router.back()}
        title={t('notifications')}
        right={notifications.some((item) => !item.read) ? (
          <Pressable onPress={() => markAllRead.mutate()} disabled={markAllRead.isPending} hitSlop={8} style={styles.markAll}>
            <Text style={[theme.type.caption, { color: accent, fontFamily: theme.fontFamily.semiBold }]}>{t('markAllRead')}</Text>
          </Pressable>
        ) : null}
      />
      {showSkeleton ? (
        // The inbox is a uniform list of icon + two lines, which is the shape
        // a skeleton stands in for most convincingly.
        <View style={styles.skeletonBody}>
          {[0, 1, 2, 3, 4].map((row) => <SkeletonRow key={row} tone="glass" />)}
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.body}>
          {/* A failed fetch used to fall into `?? []` and render the "no
              notifications" empty state, so a network error was indis-
              tinguishable from a genuinely empty inbox. */}
          {notificationsQuery.isError ? <View style={styles.emptyState}>
            <View style={[styles.emptyIcon, { backgroundColor: homeGlassColors.surfaceRaised }]}><Icon name="bell" size={25} color={accent} /></View>
            <Text style={[theme.type.bodyStrong, { color: homeGlassColors.text, marginTop: 12, textAlign: 'center' }]}>{t('homeLoadErrorTitle')}</Text>
            <Text style={[theme.type.caption, { color: homeGlassColors.textMuted, marginTop: 6, textAlign: 'center' }]}>{t('checkNetworkRetry')}</Text>
            <Pressable onPress={() => { void notificationsQuery.refetch(); }} style={{ marginTop: 14 }} accessibilityRole="button">
              <Text style={[theme.type.bodyStrong, { color: accent }]}>{t('retry')}</Text>
            </Pressable>
          </View> : sections.length === 0 ? <View style={styles.emptyState}>
            <View style={[styles.emptyIcon, { backgroundColor: homeGlassColors.surfaceRaised }]}><Icon name="bell" size={25} color={accent} /></View>
            <Text style={[theme.type.bodyStrong, { color: homeGlassColors.text, marginTop: 12 }]}>{t('noNotifications')}</Text>
          </View> : null}

          {sections.map((section, sectionIndex) => {
            const displayedItems = section.id === 'earlier' ? section.items.slice(0, visibleEarlier) : section.items;
            const hasMoreEarlier = section.id === 'earlier' && section.items.length > displayedItems.length;
            return <View key={section.id} style={[styles.section, sectionIndex === 0 ? styles.firstSection : null]}>
            <View style={styles.sectionHeader}>
              <Text style={[theme.type.bodyStrong, { color: homeGlassColors.text }]}>{t(section.labelKey)}</Text>
              {section.id === 'new' ? <View style={[styles.countBadge, { backgroundColor: accent }]}><Text style={[styles.countText, { color: homeGlassColors.text }]}>{section.items.length}</Text></View> : null}
            </View>
            {/* A rim, not a drop shadow: on a near-black ground a shadow is
                invisible and the card loses its edge entirely. */}
            <View style={[styles.groupCard, { backgroundColor: homeGlassColors.surface, borderColor: homeGlassColors.hairline, borderRadius: theme.radius.lg }]}>
              {displayedItems.map((notification, index) => {
                const notificationStyle = stylesByType[notification.type] ?? stylesByType.schedule;
                const actorName = fallbackActorName(notification, language);
                const useBrandAvatar = notification.actorIsOfficial || ['blog', 'ad', 'schedule', 'inactivity', 'streak_milestone'].includes(notification.type);
                const useSpecialistAvatar = notification.type === 'chat' && !notification.actorAvatarUrl;
                const isReaction = notification.type === 'post_reaction' || notification.type === 'comment_reaction';
                const reactionEmoji = isReaction ? POST_REACTIONS.find((item) => item.key === notification.reactionType)?.emoji : null;
                const bodyText = notification.type === 'schedule' && notification.relatedDayNumber != null ? t('dayUnlockedBody') : notification.body;
                return <Pressable key={notification.id} onPress={() => openNotification(notification)} style={[styles.row, index < displayedItems.length - 1 ? { borderBottomWidth: 1, borderBottomColor: homeGlassColors.hairline } : null, { backgroundColor: notification.read ? 'transparent' : homeGlassColors.surfaceRaised }]}>
                  <View style={styles.avatarWrap}>
                    {notification.actorAvatarUrl ? <RemoteImage uri={notification.actorAvatarUrl} contentFit="cover" style={[styles.avatarImage, { backgroundColor: homeGlassColors.surfaceRaised }]} /> : useBrandAvatar ? <Image source={THERAHOME_AVATAR} style={[styles.avatarImage, { backgroundColor: homeGlassColors.surfaceRaised }]} /> : useSpecialistAvatar ? <Image source={SPECIALIST_AVATAR} style={[styles.avatarImage, { backgroundColor: homeGlassColors.surfaceRaised }]} /> : <View style={[styles.initialAvatar, { backgroundColor: homeGlassColors.surfaceRaised }]}><Text style={[styles.initials, { color: notificationStyle.color }]}>{initials(actorName)}</Text></View>}
                    {reactionEmoji ? (
                      <View style={[styles.actionBadge, { borderColor: ground, backgroundColor: ground }]}><Text style={styles.reactionBadgeEmoji}>{reactionEmoji}</Text></View>
                    ) : (
                      <View style={[styles.actionBadge, { borderColor: ground, backgroundColor: notificationStyle.color }]}><Icon name={notificationStyle.icon} size={14} color={ground} strokeWidth={2.4} /></View>
                    )}
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <View style={styles.titleRow}>
                      <Text numberOfLines={1} style={[theme.type.bodyStrong, { color: homeGlassColors.text, flexShrink: 1 }]}>{notification.type === 'schedule' && notification.relatedDayNumber != null ? t('dayUnlocked', { day: notification.relatedDayNumber }) : socialTitle(notification, t) ?? notification.title}</Text>
                      {!notification.read ? <View style={[styles.unreadDot, { backgroundColor: accent }]} /> : null}
                    </View>
                    {bodyText ? <Text numberOfLines={2} style={[theme.type.caption, { color: homeGlassColors.textMuted, marginTop: 2, lineHeight: 18 }]}>{bodyText}</Text> : null}
                    <View style={styles.metaRow}>
                      <Text style={[theme.type.captionSm, { color: homeGlassColors.textFaint }]}>{timeAgo(notification.createdAt, t)}</Text>
                    </View>
                  </View>
                  {notification.postImageUrl ? <RemoteImage uri={notification.postImageUrl} contentFit="cover" style={[styles.thumbnail, { backgroundColor: homeGlassColors.surfaceRaised }]} /> : null}
                  <Pressable onPress={(event) => { event.stopPropagation(); confirmDelete(notification); }} hitSlop={10} accessibilityLabel={t('deleteNotification')} style={styles.deleteButton}><Icon name="trash-2" size={17} color={homeGlassColors.textFaint} /></Pressable>
                </Pressable>;
              })}
              {loadingEarlier ? [0, 1].map((skeleton) => <View key={`older-skeleton-${skeleton}`} style={[styles.row, styles.skeletonRow]}>
                <View style={[styles.skeletonAvatar, { backgroundColor: homeGlassColors.surfaceRaised }]} />
                <View style={{ flex: 1, gap: 8 }}>
                  <View style={[styles.skeletonTitle, { backgroundColor: homeGlassColors.surfaceRaised }]} />
                  <View style={[styles.skeletonText, { backgroundColor: homeGlassColors.surfaceRaised }]} />
                </View>
              </View>) : null}
            </View>
            {hasMoreEarlier ? <Pressable onPress={loadEarlierNotifications} disabled={loadingEarlier} style={[styles.loadEarlierButton, { borderColor: homeGlassColors.hairline }]}> 
              <Text style={[theme.type.caption, { color: accent, fontFamily: theme.fontFamily.semiBold }]}>{t('viewEarlierNotifications')}</Text>
            </Pressable> : null}
          </View>;
          })}
        </ScrollView>
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  skeletonBody: {
    paddingHorizontal: 20,
    paddingTop: 16,
    gap: 22,
  },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  body: { paddingHorizontal: 20, paddingTop: 0, paddingBottom: 40 },
  markAll: { paddingVertical: 8, paddingLeft: 8 },
  emptyState: { alignItems: 'center', paddingTop: 92 },
  emptyIcon: { width: 58, height: 58, borderRadius: 29, alignItems: 'center', justifyContent: 'center' },
  section: { marginTop: 14 },
  firstSection: { marginTop: 6 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 8, paddingHorizontal: 2 },
  countBadge: { minWidth: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  countText: { fontSize: 11, fontWeight: '800' },
  groupCard: { overflow: 'hidden', borderWidth: 1 },
  row: { flexDirection: 'row', gap: 9, alignItems: 'flex-start', paddingVertical: 8, paddingLeft: 12, paddingRight: 8 },
  avatarWrap: { width: 42, height: 42, flexShrink: 0, position: 'relative' },
  avatarImage: { width: 42, height: 42, borderRadius: 21 },
  initialAvatar: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  initials: { fontSize: 14, fontWeight: '800' },
  actionBadge: { position: 'absolute', right: -2, bottom: -2, width: 22, height: 22, borderRadius: 11, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  reactionBadgeEmoji: { fontSize: 13 },
  thumbnail: { width: 40, height: 40, borderRadius: 8, flexShrink: 0, marginLeft: 4 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  metaRow: { flexDirection: 'row', alignItems: 'center', marginTop: 2 },
  unreadDot: { width: 7, height: 7, borderRadius: 4 },
  deleteButton: { padding: 4, marginTop: 1 },
  loadEarlierButton: { alignSelf: 'center', borderWidth: 1, borderRadius: 999, paddingHorizontal: 16, paddingVertical: 10, marginTop: 12 },
  skeletonRow: { opacity: 0.8 },
  skeletonAvatar: { width: 42, height: 42, borderRadius: 21 },
  skeletonTitle: { height: 14, width: '58%', borderRadius: 7 },
  skeletonText: { height: 11, width: '82%', borderRadius: 6 },
});
