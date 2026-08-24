import React, { useEffect, useRef } from 'react';
import { ActivityIndicator, Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import * as Notifications from 'expo-notifications';
import Reanimated from 'react-native-reanimated';
import { useQueryClient } from '@tanstack/react-query';
import { useTheme } from '@/theme';
import { useTabFocusFade } from '@/hooks/useTabFocusFade';
import { usePopOnChange } from '@/hooks/usePopOnChange';
import { TransitionText } from '@/components/motion/TransitionText';
import { fadeUpEntering } from '@/lib/motion';
import { introVideo } from '@/lib/mockData';
import { useAppStore } from '@/store/useAppStore';
import { useSession } from '@/hooks/useSession';
import { useActivatedPrograms, usePainLogs, useProducts, useProgramDays } from '@/hooks/usePrograms';
import { useWaterLog, useSetWaterLog } from '@/hooks/useWaterLog';
import { useRequestDay } from '@/hooks/useRequestDay';
import { useProfile } from '@/hooks/useProfile';
import { useNotifications } from '@/hooks/useNotifications';
import { useCommunityPosts, pinnedDisplay } from '@/hooks/useCommunity';
import { prefetchStoreCategories } from '@/hooks/useStore';
import { ArticleCard } from '@/components/community/ArticleCard';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { Icon } from '@/components/icons/Icon';
import { AvatarImg } from '@/components/AvatarImg';
import { ProductDropdown } from '@/components/ProductDropdown';
import { PainChart } from '@/components/PainChart';
import { WaterCard } from '@/components/WaterCard';
import { PainScaleModal } from '@/components/PainScaleModal';
import { useI18n } from '@/lib/i18n';

const WATER_GOAL_CUPS = 8;

export default function HomeScreen() {
  const theme = useTheme();
  const { t } = useI18n();
  const scrollY = useRef(new Animated.Value(0)).current;
  const { session } = useSession();
  const userId = session?.user.id;
  const selectedProductId = useAppStore((s) => s.selectedProductId);
  const selectProduct = useAppStore((s) => s.selectProduct);
  const language = useAppStore((s) => s.language);
  const profile = useProfile(userId).data;
  const notifications = useNotifications(userId).data ?? [];
  const officialPostsQuery = useCommunityPosts();
  const unreadCount = notifications.filter((n) => !n.read).length;
  useEffect(() => {
    void Notifications.setBadgeCountAsync(unreadCount).catch(() => {});
  }, [unreadCount]);
  const queryClient = useQueryClient();
  useEffect(() => {
    // Store is a lazily-mounted tab (Expo Router default) — without this,
    // both its catalog query and every product image start loading cold
    // the first time it's opened, which is what made it feel slow right
    // after launch. See CLAUDE.md / useStore.ts.
    void prefetchStoreCategories(queryClient, language).catch(() => {});
  }, [queryClient, language]);
  const focusFadeStyle = useTabFocusFade();
  const badgePopStyle = usePopOnChange(unreadCount);
  const { pendingDay, requestDay, confirmPain, cancelPain, isSubmitting } = useRequestDay();
  const productsQuery = useProducts();
  const programsQuery = useActivatedPrograms(userId);
  const activatedPrograms = programsQuery.data ?? [];
  const program = activatedPrograms.find((p) => p.productId === selectedProductId) ?? activatedPrograms[0];
  const catalogProducts = productsQuery.data ?? [];
  const effectiveChartProductId = program?.productId;
  const chartProduct =
    catalogProducts.find((p) => p.id === effectiveChartProductId) ?? program?.product;
  const chartProgram = activatedPrograms.find((p) => p.productId === effectiveChartProductId);
  const officialPosts = (officialPostsQuery.data ?? []).filter((post) => post.isOfficial);
  const pinnedOfficialPost = officialPosts.find((post) => post.pinned);
  // Only the currently-pinned post — matches Community's pinned slot
  // exactly instead of also surfacing a separate "newest" card that could
  // show a different post than what's actually pinned. Falls back to the
  // newest official post only when nothing is pinned yet, so the section
  // isn't empty before staff have curated anything.
  const homeOfficialPost = pinnedOfficialPost ?? officialPosts[0];
  const homeOfficialDisplay = homeOfficialPost ? pinnedDisplay(homeOfficialPost) : null;

  const daysQuery = useProgramDays(program?.userProgramId, program?.productId);
  const painLogsQuery = usePainLogs(chartProgram?.userProgramId);
  const waterQuery = useWaterLog(userId);
  const setWaterMutation = useSetWaterLog(userId);

  const isLoading = productsQuery.isPending || programsQuery.isPending || (!!program && daysQuery.isPending);
  if (isLoading) {
    return (
      <ScreenContainer edges={['top']}>
        <View style={styles.loadingBox}>
          <ActivityIndicator color={theme.colors.primary} />
        </View>
      </ScreenContainer>
    );
  }
  if (!program || !chartProduct) return null; // guarded by the root layout's activation gate

  const days = daysQuery.data ?? [];
  const today = days.find((d) => d.status === 'current') ?? days[days.length - 1];
  if (!today) return null;

  const chartData = painLogsQuery.data ?? [];
  const water = waterQuery.data ?? 0;
  const fullName = profile?.fullName?.trim();
  const greetingName = fullName ? fullName.split(/\s+/).at(-1) : t('you');
  const softParallax = (distance: number) => ({
    opacity: scrollY.interpolate({ inputRange: [0, 300], outputRange: [1, 0.97], extrapolate: 'clamp' }),
    transform: [{ translateY: scrollY.interpolate({ inputRange: [0, 300], outputRange: [0, -distance], extrapolate: 'clamp' }) }],
  });

  return (
    <ScreenContainer edges={['top']}>
      <Reanimated.View style={[{ flex: 1 }, focusFadeStyle]}>
      <Animated.ScrollView
        contentContainerStyle={styles.scrollBody}
        scrollEventThrottle={16}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: true })}
      >
        <View style={styles.headerRow}>
          <Text
            numberOfLines={1}
            ellipsizeMode="tail"
            style={[theme.type.display, styles.greeting, { color: theme.colors.textPrimary }]}
          >
            {t('hello')}, {greetingName}
          </Text>
          <View style={styles.headerActions}>
            <Pressable
              onPress={() => router.push('/notifications')}
              style={[styles.iconBtn, { backgroundColor: theme.colors.bgCardAlt }]}
            >
              <Icon name="bell" size={18} color={theme.colors.textPrimary} />
              {unreadCount > 0 ? (
                <Reanimated.View style={[styles.badgeCount, { backgroundColor: theme.colors.error, borderColor: theme.colors.bgCardAlt }, badgePopStyle]}>
                  <TransitionText value={unreadCount > 99 ? '99+' : String(unreadCount)} style={styles.badgeCountText} />
                </Reanimated.View>
              ) : null}
            </Pressable>
            <Pressable onPress={() => router.push('/profile')}>
              <AvatarImg size={44} uri={profile?.avatarUrl} />
            </Pressable>
          </View>
        </View>

        <Animated.View style={[{ marginTop: 12 }, softParallax(3)]}>
          <ProductDropdown
            product={chartProduct}
            products={catalogProducts}
            onSelect={selectProduct}
          />
          <View style={{ marginTop: 8 }}>
            <PainChart data={chartData} />
          </View>
        </Animated.View>

        <Reanimated.View entering={fadeUpEntering(0)}>
        <Animated.View style={[styles.heroCard, softParallax(7), { backgroundColor: theme.colors.primary, borderRadius: theme.radius.xl, padding: theme.space[5] }]}>
          <Text style={[theme.type.caption, { color: '#fff', opacity: 0.85 }]}>
            {t('programDuration', { count: program.product.totalDays })} · {program.product.name}
          </Text>
          <TransitionText
            value={`${t('todayIs')} ${today.id} — ${today.phase}`}
            style={[theme.type.h1, { color: '#fff', marginVertical: 4, marginBottom: 14 }]}
          />
          <View style={styles.heroActions}>
            <Pressable
              style={[styles.heroBtnOutline, { borderColor: 'rgba(255,255,255,0.5)', borderRadius: theme.radius.md }]}
              onPress={() => WebBrowser.openBrowserAsync(introVideo)}
            >
              <Text style={[theme.type.bodyStrong, { color: '#fff' }]}>{t('quickGuide')}</Text>
            </Pressable>
            <Pressable
              style={[styles.heroBtnFilled, { backgroundColor: '#fff', borderRadius: theme.radius.md }]}
              onPress={() => requestDay(today, program.userProgramId, program.productId)}
            >
              <Text style={[theme.type.bodyStrong, { color: theme.colors.primary }]}>{t('startToday')}</Text>
            </Pressable>
          </View>
        </Animated.View>
        </Reanimated.View>

        <Reanimated.View entering={fadeUpEntering(80)}>
        <Animated.View style={[{ marginTop: 16 }, softParallax(10)]}>
          <WaterCard value={water} goal={WATER_GOAL_CUPS} onChange={(v) => setWaterMutation.mutate(v)} />
        </Animated.View>
        </Reanimated.View>

        <Reanimated.View entering={fadeUpEntering(140)}>
        <Animated.View style={softParallax(13)}>
        <Pressable
          onPress={() => router.push('/roadmap')}
          style={[styles.sectionCard, theme.shadows.card, { backgroundColor: theme.colors.bgCard, borderRadius: theme.radius.lg, padding: theme.cardPadding }]}
        >
          <View style={styles.sectionHeader}>
            <Text style={[theme.type.h2, { color: theme.colors.textPrimary }]}>{t('recoveryRoadmap')}</Text>
            <Text style={[theme.type.caption, { color: theme.colors.primary, fontFamily: theme.fontFamily.semiBold }]}>
              {t('seeAll')}
            </Text>
          </View>
          <View style={styles.dotsRow}>
            {days.map((d) => (
              <View
                key={d.id}
                style={[
                  styles.smallDot,
                  {
                    backgroundColor:
                      d.status === 'locked'
                        ? theme.colors.borderLight
                        : d.status === 'current'
                          ? theme.colors.primary
                          : theme.colors.success,
                  },
                ]}
              />
            ))}
          </View>
        </Pressable>
        </Animated.View>
        </Reanimated.View>

        <Reanimated.View entering={fadeUpEntering(200)} style={{ marginTop: 16 }}>
        <View style={styles.sectionHeader}>
          <Text style={[theme.type.h2, { color: theme.colors.textPrimary }]}>{t('articlesFrom')}</Text>
          <Pressable onPress={() => router.push({ pathname: '/community', params: { filter: 'official', content: 'blog' } })}>
            <Text style={[theme.type.caption, { color: theme.colors.primary, fontFamily: theme.fontFamily.semiBold }]}>
              {t('seeAll')}
            </Text>
          </Pressable>
        </View>
        <View style={{ gap: 12 }}>
          {homeOfficialPost ? (
            <ArticleCard
              title={homeOfficialDisplay!.title}
              description={homeOfficialDisplay!.content}
              thumbnailUrl={homeOfficialDisplay!.thumbnailUrl}
              createdAt={homeOfficialPost.createdAt}
              onPress={() => router.push({ pathname: '/community/[postId]', params: { postId: homeOfficialPost.id } })}
            />
          ) : (
            <Text style={[theme.type.caption, { color: theme.colors.textMuted, paddingVertical: 8 }]}>Chưa có gợi ý nào từ TheraHOME.</Text>
          )}
        </View>
        </Reanimated.View>
      </Animated.ScrollView>
      </Reanimated.View>

      {pendingDay !== null ? (
        <PainScaleModal dayId={pendingDay} onCancel={cancelPain} onConfirm={confirmPain} submitting={isSubmitting} />
      ) : null}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  scrollBody: {
    paddingHorizontal: 20,
    paddingBottom: 140,
  },
  loadingBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 12,
    paddingBottom: 4,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flexShrink: 0,
  },
  greeting: {
    flex: 1,
    minWidth: 0,
    marginRight: 12,
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeCount: {
    position: 'absolute',
    top: -4,
    right: -7,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    borderRadius: 9,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeCountText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
  },
  heroCard: {
    marginTop: 20,
  },
  heroActions: {
    flexDirection: 'row',
    gap: 8,
  },
  heroBtnOutline: {
    flex: 1,
    borderWidth: 1,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroBtnFilled: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionCard: {
    marginTop: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  dotsRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  smallDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
});
