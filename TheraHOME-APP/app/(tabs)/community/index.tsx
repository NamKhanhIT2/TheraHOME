import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Dimensions, FlatList, Modal, Platform, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View, type ViewToken } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import Reanimated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { useTheme, homeGlassColors } from '@/theme';
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
  useCommunityHighlights,
  useMyCheckInToday,
  useSubmitCheckIn,
  friendlyCommunityError,
  DEFAULT_POSTS_PAGE_SIZE,
  type CheckInMood,
  type CommunityHighlightRow,
  type CommunityPostRow,
  type PostReaction,
  type ReportReason,
} from '@/hooks/useCommunity';
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
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import MaskedView from '@react-native-masked-view/masked-view';
import { HomeGlassNav, navBottomOffset } from '@/components/home/HomeGlassNav';
import { HomeMascot } from '@/components/home/HomeMascot';
import { VerticalGradient } from '@/components/home/VerticalGradient';
import { heroFont } from '@/components/home/glass';
import { Icon } from '@/components/icons/Icon';
import { ShareStoryModal } from '@/components/ShareStoryModal';
import { CommunityStories } from '@/components/community/CommunityStories';
import { MemberStreakSheet } from '@/components/community/MemberStreakSheet';
import { CheckInSheet } from '@/components/community/CheckInSheet';
import { isCommunityNotification, useNotifications } from '@/hooks/useNotifications';
import { useI18n } from '@/lib/i18n';
import { ReactionPicker } from '@/components/community/ReactionPicker';
import { PostActionBar } from '@/components/community/PostActionBar';
import { getReactionTrayFrame, pickerReactionAt } from '@/components/community/reactionPickerGeometry';
import { hapticConfirm } from '@/lib/haptics';
import { useTabFocusFade } from '@/hooks/useTabFocusFade';
import { rankCommunityPosts } from '@/lib/communityRanking';

/** The four kinds of post, in the composer's own row. Their colours are the
 * reference's, and decorative — they do not mean anything elsewhere. */
const COMPOSER_CHIPS: { type: string; icon: string; color: string; label: 'image' | 'video' | 'progress' | 'exercise' }[] = [
  { type: 'image', icon: 'image', color: '#A78BFA', label: 'image' },
  { type: 'image', icon: 'film', color: '#22D3EE', label: 'video' },
  { type: 'progress', icon: 'activity', color: '#F472B6', label: 'progress' },
  { type: 'exercise', icon: 'calendar', color: '#FBBF24', label: 'exercise' },
];

/** Violet rather than the blue the other tabs use — this one is built on the
 * owner's own reference for it, accent and all (2026-10-25). */
const FEED_STOPS = [
  { offset: 0, color: homeGlassColors.purpleSky[0] },
  { offset: 0.35, color: homeGlassColors.purpleSky[1] },
  { offset: 1, color: homeGlassColors.purpleSky[2] },
];

const { width: WINDOW_WIDTH, height: WINDOW_HEIGHT } = Dimensions.get('window');

