import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Dimensions, FlatList, Modal, Platform, Pressable, RefreshControl, StyleSheet, Text, View, type ViewToken } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import Reanimated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { useTheme } from '@/theme';
import { useSession } from '@/hooks/useSession';
import { useProfile } from '@/hooks/useProfile';
import {
  useCommunityPosts,
  useDeletePost,
  useMyPostReactions,
  useMyPostSaves,
  useSetPostReaction,
  useTogglePostSave,
  useReportContent,
  useHiddenCommunityPosts,
  useHideCommunityPost,
  useBlockedCommunityUsers,
  useBlockCommunityUser,
  friendlyCommunityError,
  pinnedDisplay,
  DEFAULT_POSTS_PAGE_SIZE,
  type CommunityPostRow,
  type PostReaction,
  type ReportReason,
} from '@/hooks/useCommunity';
import { ArticleCard } from '@/components/community/ArticleCard';
import { ExpandableText } from '@/components/community/ExpandableText';
import { useActivatedPrograms } from '@/hooks/usePrograms';
import {
  useActiveChallenge,
  useChallengeParticipantCount,
  useMyChallengeParticipation,
  useJoinChallenge,
  useCompleteChallenge,
} from '@/hooks/useChallenges';
import { timeAgo } from '@/lib/timeAgo';
import { CommunityAvatar } from '@/components/CommunityAvatar';
import { AvatarImg } from '@/components/AvatarImg';
import { ProgressShareCard } from '@/components/ProgressShareCard';
import { MediaGrid } from '@/components/community/MediaGrid';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { OptionChip } from '@/components/ui/OptionChip';
import { Icon } from '@/components/icons/Icon';
import { ShareStoryModal } from '@/components/ShareStoryModal';
import { useI18n } from '@/lib/i18n';
import { ReactionPicker } from '@/components/community/ReactionPicker';
import { PostActionBar } from '@/components/community/PostActionBar';
import { getReactionTrayFrame, pickerReactionAt } from '@/components/community/reactionPickerGeometry';
import { hapticConfirm } from '@/lib/haptics';
import { useTabFocusFade } from '@/hooks/useTabFocusFade';
import { fadeUpEntering, staggerDelay } from '@/lib/motion';

type Filter = 'all' | 'official';

const { width: WINDOW_WIDTH, height: WINDOW_HEIGHT } = Dimensions.get('window');

function FeedSkeleton() {
  const theme = useTheme();
  return (
    <ScreenContainer edges={['top']}>
      <View style={styles.skeletonBody}>
        <View style={[styles.skeletonTitle, { backgroundColor: theme.colors.bgCardAlt }]} />
        {[0, 1, 2].map((item) => (
          <View key={item} style={[styles.skeletonCard, { backgroundColor: theme.colors.bgCard }]}> 
            <View style={styles.skeletonHeader}><View style={[styles.skeletonAvatar, { backgroundColor: theme.colors.bgCardAlt }]} /><View style={[styles.skeletonLineSm, { backgroundColor: theme.colors.bgCardAlt }]} /></View>
            <View style={[styles.skeletonLine, { backgroundColor: theme.colors.bgCardAlt }]} />
            <View style={[styles.skeletonLineShort, { backgroundColor: theme.colors.bgCardAlt }]} />
            <View style={[styles.skeletonMedia, { backgroundColor: theme.colors.bgCardAlt }]} />
          </View>
        ))}
      </View>
    </ScreenContainer>
  );
}

