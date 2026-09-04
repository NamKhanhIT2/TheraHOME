import React, { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useTheme } from '@/theme';
import { useSession } from '@/hooks/useSession';
import { useActivatedPrograms, usePrimaryProducts } from '@/hooks/usePrograms';
import { useCommunityPosts, useCommunityProfile, useMyPostSaves } from '@/hooks/useCommunity';
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
  const postsQuery = useCommunityPosts(100);
  const savedPostsQuery = useMyPostSaves(ownProfile ? userId : undefined);
  const programsQuery = useActivatedPrograms(ownProfile ? userId : undefined);
  const primaryQuery = usePrimaryProducts();
  const [tab, setTab] = useState<ProfileTab>('posts');

  const profile = profileQuery.data;
  const allPosts = postsQuery.data ?? [];
  const posts = allPosts.filter((post) => official ? post.isOfficial : post.authorId === userId);
  const savedPosts = ownProfile ? allPosts.filter((post) => savedPostsQuery.data?.has(post.id)) : [];
  const journeyPosts = posts.filter((post) => post.progressSnapshot || post.dayMilestone || post.phaseMilestone);
  const programs = programsQuery.data ?? [];
  const achievements = [
    { id: 'day-7', icon: '🔥', title: t('sevenDayStreak'), detail: t('sevenDayDetail'), unlocked: programs.some((program) => program.streak >= 7) },
    { id: 'day-14', icon: '⚡', title: t('fourteenDayStreak'), detail: t('fourteenDayDetail'), unlocked: programs.some((program) => program.streak >= 14) },
    { id: 'first-program', icon: '🏆', title: t('firstRoadmap'), detail: t('firstRoadmapDetail'), unlocked: programs.some((program) => program.adherencePct >= 100) },
  ];

  if ((!official && profileQuery.isPending) || postsQuery.isPending) {
    return <ScreenContainer><BackBar onBack={() => router.back()} title={t('communityProfile')} /><View style={styles.loading}><ActivityIndicator color={theme.colors.primary} /></View></ScreenContainer>;
  }
  if (!official && !profile) {
    return <ScreenContainer><BackBar onBack={() => router.back()} title={t('communityProfile')} /><View style={styles.loading}><Text style={{ color: theme.colors.textMuted }}>{t('profileNotFound')}</Text></View></ScreenContainer>;
  }

  const name = official ? 'TheraHOME' : profile!.fullName;
  const avatarUrl = official ? null : profile!.avatarUrl;
  const tabs: Array<[ProfileTab, string]> = official
    ? [['posts', t('posts')], ['journey', t('knowledge')]]
    : ownProfile
      ? [['posts', t('posts')], ['saved', t('saved')], ['achievements', t('achievements')], ['journey', t('journey')]]
      : [['posts', t('posts')], ['journey', t('journey')]];
  const renderedPosts = tab === 'saved' ? savedPosts : tab === 'journey' ? journeyPosts : posts;

  return (
    <ScreenContainer>
      <BackBar onBack={() => router.back()} title={official ? 'TheraHOME' : ownProfile ? t('myCommunityProfile') : t('communityProfile')} />
      <ScrollView contentContainerStyle={styles.body}>
        <View style={[styles.profileCard, theme.shadows.card, { backgroundColor: official ? theme.colors.primaryTint10 : theme.colors.bgCard, borderColor: official ? theme.colors.primary : theme.colors.borderLight }]}> 
          <CommunityAvatar name={name} authorId={official ? null : userId} avatarUrl={avatarUrl} size={76} isOfficial={official} />
          <View style={styles.nameRow}>
            <Text style={[theme.type.h2, { color: theme.colors.textPrimary }]}>{name}</Text>
            {official ? <View style={[styles.verifiedBadge, { backgroundColor: theme.colors.primary }]}><Icon name="check" size={12} color="#fff" strokeWidth={3} /></View> : null}
          </View>
          {official ? (
            <Text style={[theme.type.caption, styles.bio, { color: theme.colors.textSecondary }]}>{t('officialBio')}</Text>
          ) : (
            <View style={styles.stats}>
              <View style={styles.stat}><Text style={styles.statValue}>🔥 {profile!.currentStreak}</Text><Text style={[theme.type.captionSm, { color: theme.colors.textMuted }]}>{t('dayStreak')}</Text></View>
              <View style={[styles.stat, { borderLeftColor: theme.colors.divider }]}><Text style={styles.statValue}>✓ {profile!.completedPrograms}</Text><Text style={[theme.type.captionSm, { color: theme.colors.textMuted }]}>{t('completedRoadmaps')}</Text></View>
              <View style={[styles.stat, { borderLeftColor: theme.colors.divider }]}><Text style={styles.statValue}>📝 {profile!.postsCount}</Text><Text style={[theme.type.captionSm, { color: theme.colors.textMuted }]}>{t('sharedPosts')}</Text></View>
            </View>
          )}
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs}>
          {tabs.map(([key, label]) => (
            <Pressable key={key} onPress={() => setTab(key)} style={[styles.tab, { borderColor: tab === key ? theme.colors.primary : theme.colors.borderInput, backgroundColor: tab === key ? theme.colors.primaryTint10 : theme.colors.bgCard }]}>
              <Text style={[theme.type.caption, { color: tab === key ? theme.colors.primary : theme.colors.textSecondary, fontFamily: theme.fontFamily.semiBold }]}>{label}</Text>
            </Pressable>
          ))}
        </ScrollView>

        {tab === 'achievements' && ownProfile ? (
          <View style={styles.achievementGrid}>
            {achievements.map((achievement) => (
              <View key={achievement.id} style={[styles.achievementCard, { backgroundColor: achievement.unlocked ? theme.colors.primaryTint10 : theme.colors.bgCardAlt, borderColor: achievement.unlocked ? theme.colors.primary : theme.colors.borderLight }]}> 
                <Text style={[styles.achievementIcon, { opacity: achievement.unlocked ? 1 : 0.45 }]}>{achievement.icon}</Text>
                <View style={{ flex: 1 }}><Text style={[theme.type.caption, { color: theme.colors.textPrimary, fontFamily: theme.fontFamily.bold }]}>{achievement.title}</Text><Text style={[theme.type.captionSm, { color: theme.colors.textMuted, marginTop: 2 }]}>{achievement.unlocked ? t('achieved') : achievement.detail}</Text></View>
                {achievement.unlocked ? <Icon name="check" size={17} color={theme.colors.primary} /> : <Icon name="lock" size={16} color={theme.colors.textMuted} />}
              </View>
            ))}
          </View>
        ) : official && tab === 'journey' ? officialArticles.map((article) => (
          <Pressable key={article.id} onPress={() => router.push({ pathname: '/community/article/[articleId]', params: { articleId: article.id } })} style={[styles.post, { backgroundColor: theme.colors.bgCard }]}> 
            <Text style={[theme.type.captionSm, { color: theme.colors.primary }]}>{article.tag}</Text>
            <Text style={[theme.type.bodyStrong, { color: theme.colors.textPrimary, marginTop: 4 }]}>{article.title}</Text>
            <Text style={[theme.type.caption, { color: theme.colors.textSecondary, marginTop: 4 }]}>{article.summary}</Text>
            <Text style={[theme.type.captionSm, { color: theme.colors.primary, marginTop: 8 }]}>{t('readMore')}</Text>
          </Pressable>
        )) : tab === 'journey' && ownProfile ? (
          <View style={{ gap: 10 }}>
            {programs.map((program) => (
              <Pressable key={program.userProgramId} onPress={() => router.push('/roadmap')} style={[styles.journeyCard, { backgroundColor: theme.colors.bgCard, borderColor: theme.colors.borderLight }]}> 
                <View style={[styles.journeyIcon, { backgroundColor: theme.colors.primaryTint10 }]}><Icon name="dumbbell" size={18} color={theme.colors.primary} /></View>
                <View style={{ flex: 1 }}><Text style={[theme.type.bodyStrong, { color: theme.colors.textPrimary }]}>{primaryQuery.data?.nameById[program.productId] ?? program.product.name}</Text><Text style={[theme.type.caption, { color: theme.colors.textSecondary, marginTop: 2 }]}>{t('journeyProgress', { current: program.currentDay, total: program.product.totalDays, streak: program.streak })}</Text><View style={[styles.progressTrack, { backgroundColor: theme.colors.bgCardAlt }]}><View style={[styles.progressFill, { backgroundColor: theme.colors.primary, width: `${Math.min(100, program.adherencePct)}%` }]} /></View></View>
                <Icon name="chevron-right" size={18} color={theme.colors.textMuted} />
              </Pressable>
            ))}
            {programs.length === 0 ? <EmptyState label={t('noJourneys')} theme={theme} /> : null}
          </View>
        ) : (
          <View style={{ gap: 10 }}>
            {renderedPosts.map((post) => (
              <Pressable key={post.id} onPress={() => router.push({ pathname: '/community/[postId]', params: { postId: post.id } })} style={[styles.post, { backgroundColor: theme.colors.bgCard }]}> 
                <View style={styles.postAuthor}>
                  <CommunityAvatar name={post.authorName} authorId={post.authorId} avatarUrl={post.authorAvatarUrl} size={34} isOfficial={post.isOfficial} />
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                      <Text style={[theme.type.caption, { color: theme.colors.textPrimary, fontFamily: theme.fontFamily.bold }]}>{post.authorName}</Text>
                      {post.isOfficial ? <View style={[styles.smallVerifiedBadge, { backgroundColor: theme.colors.primary }]}><Icon name="check" size={10} color="#fff" strokeWidth={3} /></View> : null}
                    </View>
                    <Text style={[theme.type.captionSm, { color: theme.colors.textMuted }]}>{timeAgo(post.createdAt, t)}</Text>
                  </View>
                </View>
                <ExpandableText
                  text={post.text}
                  collapsedLines={3}
                  style={[theme.type.body, { color: theme.colors.textPrimary, marginTop: 10 }]}
                />
                <MediaGrid uris={post.mediaUrls} feedUris={post.mediaThumbnailUrls} posterUris={post.mediaPosterUrls} mediaWidths={post.mediaWidths} mediaHeights={post.mediaHeights} postId={post.id} shouldAutoplay={false} />
                {post.progressSnapshot ? <ProgressShareCard postType={post.postType} snapshot={post.progressSnapshot} /> : null}
                <Text style={[theme.type.captionSm, { color: theme.colors.textMuted, marginTop: 8 }]}>{post.likesCount} {t('reactions')} · {post.commentsCount} {t('comments')}</Text>
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
  return <View style={[styles.empty, { backgroundColor: theme.colors.bgCardAlt }]}><Icon name="bookmark" size={22} color={theme.colors.textMuted} /><Text style={[theme.type.caption, { color: theme.colors.textMuted }]}>{label}</Text></View>;
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
  statValue: { fontSize: 15, fontWeight: '800', color: '#16213A' },
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
