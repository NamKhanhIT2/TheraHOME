import React, { useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useTheme, homeGlassColors } from '@/theme';
import { useSession } from '@/hooks/useSession';
import { useActivatedPrograms } from '@/hooks/usePrograms';
import { useAuthorPosts, useCommunityProfile, useSavedPosts } from '@/hooks/useCommunity';
import { CommunityAvatar } from '@/components/CommunityAvatar';
import { ProgressShareCard } from '@/components/ProgressShareCard';
import { MediaGrid } from '@/components/community/MediaGrid';
import { ExpandableText } from '@/components/community/ExpandableText';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { BackBar } from '@/components/ui/BackBar';
import { Icon } from '@/components/icons/Icon';
import { getOfficialArticles } from '@/lib/officialArticles';
import { timeAgo } from '@/lib/timeAgo';
import { useI18n } from '@/lib/i18n';

type ProfileTab = 'posts' | 'saved' | 'achievements' | 'journey';

export default function CommunityProfileScreen() {
  const theme = useTheme();
  const { t, language } = useI18n();
  const officialArticles = getOfficialArticles(language);
  const { session } = useSession();
  const { userId } = useLocalSearchParams<{ userId: string }>();
  const official = userId === 'official';
  const ownProfile = !official && userId === session?.user.id;
  const profileQuery = useCommunityProfile(official ? undefined : userId);
  const postsQuery = useAuthorPosts(official ? undefined : userId, official);
  const savedPostsQuery = useSavedPosts(ownProfile ? userId : undefined);
  const programsQuery = useActivatedPrograms(ownProfile ? userId : undefined);
  const [tab, setTab] = useState<ProfileTab>('posts');
  const [refreshing, setRefreshing] = useState(false);

  const profile = profileQuery.data;
  const posts = postsQuery.data ?? [];
  const savedPosts = ownProfile ? (savedPostsQuery.data ?? []) : [];
  const journeyPosts = posts.filter((post) => post.progressSnapshot || post.dayMilestone || post.phaseMilestone);
  const programs = programsQuery.data ?? [];
  const achievements = [
    { id: 'day-7', icon: '🔥', title: t('sevenDayStreak'), detail: t('sevenDayDetail'), unlocked: programs.some((program) => program.streak >= 7) },
    { id: 'day-14', icon: '⚡', title: t('fourteenDayStreak'), detail: t('fourteenDayDetail'), unlocked: programs.some((program) => program.streak >= 14) },
    { id: 'first-program', icon: '🏆', title: t('firstRoadmap'), detail: t('firstRoadmapDetail'), unlocked: programs.some((program) => program.adherencePct >= 100) },
  ];

  if ((!official && profileQuery.isPending) || postsQuery.isPending) {
    return <ScreenContainer tone="violet"><BackBar tone="violet" onBack={() => router.back()} title={t('communityProfile')} /><View style={styles.loading}><ActivityIndicator color={homeGlassColors.purpleStrong} /></View></ScreenContainer>;
  }
  // A failed request used to render as "Chưa có nội dung" — indistinguishable
  // from an empty profile, with no way to retry.
  if (profileQuery.isError || postsQuery.isError) {
    return (
      <ScreenContainer tone="violet">
        <BackBar tone="violet" onBack={() => router.back()} title={t('communityProfile')} />
        <View style={styles.loading}>
          <Text style={[theme.type.bodyStrong, { color: homeGlassColors.text, textAlign: 'center' }]}>{t('homeLoadErrorTitle')}</Text>
          <Text style={[theme.type.caption, { color: homeGlassColors.textMuted, textAlign: 'center', marginTop: 6 }]}>{t('checkNetworkRetry')}</Text>
          <Pressable onPress={() => { void profileQuery.refetch(); void postsQuery.refetch(); }} style={{ marginTop: 14 }}>
            <Text style={[theme.type.bodyStrong, { color: homeGlassColors.purpleStrong }]}>{t('retry')}</Text>
          </Pressable>
        </View>
      </ScreenContainer>
    );
  }
  if (!official && !profile) {
    return <ScreenContainer tone="violet"><BackBar tone="violet" onBack={() => router.back()} title={t('communityProfile')} /><View style={styles.loading}><Text style={{ color: homeGlassColors.textFaint }}>{t('profileNotFound')}</Text></View></ScreenContainer>;
  }

  const name = official ? 'TheraHOME' : profile!.fullName;
  const avatarUrl = official ? null : profile!.avatarUrl;
  const tabs: [ProfileTab, string][] = official
    ? [['posts', t('posts')], ['journey', t('knowledge')]]
    : ownProfile
      ? [['posts', t('posts')], ['saved', t('saved')], ['achievements', t('achievements')], ['journey', t('journey')]]
      : [['posts', t('posts')], ['journey', t('journey')]];
  const renderedPosts = tab === 'saved' ? savedPosts : tab === 'journey' ? journeyPosts : posts;

  return (
    <ScreenContainer tone="violet">
      <BackBar tone="violet" onBack={() => router.back()} title={official ? 'TheraHOME' : ownProfile ? t('myCommunityProfile') : t('communityProfile')} />
      <ScrollView
        contentContainerStyle={styles.body}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            tintColor={homeGlassColors.purpleStrong}
            onRefresh={async () => {
              setRefreshing(true);
              try {
                await Promise.all([profileQuery.refetch(), postsQuery.refetch(), savedPostsQuery.refetch()]);
              } finally {
                setRefreshing(false);
              }
            }}
          />
        }
      >
        <View style={[styles.profileCard, { backgroundColor: official ? homeGlassColors.surfaceRaised : homeGlassColors.surface, borderColor: official ? homeGlassColors.purpleStrong : homeGlassColors.hairline }]}> 
          <CommunityAvatar name={name} authorId={official ? null : userId} avatarUrl={avatarUrl} size={76} isOfficial={official} />
          <View style={styles.nameRow}>
            <Text style={[theme.type.h2, { color: homeGlassColors.text }]}>{name}</Text>
            {official ? <View style={[styles.verifiedBadge, { backgroundColor: homeGlassColors.purpleStrong }]}><Icon name="check" size={12} color="#fff" strokeWidth={3} /></View> : null}
          </View>
          {official ? (
            <Text style={[theme.type.caption, styles.bio, { color: homeGlassColors.textMuted }]}>{t('officialBio')}</Text>
          ) : (
            <View style={styles.stats}>
              <View style={styles.stat}><Text style={[styles.statValue, { color: homeGlassColors.text }]}>🔥 {profile!.currentStreak}</Text><Text style={[theme.type.captionSm, { color: homeGlassColors.textFaint }]}>{t('dayStreak')}</Text></View>
              <View style={[styles.stat, { borderLeftColor: homeGlassColors.hairline }]}><Text style={[styles.statValue, { color: homeGlassColors.text }]}>✓ {profile!.completedPrograms}</Text><Text style={[theme.type.captionSm, { color: homeGlassColors.textFaint }]}>{t('completedRoadmaps')}</Text></View>
              <View style={[styles.stat, { borderLeftColor: homeGlassColors.hairline }]}><Text style={[styles.statValue, { color: homeGlassColors.text }]}>📝 {profile!.postsCount}</Text><Text style={[theme.type.captionSm, { color: homeGlassColors.textFaint }]}>{t('sharedPosts')}</Text></View>
            </View>
          )}
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs}>
          {tabs.map(([key, label]) => (
            <Pressable key={key} onPress={() => setTab(key)} style={[styles.tab, { borderColor: tab === key ? homeGlassColors.purpleStrong : homeGlassColors.hairline, backgroundColor: tab === key ? homeGlassColors.surfaceRaised : homeGlassColors.surface }]}>
              <Text style={[theme.type.caption, { color: tab === key ? homeGlassColors.purpleStrong : homeGlassColors.textMuted, fontFamily: theme.fontFamily.semiBold }]}>{label}</Text>
            </Pressable>
          ))}
        </ScrollView>

        {tab === 'achievements' && ownProfile ? (
          <View style={styles.achievementGrid}>
            {achievements.map((achievement) => (
              <View key={achievement.id} style={[styles.achievementCard, { backgroundColor: achievement.unlocked ? homeGlassColors.surfaceRaised : homeGlassColors.surfaceRaised, borderColor: achievement.unlocked ? homeGlassColors.purpleStrong : homeGlassColors.hairline }]}> 
                <Text style={[styles.achievementIcon, { opacity: achievement.unlocked ? 1 : 0.45 }]}>{achievement.icon}</Text>
                <View style={{ flex: 1 }}><Text style={[theme.type.caption, { color: homeGlassColors.text, fontFamily: theme.fontFamily.bold }]}>{achievement.title}</Text><Text style={[theme.type.captionSm, { color: homeGlassColors.textFaint, marginTop: 2 }]}>{achievement.unlocked ? t('achieved') : achievement.detail}</Text></View>
                {achievement.unlocked ? <Icon name="check" size={17} color={homeGlassColors.purpleStrong} /> : <Icon name="lock" size={16} color={homeGlassColors.textFaint} />}
              </View>
            ))}
          </View>
        ) : official && tab === 'journey' ? officialArticles.map((article) => (
          <Pressable key={article.id} onPress={() => router.push({ pathname: '/community/article/[articleId]', params: { articleId: article.id } })} style={[styles.post, { backgroundColor: homeGlassColors.surface }]}> 
            <Text style={[theme.type.captionSm, { color: homeGlassColors.purpleStrong }]}>{article.tag}</Text>
            <Text style={[theme.type.bodyStrong, { color: homeGlassColors.text, marginTop: 4 }]}>{article.title}</Text>
            <Text style={[theme.type.caption, { color: homeGlassColors.textMuted, marginTop: 4 }]}>{article.summary}</Text>
            <Text style={[theme.type.captionSm, { color: homeGlassColors.purpleStrong, marginTop: 8 }]}>{t('readMore')}</Text>
          </Pressable>
        )) : tab === 'journey' && ownProfile ? (
          <View style={{ gap: 10 }}>
            {programs.map((program) => (
              <Pressable key={program.userProgramId} onPress={() => router.push('/roadmap')} style={[styles.journeyCard, { backgroundColor: homeGlassColors.surface, borderColor: homeGlassColors.hairline }]}> 
                <View style={[styles.journeyIcon, { backgroundColor: homeGlassColors.surfaceRaised }]}><Icon name="dumbbell" size={18} color={homeGlassColors.purpleStrong} /></View>
                <View style={{ flex: 1 }}><Text style={[theme.type.bodyStrong, { color: homeGlassColors.text }]}>{program.product.name}</Text><Text style={[theme.type.caption, { color: homeGlassColors.textMuted, marginTop: 2 }]}>{t('journeyProgress', { current: program.currentDay, total: program.product.totalDays, streak: program.streak })}</Text><View style={[styles.progressTrack, { backgroundColor: homeGlassColors.surfaceRaised }]}><View style={[styles.progressFill, { backgroundColor: homeGlassColors.purpleStrong, width: `${Math.min(100, program.adherencePct)}%` }]} /></View></View>
                <Icon name="chevron-right" size={18} color={homeGlassColors.textFaint} />
              </Pressable>
            ))}
            {programs.length === 0 ? <EmptyState label={t('noJourneys')} theme={theme} /> : null}
          </View>
        ) : (
          <View style={{ gap: 10 }}>
            {renderedPosts.map((post) => (
              <Pressable key={post.id} onPress={() => router.push({ pathname: '/community/[postId]', params: { postId: post.id } })} style={[styles.post, { backgroundColor: homeGlassColors.surface }]}> 
                <View style={styles.postAuthor}>
                  <CommunityAvatar name={post.authorName} authorId={post.authorId} avatarUrl={post.authorAvatarUrl} size={34} isOfficial={post.isOfficial} />
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                      <Text style={[theme.type.caption, { color: homeGlassColors.text, fontFamily: theme.fontFamily.bold }]}>{post.authorName}</Text>
                      {post.isOfficial ? <View style={[styles.smallVerifiedBadge, { backgroundColor: homeGlassColors.purpleStrong }]}><Icon name="check" size={10} color="#fff" strokeWidth={3} /></View> : null}
                    </View>
                    <Text style={[theme.type.captionSm, { color: homeGlassColors.textFaint }]}>{timeAgo(post.createdAt, t)}</Text>
                  </View>
                </View>
                <ExpandableText
                  text={post.text}
                  collapsedLines={3}
                  style={[theme.type.body, { color: homeGlassColors.text, marginTop: 10 }]}
                />
                <MediaGrid uris={post.mediaUrls} feedUris={post.mediaThumbnailUrls} posterUris={post.mediaPosterUrls} mediaWidths={post.mediaWidths} mediaHeights={post.mediaHeights} postId={post.id} shouldAutoplay={false} />
                {post.progressSnapshot ? <ProgressShareCard postType={post.postType} snapshot={post.progressSnapshot} /> : null}
                <Text style={[theme.type.captionSm, { color: homeGlassColors.textFaint, marginTop: 8 }]}>{post.likesCount} {t('reactions')} · {post.commentsCount} {t('comments')}</Text>
              </Pressable>
            ))}
            {renderedPosts.length === 0 ? <EmptyState label={tab === 'saved' ? t('noSavedPosts') : t('noContent')} theme={theme} /> : null}
          </View>
        )}
      </ScrollView>
    </ScreenContainer>
  );
}