function ChallengeBanner({ userId, onShareCompletion, onDismiss }: { userId: string | undefined; onShareCompletion: () => void; onDismiss: () => void }) {
  const theme = useTheme();
  const { t, language } = useI18n();
  const challengeQuery = useActiveChallenge();
  const challenge = challengeQuery.data;
  const countQuery = useChallengeParticipantCount(challenge?.id);
  const myParticipation = useMyChallengeParticipation(challenge?.id, userId);
  const activatedPrograms = useActivatedPrograms(userId).data ?? [];
  const joinChallenge = useJoinChallenge(userId);
  const completeChallenge = useCompleteChallenge(userId);

  if (!challenge) return null;

  const joined = !!myParticipation.data?.joined;
  const completed = !!myParticipation.data?.completedAt;
  const eligibleToComplete = activatedPrograms.some((p) => p.streak >= challenge.targetStreakDays);

  return (
    <View style={[styles.challengeBanner, theme.shadows.card, { backgroundColor: theme.colors.bgCard, borderRadius: theme.radius.lg }]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Text style={{ fontSize: 20 }}>{challenge.icon}</Text>
        <Text style={[theme.type.bodyStrong, { color: theme.colors.textPrimary, flex: 1 }]}>{challenge.title}</Text>
        <Pressable onPress={onDismiss} hitSlop={10} accessibilityLabel={t('hideChallenge')}>
          <Icon name="x" size={18} color={theme.colors.textMuted} />
        </Pressable>
      </View>
      {challenge.description ? (
        <Text style={[theme.type.caption, { color: theme.colors.textSecondary, marginTop: 4 }]}>{challenge.description}</Text>
      ) : null}
      <Text style={[theme.type.captionSm, { color: theme.colors.textMuted, marginTop: 6 }]}>
        {t('participants', { count: (countQuery.data ?? 0).toLocaleString(language === 'vi' ? 'vi-VN' : language === 'ms' ? 'ms-MY' : 'en-US') })}
      </Text>
      {completed ? (
        <Pressable onPress={onShareCompletion} style={[styles.challengeBtn, { backgroundColor: theme.colors.primary, marginTop: 10 }]}>
          <Text style={[theme.type.captionSm, { color: '#fff', fontFamily: theme.fontFamily.semiBold }]}>{t('shareAchievement')}</Text>
        </Pressable>
      ) : joined && eligibleToComplete ? (
        <Pressable
          onPress={() => completeChallenge.mutate(challenge.id)}
          disabled={completeChallenge.isPending}
          style={[styles.challengeBtn, { backgroundColor: theme.colors.primary, marginTop: 10 }]}
        >
          <Text style={[theme.type.captionSm, { color: '#fff', fontFamily: theme.fontFamily.semiBold }]}>{t('markCompleted')}</Text>
        </Pressable>
      ) : joined ? (
        <View style={[styles.challengeBtn, { backgroundColor: theme.colors.bgCardAlt, marginTop: 10 }]}>
          <Text style={[theme.type.captionSm, { color: theme.colors.textSecondary, fontFamily: theme.fontFamily.semiBold }]}>{t('joined')}</Text>
        </View>
      ) : (
        <Pressable
          onPress={() => joinChallenge.mutate(challenge.id)}
          disabled={joinChallenge.isPending}
          style={[styles.challengeBtn, { backgroundColor: theme.colors.primary, marginTop: 10 }]}
        >
          <Text style={[theme.type.captionSm, { color: '#fff', fontFamily: theme.fontFamily.semiBold }]}>{t('join')}</Text>
        </Pressable>
      )}
    </View>
  );
}

export default function CommunityScreen() {
  const theme = useTheme();
  const { t } = useI18n();
  const reportReasons: { key: ReportReason; label: string }[] = [
    { key: 'spam', label: t('reportReasonSpam') },
    { key: 'inappropriate', label: t('reportReasonInappropriate') },
    { key: 'harassment', label: t('reportReasonHarassment') },
    { key: 'other', label: t('reportReasonOther') },
  ];
  const chips: { key: Filter; label: string }[] = [
    { key: 'all', label: t('all') },
    { key: 'official', label: 'TheraHOME' },
  ];
  const params = useLocalSearchParams<{ filter?: string; content?: string }>();
  const { session } = useSession();
  const userId = session?.user.id;
  const profile = useProfile(userId).data;

  const [postsLimit, setPostsLimit] = useState(DEFAULT_POSTS_PAGE_SIZE);
  const postsQuery = useCommunityPosts(postsLimit);
  const reactionsQuery = useMyPostReactions(userId);
  const savedSetQuery = useMyPostSaves(userId);
  const setPostReaction = useSetPostReaction(userId);
  const toggleSave = useTogglePostSave(userId);
  const deletePost = useDeletePost();
  const reportContent = useReportContent(userId);
  const hiddenPostsQuery = useHiddenCommunityPosts(userId);
  const hidePost = useHideCommunityPost(userId);
  const blockedUsersQuery = useBlockedCommunityUsers(userId);
  const blockUser = useBlockCommunityUser(userId);

  const posts = postsQuery.data ?? [];
  const myReactions = reactionsQuery.data ?? new Map<string, PostReaction>();
  const savedSet = savedSetQuery.data ?? new Set<string>();
  const hiddenPostIds = hiddenPostsQuery.data ?? new Set<string>();
  const blockedUserIds = blockedUsersQuery.data ?? new Set<string>();

  const focusFadeStyle = useTabFocusFade();
  const [filter, setFilter] = useState<Filter>('all');
  const [showShare, setShowShare] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [showChallenge, setShowChallenge] = useState(true);
  const [showContextBanner, setShowContextBanner] = useState(true);
  const [menuTarget, setMenuTarget] = useState<{ post: CommunityPostRow; x: number; y: number } | null>(null);
  const [reactionPicker, setReactionPicker] = useState<{ post: CommunityPostRow; pageX: number; pageY: number; hovered: PostReaction | null } | null>(null);
  const [reportTarget, setReportTarget] = useState<CommunityPostRow | null>(null);
  // Deliberately not postsQuery.isRefetching — that flips true on every
  // background refetch (realtime post_likes/community_posts changes from
  // our own reaction taps included), which would flash the pull-to-refresh
  // spinner on every tap. Only an explicit pull should show it.
  const [manualRefreshing, setManualRefreshing] = useState(false);
  // Drives CommunityVideoPlayer's `shouldAutoplay` — the post whose card is
  // most visible right now (viewableItems[0], since feed cards are large
  // enough that at most one is ever meaningfully "the" visible one). See
  // CLAUDE.md's "Community video playback overhaul" section.
  const [activeFeedItemId, setActiveFeedItemId] = useState<string | null>(null);
  const viewabilityConfigRef = useRef({ itemVisiblePercentThreshold: 50 });
  const onViewableItemsChangedRef = useRef(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    setActiveFeedItemId((viewableItems[0]?.item as CommunityPostRow | undefined)?.id ?? null);
  });

  useEffect(() => {
    if (params.filter === 'official') setFilter('official');
    setShowContextBanner(true);
  }, [params.filter, params.content]);

  // The pinned official post (if any) gets its own featured `ArticleCard`
  // at the top of the "all" feed (see `listHeader` below) instead of
  // sorting inline among regular posts — so it's excluded here to avoid
  // showing it twice. The "TheraHOME" filter tab still lists it inline
  // alongside every other official post, same as before.
  const pinnedPost = posts.find((p) => p.isOfficial && p.pinned && !hiddenPostIds.has(p.id)) ?? null;
  const pinnedPostDisplay = pinnedPost ? pinnedDisplay(pinnedPost) : null;
  const filteredPosts = posts.filter(
    (p) =>
      !hiddenPostIds.has(p.id) &&
      (!p.authorId || !blockedUserIds.has(p.authorId)) &&
      (
        (filter === 'all' && !p.isOfficial) ||
        (filter === 'official' && p.isOfficial)
      ),
  );

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 2000);
  }

  function congratulate(post: CommunityPostRow) {
    const current = myReactions.get(post.id) ?? null;
    if (current) return;
    setPostReaction.mutate({ postId: post.id, current, reaction: 'celebrate' });
    showToast(t('congratulated'));
  }

  function handleMenuAction(post: CommunityPostRow, action: 'save' | 'hide' | 'report' | 'block' | 'delete') {
    setMenuTarget(null);
    if (action === 'save') {
      const saved = savedSet.has(post.id);
      toggleSave.mutate({ postId: post.id, saved });
      showToast(saved ? t('postUnsaved') : t('postSaved'));
    } else if (action === 'report') {
      setReportTarget(post);
    } else if (action === 'hide') {
      hidePost.mutate(post.id, { onSuccess: () => showToast(t('postHidden')), onError: () => showToast(t('noContent')) });
    } else if (action === 'block' && post.authorId) {
      Alert.alert(t('blockUserConfirmTitle'), t('blockUserConfirmBody', { name: post.authorName }), [
        { text: t('cancel'), style: 'cancel' },
        { text: t('blockUser'), style: 'destructive', onPress: () => blockUser.mutate(post.authorId!, { onSuccess: () => showToast(t('blockUser')), onError: () => showToast(t('noContent')) }) },
      ]);
    } else if (action === 'delete') {
      Alert.alert(t('deletePost'), t('deletePost'), [
        { text: t('cancel'), style: 'cancel' },
        {
          text: t('delete'),
          style: 'destructive',
          onPress: () =>
            deletePost.mutate(post.id, {
              onSuccess: () => showToast(t('postDeleted')),
              onError: () => showToast(t('noContent')),
            }),
        },
      ]);
    }
  }

  function submitReport(reason: ReportReason) {
    if (!reportTarget) return;
    const target = reportTarget;
    setReportTarget(null);
    reportContent.mutate(
      { contentType: 'post', contentId: target.id, reason },
      {
        onSuccess: () => showToast(t('reportThanks')),
        onError: (e) => showToast(friendlyCommunityError(e)),
      },
    );
  }

  async function refreshFeed() {
    setManualRefreshing(true);
    try {
      await Promise.all([postsQuery.refetch(), reactionsQuery.refetch(), savedSetQuery.refetch(), hiddenPostsQuery.refetch(), blockedUsersQuery.refetch()]);
    } finally {
      setManualRefreshing(false);
    }
  }

  if (postsQuery.isPending) {
    return <FeedSkeleton />;
  }

  const listHeader = (
    <>
      <View style={styles.titleRow}>
        <Text style={[theme.type.display, { color: theme.colors.textPrimary }]}>{t('community')}</Text>
        <Pressable
          onPress={() => userId && router.push({ pathname: '/community/profile/[userId]', params: { userId } })}
          hitSlop={8}
          accessibilityLabel={t('openCommunityProfile')}
        >
          <AvatarImg size={38} uri={profile?.avatarUrl} />
        </Pressable>
      </View>

      {showContextBanner && (params.content === 'ad' || params.content === 'blog') ? (
        <View style={[styles.contextBanner, { backgroundColor: theme.colors.primaryTint10, borderColor: theme.colors.primary }]}>
          <Icon name={params.content === 'ad' ? 'megaphone' : 'book'} size={18} color={theme.colors.primary} />
          <Text style={[theme.type.bodyStrong, { color: theme.colors.primaryDark, flex: 1 }]}>
            {params.content === 'ad' ? t('officialOffers') : t('officialArticles')}
          </Text>
          <Pressable onPress={() => setShowContextBanner(false)} hitSlop={10} accessibilityLabel={t('hideNotice')}>
            <Icon name="x" size={18} color={theme.colors.primaryDark} />
          </Pressable>
        </View>
      ) : null}

      {filter === 'official' && showChallenge ? <ChallengeBanner userId={userId} onShareCompletion={() => router.push('/community/create')} onDismiss={() => setShowChallenge(false)} /> : null}

      {filter === 'all' ? <Pressable
        onPress={() => setShowShare(true)}
        style={[styles.composer, theme.shadows.card, { backgroundColor: theme.colors.bgCard, borderRadius: theme.radius.full }]}
      >
        <AvatarImg size={32} uri={profile?.avatarUrl} />
        {/* flex+1-line+capped font scaling: on narrow screens / large
            system text the placeholder used to overflow the pill and get
            clipped mid-glyph (device-dependent) — now it ellipsizes. */}
        <Text
          numberOfLines={1}
          ellipsizeMode="tail"
          maxFontSizeMultiplier={1.2}
          style={[theme.type.body, { color: theme.colors.textMuted, flex: 1, minWidth: 0 }]}
        >
          {t('shareJourney')}
        </Text>
      </Pressable> : null}

      <View style={styles.chipsRow}>
        {chips.map((c) => {
          return <OptionChip key={c.key} label={c.label} active={filter === c.key} onPress={() => setFilter(c.key)} style={styles.filterChip} />;
        })}
      </View>

      {filter === 'all' && pinnedPost ? (
        <View style={styles.pinnedCardWrap}>
          <ArticleCard
            title={pinnedPostDisplay!.title}
            description={pinnedPostDisplay!.content}
            thumbnailUrl={pinnedPostDisplay!.thumbnailUrl}
            createdAt={pinnedPost.createdAt}
            onPress={() => router.push({ pathname: '/community/[postId]', params: { postId: pinnedPost.id } })}
          />
        </View>
      ) : null}
    </>
  );

  function renderPost({ item: p, index }: { item: CommunityPostRow; index: number }) {
    const currentReaction = myReactions.get(p.id) ?? null;
    const savedByMe = savedSet.has(p.id);
    const isMilestone = p.dayMilestone != null || p.phaseMilestone != null;
    const badge = p.phaseMilestone ? t('completePhase', { phase: p.phaseMilestone }) : null;
    return (
      <Reanimated.View entering={fadeUpEntering(staggerDelay(index, 40, 6))} style={styles.postGap}>
      <Pressable
        onPress={() => router.push({ pathname: '/community/[postId]', params: { postId: p.id } })}
        style={[styles.postCard, theme.shadows.card, { backgroundColor: p.isOfficial ? theme.colors.primaryTint05 : theme.colors.bgCard, borderColor: p.isOfficial ? theme.colors.primary : 'transparent', borderRadius: theme.radius.lg, padding: theme.cardPadding }]}
      >
        <View style={styles.postHeader}>
          <Pressable onPress={() => router.push({ pathname: '/community/profile/[userId]', params: { userId: p.isOfficial ? 'official' : p.authorId! } })} style={styles.authorTapArea}>
            <CommunityAvatar name={p.authorName} authorId={p.authorId} avatarUrl={p.authorAvatarUrl} size={36} isOfficial={p.isOfficial} />
            <View style={{ flex: 1, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center' }}>
              <Text style={[theme.type.bodyStrong, { color: theme.colors.textPrimary, fontFamily: theme.fontFamily.bold }]}>
                {p.authorName}
              </Text>
              {p.isOfficial ? <View style={[styles.verifiedBadge, { backgroundColor: theme.colors.primary }]}><Icon name="check" size={12} color="#fff" strokeWidth={3} /></View> : null}
              <Text style={[theme.type.caption, { color: theme.colors.textMuted }]}> · {timeAgo(p.createdAt, t)}</Text>
            </View>
          </Pressable>
          <Pressable onPress={(event) => setMenuTarget({ post: p, x: event.nativeEvent.pageX, y: event.nativeEvent.pageY })} hitSlop={8}>
            <Icon name="more-horizontal" size={18} color={theme.colors.textMuted} />
          </Pressable>
        </View>

        {p.status !== 'approved' ? (
          // RLS only ever returns a non-approved row to its own author (or
          // staff) — so this banner is effectively "your own post's state".
          <View
            style={[
              styles.moderationBanner,
              { backgroundColor: p.status === 'pending' ? theme.colors.warningTint : theme.colors.errorTint },
            ]}
          >
            <Icon name={p.status === 'pending' ? 'clock' : 'eye-off'} size={13} color={p.status === 'pending' ? theme.colors.warning : theme.colors.error} />
            <Text style={[theme.type.captionSm, { color: p.status === 'pending' ? theme.colors.warning : theme.colors.error, flex: 1 }]}>
              {p.status === 'pending' ? t('postPendingBadge') : t('postRejectedBadge')}
            </Text>
          </View>
        ) : null}

        {p.isOfficial && p.title ? (
          <Text numberOfLines={2} style={[theme.type.h2, { color: theme.colors.textPrimary, marginBottom: 6 }]}>
            {p.title}
          </Text>
        ) : null}
        <ExpandableText
          text={p.text}
          collapsedLines={3}
          style={[
            p.isOfficial ? theme.type.bodyStrong : theme.type.body,
            { color: theme.colors.textPrimary, lineHeight: 21 },
          ]}
        />

        <MediaGrid uris={p.mediaUrls} postId={p.id} shouldAutoplay={p.id === activeFeedItemId} />

        {p.progressSnapshot ? <ProgressShareCard postType={p.postType} snapshot={p.progressSnapshot} /> : null}

        {badge ? (
          <View style={[styles.badgePill, { backgroundColor: theme.colors.primaryTint10 }]}>
            <Text style={[theme.type.captionSm, { color: theme.colors.primaryDark }]}>{badge}</Text>
          </View>
        ) : null}

        <PostActionBar
          currentReaction={currentReaction}
          reactionCounts={p.reactionCounts}
          likesCount={p.likesCount}
          commentsCount={p.commentsCount}
          savesCount={p.savesCount}
          saved={savedByMe}
          onQuickReact={() => setPostReaction.mutate({ postId: p.id, current: currentReaction, reaction: currentReaction ? null : 'heart' }, { onError: () => showToast(t('cannotUpdateReaction')) })}
          onReactionLongPress={({ pageX, pageY }) => setReactionPicker({ post: p, pageX, pageY, hovered: null })}
          onReactionLongPressMove={(point) => setReactionPicker((active) => active?.post.id === p.id ? { ...active, hovered: pickerReactionAt(point, getReactionTrayFrame(active, WINDOW_WIDTH)) } : active)}
          onReactionLongPressRelease={() => {
            const active = reactionPicker;
            if (active?.post.id !== p.id || !active.hovered) return;
            setPostReaction.mutate({ postId: p.id, current: currentReaction, reaction: active.hovered }, { onError: () => showToast(t('cannotUpdateReaction')) });
            hapticConfirm();
            setReactionPicker(null);
          }}
          onCommentPress={() => router.push({ pathname: '/community/[postId]', params: { postId: p.id } })}
          onSavePress={() => toggleSave.mutate({ postId: p.id, saved: savedByMe }, { onError: () => showToast(t('cannotSavePost')) })}
        />
        {isMilestone ? (
          <Pressable
            onPress={() => congratulate(p)}
            disabled={!!currentReaction}
            style={[
              styles.congratsBtn,
              {
                borderWidth: currentReaction ? 0 : 1,
                borderColor: theme.colors.borderInput,
                backgroundColor: currentReaction ? theme.colors.primary : 'transparent',
                borderRadius: theme.radius.full,
              },
            ]}
          >
            <Text style={[theme.type.captionSm, { color: currentReaction ? '#fff' : theme.colors.textPrimary }]}>
              {currentReaction ? t('congratulated') : t('congratulate')}
            </Text>
          </Pressable>
        ) : null}

      </Pressable>
      </Reanimated.View>
    );
  }

  return (
    <ScreenContainer edges={['top']}>
      <Reanimated.View style={[{ flex: 1 }, focusFadeStyle]}>
      <Reanimated.View key={filter} entering={FadeIn.duration(180)} exiting={FadeOut.duration(150)} style={{ flex: 1 }}>
      <FlatList
        data={filteredPosts}
        keyExtractor={(p) => p.id}
        renderItem={renderPost}
        contentContainerStyle={styles.scrollBody}
        viewabilityConfig={viewabilityConfigRef.current}
        onViewableItemsChanged={onViewableItemsChangedRef.current}
        initialNumToRender={3}
        maxToRenderPerBatch={3}
        updateCellsBatchingPeriod={50}
        windowSize={5}
        removeClippedSubviews={Platform.OS === 'android'}
        onEndReachedThreshold={0.5}
        onEndReached={() => {
          if (posts.length >= postsLimit && !postsQuery.isFetching) {
            setPostsLimit((limit) => limit + DEFAULT_POSTS_PAGE_SIZE);
          }
        }}
        refreshControl={
          <RefreshControl
            refreshing={manualRefreshing}
            onRefresh={refreshFeed}
            tintColor={theme.colors.primary}
          />
        }
        ListHeaderComponent={listHeader}
        ListEmptyComponent={
          <Text style={[theme.type.body, { color: theme.colors.textMuted, textAlign: 'center', marginTop: 40 }]}>
            {t('noPosts')}
          </Text>
        }
        ListFooterComponent={postsQuery.isFetching && !postsQuery.isRefetching ? <ActivityIndicator color={theme.colors.primary} style={{ marginVertical: 18 }} /> : null}
      />
      </Reanimated.View>
      </Reanimated.View>

      {reactionPicker ? (
        <Pressable style={styles.reactionPickerBackdrop} onPress={() => setReactionPicker(null)}>
          <ReactionPicker highlightedReaction={reactionPicker.hovered} style={[styles.floatingReactionPicker, getReactionTrayFrame(reactionPicker, WINDOW_WIDTH)]} onSelect={(reaction) => {
            const current = myReactions.get(reactionPicker.post.id) ?? null;
            setPostReaction.mutate({ postId: reactionPicker.post.id, current, reaction });
            hapticConfirm();
            setReactionPicker(null);
          }} />
        </Pressable>
      ) : null}

      {showShare ? (
        <ShareStoryModal
          onClose={() => setShowShare(false)}
          onSupport={() => {
            setShowShare(false);
            router.push('/chat/human');
          }}
          onShare={() => {
            setShowShare(false);
            router.push('/community/create');
          }}
        />
      ) : null}

      <Modal visible={!!menuTarget} transparent animationType="none" onRequestClose={() => setMenuTarget(null)}>
        <Pressable style={styles.menuBackdrop} onPress={() => setMenuTarget(null)}>
          {menuTarget ? <View style={[styles.menuAnchor, { top: Math.max(12, Math.min(menuTarget.y + 8, WINDOW_HEIGHT - 290)), left: Math.max(12, Math.min(menuTarget.x - 180, WINDOW_WIDTH - 202)) }]}>
            <View style={[styles.menu, theme.shadows.card, { backgroundColor: theme.colors.bgCard, borderRadius: theme.radius.md }]}> 
              <Pressable onPress={() => handleMenuAction(menuTarget.post, 'save')} style={styles.menuItem}><Icon name="bookmark" size={15} color={theme.colors.textSecondary} /><Text style={[theme.type.caption, { color: theme.colors.textPrimary, fontFamily: theme.fontFamily.semiBold }]}>{savedSet.has(menuTarget.post.id) ? t('unsave') : t('savePost')}</Text></Pressable>
              <Pressable onPress={() => handleMenuAction(menuTarget.post, 'hide')} style={[styles.menuItem, { borderTopWidth: 1, borderTopColor: theme.colors.divider }]}><Icon name="eye" size={15} color={theme.colors.textSecondary} /><Text style={[theme.type.caption, { color: theme.colors.textPrimary, fontFamily: theme.fontFamily.semiBold }]}>{t('hidePost')}</Text></Pressable>
              {menuTarget.post.authorId === userId ? <Pressable onPress={() => handleMenuAction(menuTarget.post, 'delete')} style={[styles.menuItem, { borderTopWidth: 1, borderTopColor: theme.colors.divider }]}><Icon name="trash-2" size={15} color={theme.colors.error} /><Text style={[theme.type.caption, { color: theme.colors.error, fontFamily: theme.fontFamily.semiBold }]}>{t('deletePost')}</Text></Pressable> : <>
                <Pressable onPress={() => handleMenuAction(menuTarget.post, 'report')} style={[styles.menuItem, { borderTopWidth: 1, borderTopColor: theme.colors.divider }]}><Icon name="flag" size={15} color={theme.colors.error} /><Text style={[theme.type.caption, { color: theme.colors.error, fontFamily: theme.fontFamily.semiBold }]}>{t('reportPost')}</Text></Pressable>
                {!menuTarget.post.isOfficial && menuTarget.post.authorId ? <Pressable onPress={() => handleMenuAction(menuTarget.post, 'block')} style={[styles.menuItem, { borderTopWidth: 1, borderTopColor: theme.colors.divider }]}><Icon name="user-x" size={15} color={theme.colors.error} /><Text style={[theme.type.caption, { color: theme.colors.error, fontFamily: theme.fontFamily.semiBold }]}>{t('blockUser')}</Text></Pressable> : null}
              </>}
            </View>
          </View> : null}
        </Pressable>
      </Modal>

      <Modal visible={!!reportTarget} transparent animationType="fade" onRequestClose={() => setReportTarget(null)}>
        <Pressable style={styles.reportBackdrop} onPress={() => setReportTarget(null)}>
          <Pressable style={[styles.reportSheet, theme.shadows.card, { backgroundColor: theme.colors.bgCard, borderRadius: theme.radius.lg }]}>
            <Text style={[theme.type.bodyStrong, { color: theme.colors.textPrimary, marginBottom: 4 }]}>{t('reportPost')}</Text>
            <Text style={[theme.type.caption, { color: theme.colors.textSecondary, marginBottom: 14 }]}>{t('chooseReportReason')}</Text>
            {reportReasons.map((r) => (
              <Pressable key={r.key} onPress={() => submitReport(r.key)} style={[styles.reportOption, { borderTopColor: theme.colors.divider }]}>
                <Text style={[theme.type.body, { color: theme.colors.textPrimary }]}>{r.label}</Text>
              </Pressable>
            ))}
            <Pressable onPress={() => setReportTarget(null)} style={styles.reportCancel}>
              <Text style={[theme.type.bodyStrong, { color: theme.colors.textMuted }]}>{t('cancel')}</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      {toast ? (
        <View style={[styles.toast, { backgroundColor: theme.colors.textPrimary, borderRadius: theme.radius.md }]}>
          <Text style={[theme.type.caption, { color: '#fff', textAlign: 'center' }]}>{toast}</Text>
        </View>
      ) : null}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  articlesSection: {
    marginTop: 18,
    gap: 10,
  },
  articleCard: {
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  articleIcon: {
    width: 46,
    height: 46,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollBody: {
    paddingHorizontal: 20,
    paddingBottom: 140,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 12,
  },
  composer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 16,
    marginTop: 16,
  },
  loadMoreBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderRadius: 999,
    paddingVertical: 12,
    marginTop: 4,
  },
  challengeBanner: {
    marginTop: 16,
    padding: 16,
  },
  challengeBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 999,
    paddingVertical: 10,
  },
  contextBanner: {
    marginTop: 14,
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  chipsRow: {
    marginTop: 16,
    marginBottom: 16,
    flexDirection: 'row',
    gap: 6,
  },
  pinnedCardWrap: {
    marginBottom: 14,
  },
  moderationBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 10,
    marginBottom: 8,
  },
  postGap: {
    marginBottom: 12,
  },
  filterChip: {
    flex: 1,
    paddingHorizontal: 10,
  },
  postCard: {
    borderWidth: 1,
  },
  postHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  authorTapArea: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  verifiedBadge: {
    width: 19,
    height: 19,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgePill: {
    alignSelf: 'flex-start',
    marginTop: 10,
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  reactionPickerBackdrop: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, zIndex: 30 },
  floatingReactionPicker: { position: 'absolute' },
  congratsBtn: {
    alignSelf: 'flex-end',
    marginTop: 6,
    paddingVertical: 7,
    paddingHorizontal: 14,
  },
  menuBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(10, 18, 34, 0.08)',
  },
  menuAnchor: {
    position: 'absolute',
  },
  menu: {
    minWidth: 190,
    overflow: 'hidden',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 11,
    paddingHorizontal: 14,
  },
  toast: {
    position: 'absolute',
    left: 20,
    right: 20,
    bottom: 90,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  skeletonBody: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 24,
    gap: 14,
  },
  skeletonTitle: {
    width: 150,
    height: 34,
    borderRadius: 12,
    marginBottom: 4,
  },
  skeletonCard: {
    borderRadius: 20,
    padding: 16,
    gap: 12,
  },
  skeletonHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  skeletonAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  skeletonLineSm: {
    width: 125,
    height: 13,
    borderRadius: 7,
  },
  skeletonLine: {
    width: '92%',
    height: 13,
    borderRadius: 7,
  },
  skeletonLineShort: {
    width: '58%',
    height: 13,
    borderRadius: 7,
  },
  skeletonMedia: {
    width: '100%',
    height: 145,
    borderRadius: 14,
  },
  reportBackdrop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingHorizontal: 16,
    paddingBottom: 28,
  },
  reportSheet: {
    width: '100%',
    padding: 18,
  },
  reportOption: {
    paddingVertical: 13,
    borderTopWidth: 1,
  },
  reportCancel: {
    paddingVertical: 13,
    alignItems: 'center',
    marginTop: 4,
  },
});