function FeedSkeleton() {
  return (
    <View style={[styles.root, { backgroundColor: homeGlassColors.purpleSky[2] }]}>
      <SafeAreaView edges={['top']} style={styles.root}>
      <View style={styles.skeletonBody}>
        <View style={[styles.skeletonTitle, { backgroundColor: homeGlassColors.surfaceRaised }]} />
        {[0, 1, 2].map((item) => (
          <View key={item} style={[styles.skeletonCard, { backgroundColor: homeGlassColors.surface }]}> 
            <View style={styles.skeletonHeader}><View style={[styles.skeletonAvatar, { backgroundColor: homeGlassColors.surfaceRaised }]} /><View style={[styles.skeletonLineSm, { backgroundColor: homeGlassColors.surfaceRaised }]} /></View>
            <View style={[styles.skeletonLine, { backgroundColor: homeGlassColors.surfaceRaised }]} />
            <View style={[styles.skeletonLineShort, { backgroundColor: homeGlassColors.surfaceRaised }]} />
            <View style={[styles.skeletonMedia, { backgroundColor: homeGlassColors.surfaceRaised }]} />
          </View>
        ))}
      </View>
      </SafeAreaView>
    </View>
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
    <View style={[styles.challengeBanner, { borderWidth: 1, borderColor: homeGlassColors.hairline, backgroundColor: homeGlassColors.surface, borderRadius: theme.radius.lg }]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Text style={{ fontSize: 20 }}>{challenge.icon}</Text>
        <Text style={[theme.type.bodyStrong, { color: homeGlassColors.text, flex: 1 }]}>{challenge.title}</Text>
        <Pressable onPress={onDismiss} hitSlop={10} accessibilityLabel={t('hideChallenge')}>
          <Icon name="x" size={18} color={homeGlassColors.textFaint} />
        </Pressable>
      </View>
      {challenge.description ? (
        <Text style={[theme.type.caption, { color: homeGlassColors.textMuted, marginTop: 4 }]}>{challenge.description}</Text>
      ) : null}
      <Text style={[theme.type.captionSm, { color: homeGlassColors.textFaint, marginTop: 6 }]}>
        {t('participants', { count: (countQuery.data ?? 0).toLocaleString(language === 'vi' ? 'vi-VN' : language === 'ms' ? 'ms-MY' : 'en-US') })}
      </Text>
      {completed ? (
        <Pressable onPress={onShareCompletion} style={[styles.challengeBtn, { backgroundColor: homeGlassColors.purpleStrong, marginTop: 10 }]}>
          <Text style={[theme.type.captionSm, { color: '#fff', fontFamily: theme.fontFamily.semiBold }]}>{t('shareAchievement')}</Text>
        </Pressable>
      ) : joined && eligibleToComplete ? (
        <Pressable
          onPress={() => completeChallenge.mutate(challenge.id)}
          disabled={completeChallenge.isPending}
          style={[styles.challengeBtn, { backgroundColor: homeGlassColors.purpleStrong, marginTop: 10 }]}
        >
          <Text style={[theme.type.captionSm, { color: '#fff', fontFamily: theme.fontFamily.semiBold }]}>{t('markCompleted')}</Text>
        </Pressable>
      ) : joined ? (
        <View style={[styles.challengeBtn, { backgroundColor: homeGlassColors.surfaceRaised, marginTop: 10 }]}>
          <Text style={[theme.type.captionSm, { color: homeGlassColors.textMuted, fontFamily: theme.fontFamily.semiBold }]}>{t('joined')}</Text>
        </View>
      ) : (
        <Pressable
          onPress={() => joinChallenge.mutate(challenge.id)}
          disabled={joinChallenge.isPending}
          style={[styles.challengeBtn, { backgroundColor: homeGlassColors.purpleStrong, marginTop: 10 }]}
        >
          <Text style={[theme.type.captionSm, { color: '#fff', fontFamily: theme.fontFamily.semiBold }]}>{t('join')}</Text>
        </Pressable>
      )}
    </View>
  );
}

export default function CommunityScreen() {
  const theme = useTheme();
  // Modals draw under the Android navigation bar (edge-to-edge), so the
  // report sheet keeps the bottom inset clear — same as AssistantBubble.
  const insets = useSafeAreaInsets();
  const { t } = useI18n();
  const reportReasons: { key: ReportReason; label: string }[] = [
    { key: 'spam', label: t('reportReasonSpam') },
    { key: 'inappropriate', label: t('reportReasonInappropriate') },
    { key: 'harassment', label: t('reportReasonHarassment') },
    { key: 'other', label: t('reportReasonOther') },
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
  const highlightsQuery = useCommunityHighlights(userId);
  const checkInQuery = useMyCheckInToday(userId);
  const submitCheckIn = useSubmitCheckIn(userId);
  const notifications = useNotifications(userId).data ?? [];
  // This bell belongs to Cộng đồng, so it counts community things only —
  // not water reminders, not "đến giờ tập" (owner, 2026-10-26).
  const unreadCount = notifications.filter((n) => !n.read && isCommunityNotification(n.type)).length;

  const posts = useMemo(() => postsQuery.data ?? [], [postsQuery.data]);
  const myReactions = useMemo(() => reactionsQuery.data ?? new Map<string, PostReaction>(), [reactionsQuery.data]);
  const savedSet = useMemo(() => savedSetQuery.data ?? new Set<string>(), [savedSetQuery.data]);
  const hiddenPostIds = useMemo(() => hiddenPostsQuery.data ?? new Set<string>(), [hiddenPostsQuery.data]);
  const blockedUserIds = useMemo(() => blockedUsersQuery.data ?? new Set<string>(), [blockedUsersQuery.data]);
  // Blocking someone hides their posts; it has to hide their circle too,
  // and you are already the first circle, so you are not in the row twice.
  const highlights = useMemo(
    () => (highlightsQuery.data ?? []).filter((m) => m.userId !== userId && !blockedUserIds.has(m.userId)),
    [highlightsQuery.data, blockedUserIds, userId],
  );

  /** Whether a post is reacted to or saved lives OUTSIDE `data` — in these
   * two maps, keyed by their own queries — so the list has to be told when
   * they change. Without it the feed's heart and bookmark did nothing
   * visible: the tap reached the server and the row was written, but the
   * card never redrew (2026-11-01). Worse than cosmetic, because the card
   * then kept handing its stale state back to the mutation: the second tap
   * repeated the first instead of undoing it, so from the feed you could
   * like but never unlike, save but never unsave. Only pulling to refresh
   * straightened it out. The post detail screen was always fine — it holds
   * one post, not a virtualised list. */
  const listExtraData = useMemo(() => ({ myReactions, savedSet }), [myReactions, savedSet]);
  const focusFadeStyle = useTabFocusFade();
  const maskStops = useMemo(() => {
    const height = WINDOW_HEIGHT - insets.top;
    const navTop = height - (navBottomOffset(insets.bottom) + 60);
    const at = (y: number) => Math.min(1, Math.max(0, y / height));
    const c = homeGlassColors.text;
    return [
      { offset: 0, color: c, opacity: 1 },
      { offset: at(navTop - 44), color: c, opacity: 1 },
      { offset: at(navTop + 14), color: c, opacity: 0 },
      { offset: 1, color: c, opacity: 0 },
    ];
  }, [insets.bottom, insets.top]);
  const [showShare, setShowShare] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [showChallenge, setShowChallenge] = useState(true);
  const [showContextBanner, setShowContextBanner] = useState(true);
  const [menuTarget, setMenuTarget] = useState<{ post: CommunityPostRow; x: number; y: number } | null>(null);
  const [reactionPicker, setReactionPicker] = useState<{ post: CommunityPostRow; pageX: number; pageY: number; hovered: PostReaction | null } | null>(null);
  const [reportTarget, setReportTarget] = useState<CommunityPostRow | null>(null);
  const [streakMember, setStreakMember] = useState<(CommunityHighlightRow & { rank: number }) | null>(null);
  const [checkInOpen, setCheckInOpen] = useState(false);
  const [checkInError, setCheckInError] = useState<string | null>(null);
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
    setShowContextBanner(true);
  }, [params.filter, params.content]);
  // Latest reaction/save sets for the ranker, read through refs so changing
  // them does not itself trigger a re-rank (see the memo below).
  const reactionsRef = useRef(myReactions);
  const savesRef = useRef(savedSet);
  useEffect(() => {
    reactionsRef.current = myReactions;
    savesRef.current = savedSet;
  }, [myReactions, savedSet]);

  // The order the ranker produced, remembered by post id. See the memo.
  const rankOrderRef = useRef<{ key: string; order: Map<string, number> }>({ key: '', order: new Map() });

  const filteredPosts = useMemo(() => {
    // One feed. A TheraHOME post is a post like any other now (owner,
    // 2026-10-25) — it used to be split out into its own tab, with only the
    // pinned one shown here as a separate card.
    const eligible = posts.filter(
      (p) => !hiddenPostIds.has(p.id) && (!p.authorId || !blockedUserIds.has(p.authorId)),
    );
    // Ranking is deliberately NOT recomputed when the viewer reacts or saves:
    // per-author affinity is derived from those very sets, so a tap used to
    // re-sort the feed under the user's finger.
    //
    // Reading them through refs was not enough. Saving a post invalidates
    // the feed query, the refetch hands back a NEW posts array, and this
    // memo re-ran — by which time the refs held the new save, so the post
    // the user had just bookmarked climbed to the top (owner, 2026-10-26).
    // So re-rank only when the SET of posts actually changes: a refetch that
    // returns the same ids keeps the order already on screen, while a new
    // post, a hidden post or a "load more" page gets a fresh rank.
    const key = eligible.map((p) => p.id).join(',');
    if (rankOrderRef.current.key !== key) {
      const ranked = rankCommunityPosts(eligible, reactionsRef.current, savesRef.current);
      rankOrderRef.current = { key, order: new Map(ranked.map((p, i) => [p.id, i])) };
      return ranked;
    }
    const { order } = rankOrderRef.current;
    return [...eligible].sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
  }, [blockedUserIds, hiddenPostIds, posts]);

  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
  }, []);
  function showToast(msg: string) {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2000);
  }

  function congratulate(post: CommunityPostRow) {
    const current = myReactions.get(post.id) ?? null;
    if (current) return;
    // The toast used to fire regardless of the result. The hook rolls the
    // reaction back on failure, so a failed congratulation left the post
    // unchanged while the user had just been told it worked.
    setPostReaction.mutate(
      { postId: post.id, current, reaction: 'celebrate' },
      { onSuccess: () => showToast(t('congratulated')), onError: () => showToast(t('cannotUpdateReaction')) },
    );
  }

  function handleMenuAction(post: CommunityPostRow, action: 'save' | 'hide' | 'report' | 'block' | 'delete') {
    setMenuTarget(null);
    if (action === 'save') {
      const saved = savedSet.has(post.id);
      toggleSave.mutate(
        { postId: post.id, saved },
        { onSuccess: () => showToast(saved ? t('postUnsaved') : t('postSaved')), onError: () => showToast(t('errGeneric')) },
      );
    } else if (action === 'report') {
      setReportTarget(post);
    } else if (action === 'hide') {
      hidePost.mutate(post.id, { onSuccess: () => showToast(t('postHidden')), onError: () => showToast(t('errGeneric')) });
    } else if (action === 'block' && post.authorId) {
      Alert.alert(t('blockUserConfirmTitle'), t('blockUserConfirmBody', { name: post.authorName }), [
        { text: t('cancel'), style: 'cancel' },
        { text: t('blockUser'), style: 'destructive', onPress: () => { if (post.authorId) blockUser.mutate(post.authorId, { onSuccess: () => showToast(t('userBlocked')), onError: () => showToast(t('errGeneric')) }); } },
      ]);
    } else if (action === 'delete') {
      Alert.alert(t('deletePost'), t('deletePostConfirmBody'), [
        { text: t('cancel'), style: 'cancel' },
        {
          text: t('delete'),
          style: 'destructive',
          onPress: () =>
            deletePost.mutate(post.id, {
              onSuccess: () => showToast(t('postDeleted')),
              onError: () => showToast(t('errGeneric')),
            }),
        },
      ]);
    }
  }

  function submitReport(reason: ReportReason) {
    if (!reportTarget || reportContent.isPending) return;
    const target = reportTarget;
    setReportTarget(null);
    reportContent.mutate(
      { contentType: 'post', contentId: target.id, reason },
      {
        onSuccess: () => {
          hidePost.mutate(target.id);
          showToast(t('reportThanks'));
        },
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
      {/* Title left, the inbox and the compose button right — the owner's
          reference (2026-10-26). Their own avatar moved out of here and
          into the strip below, where it is the first circle. */}
      <View style={styles.titleRow}>
        <Text style={[styles.screenTitle, heroFont('700'), { color: homeGlassColors.text }]}>{t('community')}</Text>
        <View style={styles.titleActions}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('notifications')}
            onPress={() => router.push({ pathname: '/notifications', params: { scope: 'community' } })}
            hitSlop={8}
            style={({ pressed }) => [styles.headerButton, { backgroundColor: homeGlassColors.surfaceRaised }, pressed ? { opacity: 0.6 } : null]}
          >
            <Icon name="bell" size={21} color={homeGlassColors.text} />
            {unreadCount > 0 ? (
              <View style={[styles.headerBadge, { backgroundColor: homeGlassColors.badge, borderColor: homeGlassColors.purpleSky[1] }]}>
                <Text style={styles.headerBadgeCount} numberOfLines={1}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
              </View>
            ) : null}
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('createPost')}
            onPress={() => router.push('/community/create')}
            hitSlop={8}
            style={({ pressed }) => [styles.headerButton, styles.headerButtonSolid, { backgroundColor: homeGlassColors.purpleStrong }, pressed ? { opacity: 0.75 } : null]}
          >
            <Icon name="plus" size={21} color="#FFFFFF" strokeWidth={2.6} />
          </Pressable>
        </View>
      </View>

      <CommunityStories
        myAvatarUrl={profile?.avatarUrl}
        members={highlights}
        checkedIn={checkInQuery.data?.checkedIn ?? false}
        // The "+" is "Điểm danh hôm nay", not "write a post" (owner,
        // 2026-10-26) — the compose button lives in the header above.
        onAdd={() => { setCheckInError(null); setCheckInOpen(true); }}
        onOpenMember={(memberId) => {
          const index = highlights.findIndex((m) => m.userId === memberId);
          if (index >= 0) setStreakMember({ ...highlights[index], rank: index + 1 });
        }}
      />

      {showContextBanner && (params.content === 'ad' || params.content === 'blog') ? (
        <View style={[styles.contextBanner, { backgroundColor: homeGlassColors.surfaceRaised, borderColor: homeGlassColors.purpleStrong }]}>
          <Icon name={params.content === 'ad' ? 'megaphone' : 'book'} size={18} color={homeGlassColors.purpleStrong} />
          <Text style={[theme.type.bodyStrong, { color: homeGlassColors.purple, flex: 1 }]}>
            {params.content === 'ad' ? t('officialOffers') : t('officialArticles')}
          </Text>
          <Pressable onPress={() => setShowContextBanner(false)} hitSlop={10} accessibilityLabel={t('hideNotice')}>
            <Icon name="x" size={18} color={homeGlassColors.purple} />
          </Pressable>
        </View>
      ) : null}

      {showChallenge ? <ChallengeBanner userId={userId} onShareCompletion={() => router.push('/community/create')} onDismiss={() => setShowChallenge(false)} /> : null}

      {(
        // The reference's composer: a card with the prompt on top and the
        // four things you can post underneath, each going straight into the
        // composer with that kind selected (owner, 2026-10-25).
        <View style={[styles.composer, { backgroundColor: homeGlassColors.surface, borderColor: homeGlassColors.hairline }]}>
          <Pressable onPress={() => setShowShare(true)} style={styles.composerPrompt}>
            <AvatarImg tone="glass" size={38} uri={profile?.avatarUrl} />
            {/* flex+1-line+capped font scaling: on narrow screens / large
                system text the placeholder used to overflow and get clipped
                mid-glyph (device-dependent) — now it ellipsizes. */}
            <Text
              numberOfLines={1}
              ellipsizeMode="tail"
              maxFontSizeMultiplier={1.2}
              style={[theme.type.body, { color: homeGlassColors.textFaint, flex: 1, minWidth: 0 }]}
            >
              {t('shareJourney')}
            </Text>
            <Icon name="image" size={21} color={homeGlassColors.textFaint} strokeWidth={1.9} />
          </Pressable>

          {/* Scrolls rather than squeezes. Four fixed quarter-width cells
              clipped "Tiến trình" and "Bài tập" to "Tiến tr…" (owner,
              2026-10-26); letting them wrap instead costs a second line on
              a narrow phone. Sized to their own words, they fit on a large
              screen and can be nudged on a small one. */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.composerChips}
          >
            {COMPOSER_CHIPS.map((chip) => (
              <Pressable
                // By label, not by type: "Ảnh" and "Video" deliberately open
                // the same `image` composer (there is no separate video post
                // type), so keying on `type` gave two children the key
                // `.$image` and React warned on every render of the feed.
                key={chip.label}
                accessibilityRole="button"
                onPress={() => router.push({ pathname: '/community/create', params: { type: chip.type } })}
                style={({ pressed }) => [
                  styles.composerChip,
                  { backgroundColor: homeGlassColors.surfaceRaised },
                  pressed ? { opacity: 0.6 } : null,
                ]}
              >
                <Icon name={chip.icon} size={16} color={chip.color} strokeWidth={2.2} />
                <Text style={[theme.type.captionSm, styles.composerChipLabel, { color: homeGlassColors.text }]}>
                  {t(chip.label)}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      )}

      {/* The Tất cả / Từ TheraHOME chips were removed (owner, 2026-10-25):
          an official post is a post like any other now, and both used to
          show the same feed anyway. */}


      {postsQuery.isError ? (
        <View style={[styles.feedNotice, { backgroundColor: homeGlassColors.surfaceRaised }]}>
          <Icon name="activity" size={20} color={homeGlassColors.dotMissed} />
          <View style={styles.feedNoticeText}>
            <Text style={[theme.type.bodyStrong, { color: homeGlassColors.text }]}>{t('feedErrorTitle')}</Text>
            <Text style={[theme.type.caption, { color: homeGlassColors.textMuted }]}>{t('feedErrorBody')}</Text>
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel={t('a11yReloadFeed')} onPress={() => void refreshFeed()} style={styles.retryButton} hitSlop={8}>
            <Icon name="rotate-ccw" size={19} color={homeGlassColors.purpleStrong} />
          </Pressable>
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
      // Plain View on purpose. This is a VIRTUALIZED list (initialNumToRender
      // 3, windowSize 5): a Reanimated `entering` on each cell re-runs as
      // cells recycle, and on release builds (TestFlight 2026-09-05) that
      // left a screen-tall blank gap before the first post and drew the
      // "caught up" footer over a post image. Store/Roadmap keep their
      // entrance because they map inside a ScrollView, not a FlatList.
      <View style={styles.postGap}>
      <Pressable
        onPress={() => router.push({ pathname: '/community/[postId]', params: { postId: p.id } })}
        style={[
          styles.postCard,
          {
            backgroundColor: homeGlassColors.surface,
            borderColor: homeGlassColors.hairline,
          },
        ]}
      >
        <View style={styles.postHeader}>
          <Pressable disabled={!p.isOfficial && !p.authorId} onPress={() => router.push({ pathname: '/community/profile/[userId]', params: { userId: p.isOfficial ? 'official' : (p.authorId ?? '') } })} style={styles.authorTapArea}>
            <CommunityAvatar name={p.authorName} authorId={p.authorId} avatarUrl={p.authorAvatarUrl} size={44} isOfficial={p.isOfficial} />
            {/* Name on its own line, the timestamp under it — the
                reference's two-line header (owner, 2026-10-25). */}
            <View style={{ flex: 1, minWidth: 0, gap: 1 }}>
              <View style={styles.authorNameRow}>
                <Text numberOfLines={1} style={[styles.authorName, { color: homeGlassColors.text }]}>
                  {p.authorName}
                </Text>
                {p.isOfficial ? <View style={[styles.verifiedBadge, { backgroundColor: homeGlassColors.purpleStrong }]}><Icon name="check" size={11} color="#fff" strokeWidth={3} /></View> : null}
              </View>
              <Text style={[theme.type.caption, { color: homeGlassColors.textFaint }]}>{timeAgo(p.createdAt, t)}</Text>
            </View>
          </Pressable>
          <Pressable onPress={(event) => setMenuTarget({ post: p, x: event.nativeEvent.pageX, y: event.nativeEvent.pageY })} hitSlop={8}>
            <Icon name="more-horizontal" size={18} color={homeGlassColors.textFaint} />
          </Pressable>
        </View>

        {p.status !== 'approved' ? (
          // RLS only ever returns a non-approved row to its own author (or
          // staff) — so this banner is effectively "your own post's state".
          <View
            style={[
              styles.moderationBanner,
              { backgroundColor: p.status === 'pending' ? homeGlassColors.surfaceRaised : homeGlassColors.surfaceRaised },
            ]}
          >
            <Icon name={p.status === 'pending' ? 'clock' : 'eye-off'} size={13} color={p.status === 'pending' ? homeGlassColors.badge : homeGlassColors.dotMissed} />
            <Text style={[theme.type.captionSm, { color: p.status === 'pending' ? homeGlassColors.badge : homeGlassColors.dotMissed, flex: 1 }]}>
              {p.status === 'pending' ? t('postPendingBadge') : t('postRejectedBadge')}
            </Text>
          </View>
        ) : null}

        {p.isOfficial && p.title ? (
          <Text numberOfLines={2} style={[theme.type.h2, { color: homeGlassColors.text, marginBottom: 6 }]}>
            {p.title}
          </Text>
        ) : null}
        <ExpandableText
          text={p.text}
          collapsedLines={3}
          style={[
            p.isOfficial ? theme.type.bodyStrong : theme.type.body,
            { color: homeGlassColors.text, lineHeight: 21 },
          ]}
        />

        <View style={styles.mediaBleed}>
        <MediaGrid uris={p.mediaUrls} feedUris={p.mediaFeedUrls} posterUris={p.mediaPosterUrls} mediaWidths={p.mediaWidths} mediaHeights={p.mediaHeights} postId={p.id} shouldAutoplay={p.id === activeFeedItemId} />
        </View>

        {p.progressSnapshot ? <ProgressShareCard postType={p.postType} snapshot={p.progressSnapshot} /> : null}

        {badge ? (
          <View style={[styles.badgePill, { backgroundColor: homeGlassColors.surfaceRaised }]}>
            <Text style={[theme.type.captionSm, { color: homeGlassColors.purple }]}>{badge}</Text>
          </View>
        ) : null}

        {p.postType === 'checkin' ? (
          // A check-in is someone saying "I showed up today". The one thing
          // to do with that is cheer it, so the post carries its own button
          // rather than making people find the heart (owner, 2026-10-26).
          // 👏 is the existing 'celebrate' reaction — no new storage.
          <Pressable
            accessibilityRole="button"
            onPress={() => { hapticConfirm(); setPostReaction.mutate({ postId: p.id, current: currentReaction, reaction: currentReaction ? null : 'celebrate' }, { onError: () => showToast(t('cannotUpdateReaction')) }); }}
            style={({ pressed }) => [
              styles.cheerBtn,
              {
                backgroundColor: currentReaction ? homeGlassColors.purpleSoft : homeGlassColors.surfaceRaised,
                borderColor: currentReaction ? homeGlassColors.purple : 'transparent',
              },
              pressed ? { opacity: 0.7 } : null,
            ]}
          >
            <Text style={styles.cheerEmoji}>👏</Text>
            <Text style={[theme.type.bodyStrong, { color: currentReaction ? homeGlassColors.purple : homeGlassColors.text }]}>
              {currentReaction ? t('cheered') : t('cheer')}
            </Text>
          </Pressable>
        ) : null}

        <PostActionBar
          currentReaction={currentReaction}
          reactionCounts={p.reactionCounts}
          likesCount={p.likesCount}
          commentsCount={p.commentsCount}
          savesCount={p.savesCount}
          saved={savedByMe}
          onQuickReact={() => { hapticConfirm(); setPostReaction.mutate({ postId: p.id, current: currentReaction, reaction: currentReaction ? null : 'heart' }, { onError: () => showToast(t('cannotUpdateReaction')) }); }}
          onReactionLongPress={({ pageX, pageY }) => setReactionPicker({ post: p, pageX, pageY, hovered: null })}
          onReactionLongPressMove={(point) =>
            setReactionPicker((active) => {
              if (active?.post.id !== p.id) return active;
              const hovered = pickerReactionAt(point, getReactionTrayFrame(active, WINDOW_WIDTH));
              return hovered === active.hovered ? active : { ...active, hovered };
            })
          }
          onReactionLongPressRelease={() => {
            const active = reactionPicker;
            if (active?.post.id !== p.id || !active.hovered) return;
            setPostReaction.mutate({ postId: p.id, current: currentReaction, reaction: active.hovered }, { onError: () => showToast(t('cannotUpdateReaction')) });
            hapticConfirm();
            setReactionPicker(null);
          }}
          onCommentPress={() => router.push({ pathname: '/community/[postId]', params: { postId: p.id } })}
          onSavePress={() => { hapticConfirm(); toggleSave.mutate({ postId: p.id, saved: savedByMe }, { onError: () => showToast(t('cannotSavePost')) }); }}
        />
        {isMilestone && p.postType !== 'checkin' ? (
          <Pressable
            onPress={() => congratulate(p)}
            disabled={!!currentReaction}
            style={[
              styles.congratsBtn,
              {
                borderWidth: currentReaction ? 0 : 1,
                borderColor: homeGlassColors.hairline,
                backgroundColor: currentReaction ? homeGlassColors.purpleStrong : 'transparent',
                borderRadius: theme.radius.full,
              },
            ]}
          >
            <Text style={[theme.type.captionSm, { color: currentReaction ? '#fff' : homeGlassColors.text }]}>
              {currentReaction ? t('congratulated') : t('congratulate')}
            </Text>
          </Pressable>
        ) : null}

      </Pressable>
      </View>
    );
  }

  return (
    // Same dark shell as Home and Lộ trình: its own sky, its own floating
    // bar, and the list fading out before that bar rather than sliding
    // under it (owner, 2026-10-25).
    <View style={[styles.root, { backgroundColor: homeGlassColors.purpleSky[2] }]}>
      <StatusBar style="light" />
      <VerticalGradient stops={FEED_STOPS} />
      <SafeAreaView edges={['top']} style={styles.root}>
      <MaskedView
        style={styles.root}
        maskElement={
          <View style={styles.root}>
            <VerticalGradient stops={maskStops} />
          </View>
        }
      >
      <Reanimated.View style={[{ flex: 1 }, focusFadeStyle]}>
      <Reanimated.View entering={FadeIn.duration(180)} exiting={FadeOut.duration(150)} style={{ flex: 1 }}>
      <FlatList
        data={filteredPosts}
        extraData={listExtraData}
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
            tintColor={homeGlassColors.purpleStrong}
          />
        }
        ListHeaderComponent={listHeader}
        ListEmptyComponent={postsQuery.isError ? null : (
          <View style={[styles.emptyState, { backgroundColor: homeGlassColors.surfaceRaised }]}>
            <View style={[styles.emptyIcon, { backgroundColor: homeGlassColors.surfaceRaised }]}><Icon name="users" size={25} color={homeGlassColors.purpleStrong} /></View>
            <Text style={[theme.type.bodyStrong, { color: homeGlassColors.text, textAlign: 'center' }]}>{t('noPosts')}</Text>
            {<Pressable onPress={() => router.push('/community/create')} style={[styles.emptyCta, { backgroundColor: homeGlassColors.purpleStrong }]}><Icon name="plus" size={17} color="#fff" /><Text style={[theme.type.caption, { color: '#fff', fontFamily: theme.fontFamily.semiBold }]}>{t('createFirstPost')}</Text></Pressable>}
          </View>
        )}
        ListFooterComponent={postsQuery.isFetching && !manualRefreshing ? <View style={styles.loadingMore}><ActivityIndicator color={homeGlassColors.purpleStrong} /><Text style={[theme.type.caption, { color: homeGlassColors.textFaint }]}>{t('loadingMore')}</Text></View> : filteredPosts.length ? <Text style={[theme.type.captionSm, styles.feedEnd, { color: homeGlassColors.textFaint }]}>{t('seenAllPosts')}</Text> : null}
      />
      </Reanimated.View>

      {/* The floating "+" FAB was removed (per explicit request 2026-09-04)
          — composing goes through the "Chia sẻ hành trình..." row and the
          empty-state CTA instead. */}
      </Reanimated.View>
      </MaskedView>
      </SafeAreaView>

      <HomeGlassNav
        active="community"
        onNavigate={(route) => router.navigate(route as '/community')}
        trailing={<HomeMascot cue={null} mood="default" isStaff={false} />}
      />

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
            {/* Opaque, with a real shadow: on the translucent `surface` the
                post's own text read straight through the menu (owner's
                screenshot, 2026-10-25). */}
            <View style={[styles.menu, { backgroundColor: homeGlassColors.menu, borderColor: homeGlassColors.hairline }]}>
              <Pressable onPress={() => handleMenuAction(menuTarget.post, 'save')} style={styles.menuItem}><Icon name="bookmark" size={15} color={homeGlassColors.textMuted} /><Text style={[theme.type.caption, { color: homeGlassColors.text, fontFamily: theme.fontFamily.semiBold }]}>{savedSet.has(menuTarget.post.id) ? t('unsave') : t('savePost')}</Text></Pressable>
              <Pressable onPress={() => handleMenuAction(menuTarget.post, 'hide')} style={[styles.menuItem, { borderTopWidth: 1, borderTopColor: homeGlassColors.hairline }]}><Icon name="eye" size={15} color={homeGlassColors.textMuted} /><Text style={[theme.type.caption, { color: homeGlassColors.text, fontFamily: theme.fontFamily.semiBold }]}>{t('hidePost')}</Text></Pressable>
              {menuTarget.post.authorId === userId ? <Pressable onPress={() => handleMenuAction(menuTarget.post, 'delete')} style={[styles.menuItem, { borderTopWidth: 1, borderTopColor: homeGlassColors.hairline }]}><Icon name="trash-2" size={15} color={homeGlassColors.dotMissed} /><Text style={[theme.type.caption, { color: homeGlassColors.dotMissed, fontFamily: theme.fontFamily.semiBold }]}>{t('deletePost')}</Text></Pressable> : <>
                <Pressable onPress={() => handleMenuAction(menuTarget.post, 'report')} style={[styles.menuItem, { borderTopWidth: 1, borderTopColor: homeGlassColors.hairline }]}><Icon name="flag" size={15} color={homeGlassColors.dotMissed} /><Text style={[theme.type.caption, { color: homeGlassColors.dotMissed, fontFamily: theme.fontFamily.semiBold }]}>{t('reportPost')}</Text></Pressable>
                {!menuTarget.post.isOfficial && menuTarget.post.authorId ? <Pressable onPress={() => handleMenuAction(menuTarget.post, 'block')} style={[styles.menuItem, { borderTopWidth: 1, borderTopColor: homeGlassColors.hairline }]}><Icon name="user-x" size={15} color={homeGlassColors.dotMissed} /><Text style={[theme.type.caption, { color: homeGlassColors.dotMissed, fontFamily: theme.fontFamily.semiBold }]}>{t('blockUser')}</Text></Pressable> : null}
              </>}
            </View>
          </View> : null}
        </Pressable>
      </Modal>

      <CheckInSheet
        visible={checkInOpen}
        existing={checkInQuery.data?.checkIn ?? null}
        dayNumber={checkInQuery.data?.dayNumber ?? null}
        submitting={submitCheckIn.isPending}
        error={checkInError}
        onClose={() => setCheckInOpen(false)}
        onSubmit={(mood: CheckInMood, share: boolean) => {
          setCheckInError(null);
          submitCheckIn.mutate(
            { mood, share },
            {
              onSuccess: () => {
                setCheckInOpen(false);
                showToast(t('checkedInToday'));
              },
              onError: () => setCheckInError(t('checkInFailed')),
            },
          );
        }}
      />

      <MemberStreakSheet
        member={streakMember}
        onClose={() => setStreakMember(null)}
        onOpenProfile={(memberId) => {
          setStreakMember(null);
          router.push({ pathname: '/community/profile/[userId]', params: { userId: memberId } });
        }}
      />

      <Modal visible={!!reportTarget} transparent animationType="fade" onRequestClose={() => setReportTarget(null)}>
        <Pressable style={[styles.reportBackdrop, { paddingBottom: 28 + insets.bottom }]} onPress={() => setReportTarget(null)}>
          <Pressable style={[styles.reportSheet, { backgroundColor: homeGlassColors.menu, borderRadius: 20, borderWidth: 1, borderColor: homeGlassColors.hairline }]}>
            <Text style={[theme.type.bodyStrong, { color: homeGlassColors.text, marginBottom: 4 }]}>{t('reportPost')}</Text>
            <Text style={[theme.type.caption, { color: homeGlassColors.textMuted, marginBottom: 14 }]}>{t('chooseReportReason')}</Text>
            {reportReasons.map((r) => (
              <Pressable key={r.key} onPress={() => submitReport(r.key)} style={[styles.reportOption, { borderTopColor: homeGlassColors.hairline }]}>
                <Text style={[theme.type.body, { color: homeGlassColors.text }]}>{r.label}</Text>
              </Pressable>
            ))}
            <Pressable onPress={() => setReportTarget(null)} style={styles.reportCancel}>
              <Text style={[theme.type.bodyStrong, { color: homeGlassColors.textFaint }]}>{t('cancel')}</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      {toast ? (
        <View style={[styles.toast, { backgroundColor: homeGlassColors.menu, borderRadius: theme.radius.md }]}>
          {/* An opaque dark pill with white text. It used to be the inverse —
              a white pill whose text was `surface`, a 38% navy that lands on
              white at about 2.2:1 and could not be read (QA pass,
              2026-10-30). Every error this tab reports goes through here. */}
          <Text style={[theme.type.caption, { color: homeGlassColors.text, textAlign: 'center' }]}>{toast}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  authorNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  authorName: {
    fontSize: 16,
    lineHeight: 21,
    letterSpacing: -0.2,
    fontWeight: '700',
  },
  // Cancels the card's own padding so a photo runs edge to edge inside it.
  mediaBleed: {
    marginHorizontal: -14,
    marginTop: 10,
  },
  screenTitle: {
    fontSize: 30,
    lineHeight: 36,
    letterSpacing: -0.6,
  },
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
    paddingHorizontal: 14,
    // Clears the floating bar, which this screen now carries.
    paddingBottom: 150,
  },
  feedNotice: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, marginTop: 14, borderRadius: 14 },
  feedNoticeText: { flex: 1, minWidth: 0, gap: 2 },
  retryButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  emptyState: { marginTop: 28, padding: 24, borderRadius: 18, alignItems: 'center', gap: 10 },
  emptyIcon: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  emptyCta: { minHeight: 44, marginTop: 4, paddingHorizontal: 18, borderRadius: 22, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  loadingMore: { paddingVertical: 20, alignItems: 'center', justifyContent: 'center', gap: 8 },
  feedEnd: { textAlign: 'center', paddingVertical: 22 },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 12,
  },
  titleActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // A solid disc reads bigger than an outlined one of the same size, so the
  // compose button is drawn a little smaller to LOOK equal to the bell
  // (owner, 2026-10-26).
  headerButtonSolid: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  // Half outside the circle, like Home's — so the button must NOT clip.
  headerBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    paddingHorizontal: 5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerBadgeCount: {
    color: '#FFFFFF',
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '700',
  },
  // A card, not a pill: the owner's reference puts the composer in the same
  // shape as the posts under it, with the image button on its right.
  composer: {
    marginTop: 16,
    // The feed's cards are separated by 12 (`postGap`); the composer is a
    // card like them and was the only one touching its neighbour (owner's
    // screenshot, 2026-10-26).
    marginBottom: 12,
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 12,
  },
  composerPrompt: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  // Each chip hugs its own label; the row itself scrolls. See the markup.
  composerChips: {
    flexDirection: 'row',
    gap: 8,
    paddingRight: 2,
  },
  composerChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderRadius: 12,
  },
  composerChipLabel: {
    fontWeight: '600',
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
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingTop: 14,
    // Not 14: the action row underneath it is 44pt tall around 21pt icons,
    // so it brings ~11pt of its own padding and the card was spending the
    // screen on empty space below every post (owner, 2026-10-26).
    paddingBottom: 6,
    overflow: 'hidden',
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
  cheerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minHeight: 46,
    borderRadius: 16,
    borderWidth: 1.5,
    marginTop: 12,
  },
  cheerEmoji: {
    fontSize: 19,
    lineHeight: 23,
  },
  congratsBtn: {
    alignSelf: 'flex-end',
    marginTop: 6,
    paddingVertical: 7,
    paddingHorizontal: 14,
  },
  menuBackdrop: {
    flex: 1,
    // Was 0.08 — effectively no scrim, so the anchored menu had no separation
    // from a dark page in dark mode (owner report 2026-09-12).
    backgroundColor: 'rgba(20, 24, 34, 0.30)',
  },
  menuAnchor: {
    position: 'absolute',
  },
  menu: {
    borderRadius: 16,
    borderWidth: 1,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.55,
    shadowRadius: 20,
    elevation: 12,
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
    // Scrim (same value as DeleteAccountModal). Without it the sheet relied on
    // shadows.card alone, which is invisible on a dark background — in dark
    // mode the popup blended into the page (owner report 2026-09-12).
    backgroundColor: 'rgba(20, 24, 34, 0.45)',
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