function EmptyState({ label, theme }: { label: string; theme: ReturnType<typeof useTheme> }) {
  return <View style={[styles.empty, { backgroundColor: homeGlassColors.surfaceRaised }]}><Icon name="bookmark" size={22} color={homeGlassColors.textFaint} /><Text style={[theme.type.caption, { color: homeGlassColors.textFaint }]}>{label}</Text></View>;
}

const styles = StyleSheet.create({
  body: { padding: 20, paddingBottom: 44 },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  profileCard: { alignItems: 'center', borderWidth: 1, borderRadius: 22, padding: 22 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 12 },
  verifiedBadge: { width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  bio: { textAlign: 'center', marginTop: 8, lineHeight: 20 },
  stats: { flexDirection: 'row', width: '100%', marginTop: 18 },
  stat: { flex: 1, alignItems: 'center', gap: 2, borderLeftWidth: 1 },
  statValue: { fontSize: 15, fontWeight: '800' },
  tabs: { gap: 8, paddingVertical: 18, paddingRight: 20 },
  tab: { borderWidth: 1, borderRadius: 999, paddingVertical: 9, paddingHorizontal: 14 },
  post: { borderRadius: 16, padding: 15 },
  postAuthor: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  smallVerifiedBadge: { width: 16, height: 16, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  achievementGrid: { gap: 10 },
  achievementCard: { minHeight: 76, borderWidth: 1, borderRadius: 16, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 11 },
  achievementIcon: { fontSize: 27 },
  journeyCard: { borderWidth: 1, borderRadius: 16, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 11 },
  journeyIcon: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  progressTrack: { height: 5, borderRadius: 3, overflow: 'hidden', marginTop: 9 },
  progressFill: { height: '100%', borderRadius: 3 },
  empty: { borderRadius: 16, padding: 24, alignItems: 'center', gap: 8 },
});
