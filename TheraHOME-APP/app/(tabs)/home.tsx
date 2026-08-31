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
import { useActivatedPrograms, useDefaultProductId, usePainLogs, useProducts, useProgramDays } from '@/hooks/usePrograms';
import { useWaterLog, useSetWaterLog } from '@/hooks/useWaterLog';
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
import { HeroProgressBar } from '@/components/HeroProgressBar';
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
  const productsQuery = useProducts();
  const programsQuery = useActivatedPrograms(userId);
  const defaultProductQuery = useDefaultProductId(userId);
  const activatedPrograms = programsQuery.data ?? [];
  // Prefer the product the user actually ordered over just "first activated
  // program" — only kicks in when they haven't explicitly picked one via
  // the dropdown yet (`selectedProductId` always wins once set).
  const program =
    activatedPrograms.find((p) => p.productId === selectedProductId) ??
    activatedPrograms.find((p) => p.productId === defaultProductQuery.data) ??
    activatedPrograms[0];
  const catalogProducts = productsQuery.data ?? [];
  // Before activation there's no program to key off of — fall back to
  // whatever's selected (or the first catalog product) so the product
  // dropdown/pain chart still have something to show while unactivated.
  const effectiveChartProductId = program?.productId ?? selectedProductId ?? catalogProducts[0]?.id;
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

  const daysQuery = useProgramDays(program?.userProgramId, program?.productId, program?.activatedAt);
  const painLogsQuery = usePainLogs(chartProgram?.userProgramId);
  const waterQuery = useWaterLog(userId);
  const setWaterMutation = useSetWaterLog(userId);

  // `programsQuery` and `daysQuery` are dependent queries. In TanStack Query
  // v5 a disabled query is still `isPending`, even though it is not fetching.
  // Using `isPending` here therefore leaves Home on an infinite spinner when
  // an upstream catalog/phases request fails. `isLoading` only stays true
  // while a request is actually in flight.
  const isLoading = productsQuery.isLoading || programsQuery.isLoading || (!!program && daysQuery.isLoading);
  const loadError = productsQuery.error ?? programsQuery.error ?? (program ? daysQuery.error : null);
  if (isLoading) {
    return (
      <ScreenContainer edges={['top']}>
        <View style={styles.loadingBox}>
          <ActivityIndicator color={theme.colors.primary} />
        </View>
      </ScreenContainer>
    );
  }
  if (loadError || !chartProduct) {
    return (
      <ScreenContainer edges={['top']}>
        <View style={styles.stateBox}>
          <View style={[styles.stateIcon, { backgroundColor: theme.colors.primaryTint10 }]}>
            <Icon name={loadError ? 'activity' : 'box'} size={24} color={theme.colors.primary} />
          </View>
          <Text style={[theme.type.h2, styles.stateTitle, { color: theme.colors.textPrimary }]}>
            {loadError ? 'Chưa thể tải dữ liệu' : 'Chưa có sản phẩm'}
          </Text>
          <Text style={[theme.type.caption, styles.stateText, { color: theme.colors.textSecondary }]}>
            {loadError
              ? 'Vui lòng kiểm tra kết nối mạng rồi thử lại.'
              : 'Danh mục sản phẩm hiện chưa có dữ liệu để hiển thị.'}
          </Text>
          <Pressable
            onPress={() => {
              void productsQuery.refetch();
              void programsQuery.refetch();
              if (program) void daysQuery.refetch();
            }}
            style={[styles.retryButton, { backgroundColor: theme.colors.primary }]}
          >
            <Text style={[theme.type.bodyStrong, { color: '#fff' }]}>Thử lại</Text>
          </Pressable>
        </View>
      </ScreenContainer>
    );
  }

  const days = daysQuery.data ?? [];
  // No activated program yet (roadmap tab is what actually gates on this —
  // see roadmap.tsx) — `today` stays null and the hero card below renders
  // an "activate to unlock" prompt instead of day/phase progress.
  const today = program ? (days.find((d) => d.id === program.currentDay) ?? days.find((d) => d.status === 'current') ?? days[days.length - 1] ?? null) : null;
  const progressPct = today ? Math.round((today.id / program!.product.totalDays) * 100) : 0;

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
          {program && today ? (
            <>
              <View style={styles.heroTopRow}>
                <TransitionText
                  value={t('dayOfTotal', { day: today.id, total: program.product.totalDays })}
                  style={[theme.type.h1, { color: '#fff' }]}
                />
                <View style={[styles.phasePill, { backgroundColor: 'rgba(255,255,255,0.16)', borderColor: 'rgba(255,255,255,0.4)' }]}>
                  <TransitionText
                    value={`${progressPct}%`}
                    style={[theme.type.captionSm, { color: '#fff', fontFamily: theme.fontFamily.semiBold }]}
                  />
                </View>
              </View>
              <TransitionText
                value={today.phase}
                style={[theme.type.bodyStrong, { color: 'rgba(255,255,255,0.88)', marginTop: 4, marginBottom: 14 }]}
              />
              <HeroProgressBar progress={progressPct / 100} />
              <View style={[styles.heroActions, { marginTop: 16 }]}>
                <Pressable
                  style={[styles.heroBtnOutline, { borderColor: 'rgba(255,255,255,0.5)', borderRadius: theme.radius.md }]}
                  onPress={() => WebBrowser.openBrowserAsync(introVideo)}
                >
                  <Text style={[theme.type.bodyStrong, { color: '#fff' }]}>{t('quickGuide')}</Text>
                </Pressable>
                <Pressable
                  style={[styles.heroBtnFilled, { backgroundColor: '#fff', borderRadius: theme.radius.md }]}
                  onPress={() => router.push({ pathname: '/day/[dayId]', params: { dayId: String(today.id), productId: program.productId } })}
                >
                  <Text style={[theme.type.bodyStrong, { color: theme.colors.primary }]}>{t('startToday')}</Text>
                </Pressable>
              </View>
            </>
          ) : (
            <>
              <Text style={[theme.type.h1, { color: '#fff' }]}>{t('unlockRoadmapTitle')}</Text>
              <Text style={[theme.type.caption, { color: 'rgba(255,255,255,0.85)', marginTop: 6, lineHeight: 19 }]}>
                {t('unlockRoadmapHint')}
              </Text>
              <Pressable
                style={[styles.heroBtnFilled, { backgroundColor: '#fff', borderRadius: theme.radius.md, marginTop: 16 }]}
                onPress={() => router.push('/activate')}
              >
                <Text style={[theme.type.bodyStrong, { color: theme.colors.primary }]}>{t('enterActivationCode')}</Text>
              </Pressable>
            </>
          )}
        </Animated.View>
        </Reanimated.View>

        <Reanimated.View entering={fadeUpEntering(80)}>
        <Animated.View style={[{ marginTop: 16 }, softParallax(10)]}>
          <WaterCard value={water} goal={WATER_GOAL_CUPS} onChange={(v) => setWaterMutation.mutate(v)} />
        </Animated.View>
        </Reanimated.View>

        {program && days.length > 0 ? (
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
                      d.status === 'done'
                        ? theme.colors.success
                        : d.status === 'current'
                          ? theme.colors.primary
                          : d.status === 'missed'
                            ? theme.colors.error
                            : theme.colors.borderLight,
                  },
                ]}
              />
            ))}
          </View>
        </Pressable>
        </Animated.View>
        </Reanimated.View>
        ) : null}

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
  stateBox: {
    flex: 1,
    paddingHorizontal: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stateIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stateTitle: {
    marginTop: 14,
    textAlign: 'center',
  },
  stateText: {
    marginTop: 6,
    lineHeight: 20,
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 18,
    minWidth: 132,
    paddingHorizontal: 22,
    paddingVertical: 12,
    borderRadius: 14,
    alignItems: 'center',
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
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  phasePill: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
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
