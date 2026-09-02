import React, { useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useTheme } from '@/theme';
import { useSession } from '@/hooks/useSession';
import { useDeleteNotification, useMarkAllNotificationsRead, useMarkNotificationRead, useNotifications, type NotificationRow, type NotificationType } from '@/hooks/useNotifications';
import { POST_REACTIONS } from '@/hooks/useCommunity';
import { timeAgo } from '@/lib/timeAgo';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { BackBar } from '@/components/ui/BackBar';
import { Icon } from '@/components/icons/Icon';
import { translate, useI18n, type TranslationKey } from '@/lib/i18n';
import type { AppLanguage } from '@/store/useAppStore';
import { RemoteImage } from '@/components/ui/RemoteImage';

type TimeGroup = 'new' | 'today' | 'earlier';
type NotificationStyle = { icon: string; color: string; bg: string };
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

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(-2).map((word) => word[0]).join('').toUpperCase() || 'T';
}

export default function NotificationInboxScreen() {
  const theme = useTheme();
  const { t, language } = useI18n();
  const { session } = useSession();
  const userId = session?.user.id;
  const notificationsQuery = useNotifications(userId);
  const notifications = notificationsQuery.data ?? [];
  const markRead = useMarkNotificationRead(userId);
  const markAllRead = useMarkAllNotificationsRead(userId);
  const deleteNotification = useDeleteNotification(userId);
  const [visibleEarlier, setVisibleEarlier] = useState(2);
  const [loadingEarlier, setLoadingEarlier] = useState(false);

  const stylesByType: Record<NotificationType, NotificationStyle> = {
    schedule: { icon: 'calendar', color: theme.colors.primary, bg: theme.colors.primaryTint10 },
    inactivity: { icon: 'activity', color: '#B9860B', bg: 'rgba(185,134,11,0.12)' },
    ad: { icon: 'megaphone', color: '#D98200', bg: 'rgba(217,130,0,0.12)' },
    blog: { icon: 'book', color: '#2BB673', bg: 'rgba(43,182,115,0.12)' },
    chat: { icon: 'message-circle', color: '#7C4DFF', bg: 'rgba(124,77,255,0.12)' },
    post_comment: { icon: 'message-circle', color: '#3478F6', bg: 'rgba(52,120,246,0.12)' },
    comment_reply: { icon: 'message-circle', color: '#3478F6', bg: 'rgba(52,120,246,0.12)' },
    post_reaction: { icon: 'heart', color: theme.colors.error, bg: 'rgba(220,60,60,0.10)' },
    comment_reaction: { icon: 'heart', color: theme.colors.error, bg: 'rgba(220,60,60,0.10)' },
    streak_milestone: { icon: 'trending-up', color: '#D98200', bg: 'rgba(217,130,0,0.12)' },
    post_moderation: { icon: 'shield-check', color: '#2BB673', bg: 'rgba(43,182,115,0.12)' },
  };

  const sections = useMemo(() => {
    const headings: Array<{ id: TimeGroup; labelKey: TranslationKey }> = [
      { id: 'new', labelKey: 'notificationNew' },
      { id: 'today', labelKey: 'notificationToday' },
      { id: 'earlier', labelKey: 'notificationEarlier' },
    ];
    const todayStart = startOfToday();
    return headings.map((heading) => ({ ...heading, items: notifications.filter((item) => timeGroup(item, todayStart) === heading.id) })).filter((section) => section.items.length > 0);
  }, [notifications]);

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
    } else if (notification.type === 'ad') {
      router.push(notification.destination === 'community' ? '/community' : notification.destination === 'roadmap' ? '/roadmap' : notification.destination === 'home' ? '/home' : '/store');
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
    <ScreenContainer>
      <BackBar
        onBack={() => router.back()}
        title={t('notifications')}
        right={notifications.some((item) => !item.read) ? (
          <Pressable onPress={() => markAllRead.mutate()} disabled={markAllRead.isPending} hitSlop={8} style={styles.markAll}>
            <Text style={[theme.type.caption, { color: theme.colors.primary, fontFamily: theme.fontFamily.semiBold }]}>{t('markAllRead')}</Text>
          </Pressable>
        ) : null}
      />
      {notificationsQuery.isPending ? <View style={styles.loading}><ActivityIndicator color={theme.colors.primary} /></View> : (
        <ScrollView contentContainerStyle={styles.body}>
          {sections.length === 0 ? <View style={styles.emptyState}>
            <View style={[styles.emptyIcon, { backgroundColor: theme.colors.primaryTint10 }]}><Icon name="bell" size={25} color={theme.colors.primary} /></View>
            <Text style={[theme.type.bodyStrong, { color: theme.colors.textPrimary, marginTop: 12 }]}>{t('noNotifications')}</Text>
          </View> : null}

          {sections.map((section, sectionIndex) => {
            const displayedItems = section.id === 'earlier' ? section.items.slice(0, visibleEarlier) : section.items;
            const hasMoreEarlier = section.id === 'earlier' && section.items.length > displayedItems.length;
            return <View key={section.id} style={[styles.section, sectionIndex === 0 ? styles.firstSection : null]}>
            <View style={styles.sectionHeader}>
              <Text style={[theme.type.bodyStrong, { color: theme.colors.textPrimary }]}>{t(section.labelKey)}</Text>
              {section.id === 'new' ? <View style={[styles.countBadge, { backgroundColor: theme.colors.primary }]}><Text style={styles.countText}>{section.items.length}</Text></View> : null}
            </View>
            <View style={[styles.groupCard, theme.shadows.card, { backgroundColor: theme.colors.bgCard, borderRadius: theme.radius.lg }]}>
              {displayedItems.map((notification, index) => {
                const notificationStyle = stylesByType[notification.type] ?? stylesByType.schedule;
                const actorName = fallbackActorName(notification, language);
                const useBrandAvatar = notification.actorIsOfficial || ['blog', 'ad', 'schedule', 'inactivity', 'streak_milestone'].includes(notification.type);
                const useSpecialistAvatar = notification.type === 'chat' && !notification.actorAvatarUrl;
                const isReaction = notification.type === 'post_reaction' || notification.type === 'comment_reaction';
                const reactionEmoji = isReaction ? POST_REACTIONS.find((item) => item.key === notification.reactionType)?.emoji : null;
                const bodyText = notification.type === 'schedule' && notification.relatedDayNumber != null ? t('dayUnlockedBody') : notification.body;
                return <Pressable key={notification.id} onPress={() => openNotification(notification)} style={[styles.row, index < displayedItems.length - 1 ? { borderBottomWidth: 1, borderBottomColor: theme.colors.divider } : null, { backgroundColor: notification.read ? 'transparent' : theme.colors.primaryTint05 }]}>
                  <View style={styles.avatarWrap}>
                    {notification.actorAvatarUrl ? <RemoteImage uri={notification.actorAvatarUrl} contentFit="cover" style={[styles.avatarImage, { backgroundColor: theme.colors.bgCardAlt }]} /> : useBrandAvatar ? <Image source={THERAHOME_AVATAR} style={styles.avatarImage} /> : useSpecialistAvatar ? <Image source={SPECIALIST_AVATAR} style={styles.avatarImage} /> : <View style={[styles.initialAvatar, { backgroundColor: notificationStyle.bg }]}><Text style={[styles.initials, { color: notificationStyle.color }]}>{initials(actorName)}</Text></View>}
                    {reactionEmoji ? (
                      <View style={[styles.actionBadge, styles.reactionBadge]}><Text style={styles.reactionBadgeEmoji}>{reactionEmoji}</Text></View>
                    ) : (
                      <View style={[styles.actionBadge, { backgroundColor: notificationStyle.color }]}><Icon name={notificationStyle.icon} size={14} color="#fff" strokeWidth={2.4} /></View>
                    )}
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <View style={styles.titleRow}>
                      <Text numberOfLines={1} style={[theme.type.bodyStrong, { color: theme.colors.textPrimary, flexShrink: 1 }]}>{notification.type === 'schedule' && notification.relatedDayNumber != null ? t('dayUnlocked', { day: notification.relatedDayNumber }) : notification.title}</Text>
                      {!notification.read ? <View style={[styles.unreadDot, { backgroundColor: theme.colors.primary }]} /> : null}
                    </View>
                    {bodyText ? <Text numberOfLines={2} style={[theme.type.caption, { color: theme.colors.textSecondary, marginTop: 2, lineHeight: 16 }]}>{bodyText}</Text> : null}
                    <View style={styles.metaRow}>
                      <Text style={[theme.type.captionSm, { color: theme.colors.textMuted }]}>{timeAgo(notification.createdAt, t)}</Text>
                    </View>
                  </View>
                  {notification.postImageUrl ? <RemoteImage uri={notification.postImageUrl} contentFit="cover" style={[styles.thumbnail, { backgroundColor: theme.colors.bgCardAlt }]} /> : null}
                  <Pressable onPress={(event) => { event.stopPropagation(); confirmDelete(notification); }} hitSlop={10} accessibilityLabel={t('deleteNotification')} style={styles.deleteButton}><Icon name="trash-2" size={17} color={theme.colors.textMuted} /></Pressable>
                </Pressable>;
              })}
              {loadingEarlier ? [0, 1].map((skeleton) => <View key={`older-skeleton-${skeleton}`} style={[styles.row, styles.skeletonRow]}>
                <View style={[styles.skeletonAvatar, { backgroundColor: theme.colors.bgCardAlt }]} />
                <View style={{ flex: 1, gap: 8 }}>
                  <View style={[styles.skeletonTitle, { backgroundColor: theme.colors.bgCardAlt }]} />
                  <View style={[styles.skeletonText, { backgroundColor: theme.colors.bgCardAlt }]} />
                </View>
              </View>) : null}
            </View>
            {hasMoreEarlier ? <Pressable onPress={loadEarlierNotifications} disabled={loadingEarlier} style={[styles.loadEarlierButton, { borderColor: theme.colors.primaryTint10 }]}> 
              <Text style={[theme.type.caption, { color: theme.colors.primary, fontFamily: theme.fontFamily.semiBold }]}>{t('viewEarlierNotifications')}</Text>
            </Pressable> : null}
          </View>;
          })}
        </ScrollView>
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  body: { paddingHorizontal: 20, paddingTop: 0, paddingBottom: 40 },
  markAll: { paddingVertical: 8, paddingLeft: 8 },
  emptyState: { alignItems: 'center', paddingTop: 92 },
  emptyIcon: { width: 58, height: 58, borderRadius: 29, alignItems: 'center', justifyContent: 'center' },
  section: { marginTop: 14 },
  firstSection: { marginTop: 6 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 8, paddingHorizontal: 2 },
  countBadge: { minWidth: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  countText: { color: '#fff', fontSize: 11, fontWeight: '800' },
  groupCard: { overflow: 'hidden' },
  row: { flexDirection: 'row', gap: 9, alignItems: 'flex-start', paddingVertical: 8, paddingLeft: 12, paddingRight: 8 },
  avatarWrap: { width: 42, height: 42, flexShrink: 0, position: 'relative' },
  avatarImage: { width: 42, height: 42, borderRadius: 21, backgroundColor: '#EAF2FE' },
  initialAvatar: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  initials: { fontSize: 14, fontWeight: '800' },
  actionBadge: { position: 'absolute', right: -2, bottom: -2, width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  reactionBadge: { backgroundColor: '#fff' },
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
