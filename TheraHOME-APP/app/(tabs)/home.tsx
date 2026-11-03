import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  InteractionManager,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type GestureResponderEvent,
} from 'react-native';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Notifications from 'expo-notifications';
import Reanimated, {
  Extrapolation,
  runOnJS,
  interpolate,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';
import { useQueryClient } from '@tanstack/react-query';
import { homeGlassColors, useTheme } from '@/theme';
import { useTabFocusFade } from '@/hooks/useTabFocusFade';
import { usePopOnChange } from '@/hooks/usePopOnChange';
import { TransitionText } from '@/components/motion/TransitionText';
import { useAppStore } from '@/store/useAppStore';
import { useSession } from '@/hooks/useSession';
import { useActivatedPrograms, useDefaultProductId, usePainLogs, useProducts, useProgramDays, useRoadmapProducts } from '@/hooks/usePrograms';
import { useAccessibleProgress } from '@/hooks/useAccessibleProgress';
import { useRequestDay } from '@/hooks/useRequestDay';
import { PainScaleModal } from '@/components/PainScaleModal';
import { useWaterLog, useSetWaterLog } from '@/hooks/useWaterLog';
import { useProfile } from '@/hooks/useProfile';
import { useNotifications } from '@/hooks/useNotifications';
import { useCommunityPosts, pinnedDisplay, isPinnedForMarket } from '@/hooks/useCommunity';
import { prefetchStoreCategories } from '@/hooks/useStore';
import { useMarket } from '@/hooks/useMarket';
import { useIsStaff } from '@/hooks/useWebRoles';
import { SkeletonBlock } from '@/components/ui/Skeleton';
import { useSteadyLoading } from '@/hooks/useSteadyLoading';
import { Icon } from '@/components/icons/Icon';
import { AvatarImg } from '@/components/AvatarImg';
import type { MascotCue, MascotCueKind, MascotMood } from '@/components/home/MascotFace';
import { UpgradeCard } from '@/components/UpgradeCard';
import { UpgradePromptModal } from '@/components/UpgradePromptModal';
import { ArcGauge } from '@/components/home/ArcGauge';
import { GlassArticleCard } from '@/components/home/GlassArticleCard';
import { GlassPainCard } from '@/components/home/GlassPainCard';
import { GlassHealthCard } from '@/components/home/GlassHealthCard';
import { HomeGlassNav, navBottomOffset } from '@/components/home/HomeGlassNav';
import { MetricCircle } from '@/components/home/MetricCircle';
import { HomeMascot } from '@/components/home/HomeMascot';
import { endGlance, glanceAt } from '@/components/home/glanceStore';
import { markWaterArrived, resetWaterArrival } from '@/components/home/waterArrival';
import MaskedView from '@react-native-masked-view/masked-view';
import { FadeGroup, Reveal, ScrollFadeProvider } from '@/components/home/ScrollFade';
import { WaterDial } from '@/components/home/WaterDial';
import { NeumorphicSurface } from '@/components/home/NeumorphicSurface';
import { NeumorphicBox } from '@/components/home/NeumorphicBox';
import { VerticalGradient } from '@/components/home/VerticalGradient';
import { GLASS_CARD_GAP, glassRaised, heroFont, tabularNums } from '@/components/home/glass';
import { useI18n } from '@/lib/i18n';

const WATER_GOAL_CUPS = 8;
const HERO_PHOTO = require('../../assets/home-hero.webp');
/** The photo's own pixel size. Needed because the crop is computed by hand —
 * see `photoScale` below. */
const HERO_PHOTO_W = 941;
const HERO_PHOTO_H = 1672;

/**
 * Home v3 — "TheraHOME Home v3.html" in the Claude Design project
 * (`home-oura.jsx`): a full-bleed photograph, glass panels over it, and a
 * hero that scrolls away under a darkening scrim.
 *
 * Two things the prototype does and this cannot, both noted where they come
 * up: a blurred second copy of the photo (no blur without `expo-blur`, which
 * is a native module), and a CSS mask that feathers the scroll content at the
 * top and bottom (no masked-view in this app).
 *
 * The screen paints its own bottom bar — see `HomeGlassNav` and the matching
 * opt-out in `(tabs)/_layout.tsx`. The other three tabs keep the shared white
 * bar until their own redesigns land.
 */

/** Scroll distance over which the hero hands the screen over to the cards.
 * The prototype's `heroK = min(1, scrollTop / 520)`. */
const HERO_FADE = 520;

/** Space between "NGÀY" and the numeral. */
const DAY_WORD_GAP = 4;

/**
 * There used to be a live `expo-blur` BlurView here, fading in over the hero
 * so the metrics, the gauge and the day counter blurred as they scrolled
 * away — the prototype's own effect.
 *
 * It was removed on 2026-10-24 because it was the price of the whole screen.
 * Measured off the owner's recording: through the hero's fade, one frame in
 * four did not move at all, and the catch-up frame then jumped double. A live
 * UIVisualEffectView re-blurs its backdrop EVERY frame, it covered most of
 * the screen, it was alive for the first 450px of scroll — exactly the window
 * that stuttered — and it sat inside a MaskedView, so its work happened
 * inside that mask's offscreen pass.
 *
 * What the effect is built from now: the photograph still cross-fades into a
 * genuinely blurred copy of itself (`photoBlurOpacity` below), which is the
 * part you actually see; the hero's own content fades and shrinks away over
 * the same distance instead of blurring.
 *
 * To put it back, restore the AnimatedBlurView as the last child of the hero
 * with `opacity: heroBlurOpacity` — and expect those frames back with it.
 */

const SKY_STOPS = homeGlassColors.sky.map((color, index) => ({
  offset: homeGlassColors.skyStops[index],
  color,
}));

/** Behind the fixed header, from the design: transparent at rest, darkening
 * as the hero goes, so the header separates from whatever is passing under
 * it without ever tinting the photograph while it is the subject. */
const HEADER_STOPS = [
  { offset: 0, color: homeGlassColors.scrim, opacity: 0.92 },
  { offset: 0.55, color: homeGlassColors.scrim, opacity: 0.6 },
  { offset: 1, color: homeGlassColors.scrim, opacity: 0 },
];

/** The wash over the photograph — cool at the top, near-black by the time the
 * first card arrives. Taken stop-for-stop from the prototype. */
const SCRIM_STOPS = [
  { offset: 0, color: homeGlassColors.scrimTop, opacity: 0.35 },
  { offset: 0.25, color: homeGlassColors.scrimTop, opacity: 0 },
  { offset: 0.5, color: homeGlassColors.scrimMid, opacity: 0.25 },
  { offset: 0.7, color: homeGlassColors.scrim, opacity: 0.75 },
  { offset: 0.85, color: homeGlassColors.scrim, opacity: 0.95 },
  { offset: 1, color: homeGlassColors.scrim, opacity: 0.95 },
];

/**
 * The scroll content is MASKED at both ends, not covered.
 *
 * The prototype does this with `mask-image` on the scroller: content is hidden
 * above 96px, visible from 122px, and faded out again before the floating nav.
 * The first attempt here used dark scrims instead, which is a different thing
 * entirely — a scrim paints over the photograph as well, so a near-black band
 * appeared across a bright blue picture with a hard line under the header
 * (owner's report, 2026-10-24: "lệch tone"). A mask removes only the content;
 * the photograph behind it is untouched, which is why the design shows no tone
 * change at all.
 *
 * The ramps are longer than the prototype's 26px because the owner asked for
 * the transition to be gradual rather than a cut.
 */
/** The hero translates itself up as it leaves, on top of the scroll — the
 * design's `translateY(scrollY × 0.45)`. */
const HERO_SHIFT_RATE = 0.45;
/** The photograph trails the content four times over — `translateY(sy*0.25)`
 * in the design, which is where its sense of depth comes from. */
const PHOTO_SHIFT_RATE = 0.25;

/**
 * How tall the mask's dissolve bands are.
 *
 * The design uses 26px at the top (96→122 on an 844pt screen, which is right
 * at the header's lower edge). The owner asked for it to be gradual rather
 * than a cut, so the top band is longer and sits above that edge: content
 * keeps full strength while it has open space below the header, and
 * dissolves across the band the header occupies — which is transparent, so
 * you watch it happen.
 */
const MASK_TOP_RAMP = 62;
/** Short on purpose: the design keeps cards crisp until they are almost
 * behind the nav (its own band is 130→70 from the bottom). */
const MASK_BOTTOM_RAMP = 44;

/** The header shows the device's wordmark, not its catalogue name. The
 * catalogue name is a sentence — "Thiết bị hỗ trợ cổ · TheraNECK+" — which
 * truncated to "Thiết bị hỗ trợ cổ · Th…" in the design's centred slot. The
 * wordmark is whatever follows the last separator. */
function deviceWordmark(name: string): string {
  const tail = name.split('·').at(-1) ?? name;
  return tail.trim().toUpperCase();
}

export default function HomeScreen() {
  const theme = useTheme();
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  // Reanimated, not RN's Animated. Both can drive this off the native side,
  // but RN's updates its nodes from the scroll event in its own display-link
  // pass — after the scroll view has already drawn that frame — so every
  // scroll-linked transform trails the content it belongs to by one frame.
  // Reanimated runs the worklet in the UI thread's own event handler and
  // applies the style in the same frame. That one frame is what the owner
  // was comparing against the prototype (2026-10-25).
  const scrollY = useSharedValue(0);
  const { session } = useSession();
  const userId = session?.user.id;
  const selectedProductId = useAppStore((s) => s.selectedProductId);
  const market = useMarket();
  const profile = useProfile(userId).data;
  const isStaff = useIsStaff(userId);
  const notificationsQuery = useNotifications(userId);
  const notifications = notificationsQuery.data ?? [];
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
    const task = InteractionManager.runAfterInteractions(() => {
      void prefetchStoreCategories(queryClient, market).catch(() => {});
    });
    return () => task.cancel();
  }, [queryClient, market]);
  // The assistant mascot turns its head toward wherever you last touched.
  // Touch START only, deliberately: tracking every move would turn a scroll
  // into a stream of updates, and the head only has nine positions to choose
  // between anyway — it cannot show the difference.
  //
  // The point goes to a store outside React, NOT to state here. As state it
  // re-rendered the whole screen on the first touch of every drag, which is
  // the frame a scroll has least to spare (owner's video, 2026-10-24).
  const onTouch = useCallback((event: GestureResponderEvent) => {
    glanceAt(event.nativeEvent.pageX, event.nativeEvent.pageY);
  }, []);
  useEffect(() => endGlance, []);

  // The hero's day line centres the NUMBER on the screen, not the whole
  // "NGÀY 10/14" group — so the word and the "/14" hang off either side of a
  // centred numeral. Both are measured because the shift that achieves it is
  // (width of "/14" − width of "NGÀY" − the gap) / 2, and neither width is
  // known ahead of time (they change with language and with the day count).
  const [dayWordWidth, setDayWordWidth] = useState(0);
  const [dayTotalWidth, setDayTotalWidth] = useState(0);

  // The dial's needle sweeps once, when it has actually arrived. Armed from
  // the scroll listener rather than from the fade's own interpolation,
  // because that one lives on the UI thread and never reaches JS by itself.
  //
  // The flag goes to a store the dial subscribes to, NOT to state here: as
  // state it re-rendered all of Home in the middle of the drag that brings
  // the dial into view.
  // Shared values, not refs: the scroll handler that reads them is a worklet.
  const waterTop = useSharedValue(0);
  const waterArmed = useSharedValue(false);
  useEffect(() => resetWaterArrival, []);
  const onScroll = useAnimatedScrollHandler((event) => {
    scrollY.value = event.contentOffset.y;
    // Crossing into view is the only thing JS needs to hear about, and it
    // needs to hear it once.
    if (!waterArmed.value && waterTop.value > 0 && event.contentOffset.y > waterTop.value - windowHeight * 0.72) {
      waterArmed.value = true;
      runOnJS(markWaterArrived)();
    }
  });

  const focusFadeStyle = useTabFocusFade();
  const badgePopStyle = usePopOnChange(unreadCount);
  const productsQuery = useProducts();
  const programsQuery = useActivatedPrograms(userId);
  const defaultProductQuery = useDefaultProductId(userId);
  // Memoized for the same reason as `catalogProducts`: a fresh `?? []`
  // every render gave the memos below a new dependency each time.
  const activatedPrograms = useMemo(() => programsQuery.data ?? [], [programsQuery.data]);
  // Prefer the product the user actually ordered over just "first activated
  // program" — only kicks in when they haven't explicitly picked one via
  // the dropdown yet (`selectedProductId` always wins once set).
  const catalogProducts = productsQuery.data ?? [];
  // Visible roadmaps (published + unpublished-but-owned, never hidden ones
  // for review accounts) — see useRoadmapProducts. Computed FIRST so the
  // program below can only ever be one the user is allowed to see.
  const activatedProductIds = useMemo(() => activatedPrograms.map((p) => p.productId), [activatedPrograms]);
  const dropdownProducts = useRoadmapProducts(catalogProducts, activatedProductIds, profile?.accountType === 'review');
  const visiblePrograms = activatedPrograms.filter((p) => dropdownProducts.some((d) => d.id === p.productId));
  // When nothing is explicitly selected, prefer a PUBLISHED roadmap so a
  // customer who owns TheraNECK+ and a not-yet-ready TheraBACK lands on the
  // one with content.
  const program =
    visiblePrograms.find((p) => p.productId === selectedProductId) ??
    visiblePrograms.find((p) => p.productId === defaultProductQuery.data && p.product.roadmapPublished) ??
    visiblePrograms.find((p) => p.product.roadmapPublished) ??
    visiblePrograms.find((p) => p.productId === defaultProductQuery.data) ??
    visiblePrograms[0];
  // Before activation there's no program to key off of — fall back to
  // whatever's selected (or the first catalog product) so the pain chart
  // still has something to anchor on while unactivated. Must stay inside the
  // visible list: a persisted selection can point at a roadmap this account
  // cannot see.
  const effectiveChartProductId =
    program?.productId ??
    (selectedProductId && dropdownProducts.some((d) => d.id === selectedProductId) ? selectedProductId : undefined) ??
    dropdownProducts[0]?.id ??
    catalogProducts[0]?.id;
  const chartProduct =
    catalogProducts.find((p) => p.id === effectiveChartProductId) ?? program?.product;
  const chartProgram = activatedPrograms.find((p) => p.productId === effectiveChartProductId);
  const officialPosts = (officialPostsQuery.data ?? []).filter((post) => post.isOfficial);
  const pinnedOfficialPost = officialPosts.find((post) => isPinnedForMarket(post, market));
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
  const requestDayGate = useRequestDay();
  // Hero "Ngày N/X" — X counts only reachable (non-IAP-locked) phases;
  // shared with the Profile header and share snapshot via this hook.
  const progress = useAccessibleProgress(userId, program);

  // The gauge fills once, over about 1.2s, and then the whole hero is still
  // art — which is what makes caching it as a bitmap safe while it scales
  // away under the scroll. Until then it must keep drawing itself.
  const gaugeReady = !program || progress.isReady;
  const [heroSettled, setHeroSettled] = useState(false);
  useEffect(() => {
    if (!gaugeReady) return;
    const timer = setTimeout(() => setHeroSettled(true), 1500);
    return () => clearTimeout(timer);
  }, [gaugeReady]);

  // --- what the mascot reacts to ---------------------------------------
  // Every cue below is a CHANGE, never a state. The first value a query
  // returns is whatever was already true when Home opened — three cups logged
  // this morning is not three things that just happened — so each comparison
  // seeds itself on that first value and only reacts to what follows.
  const [mascotCue, setMascotCue] = useState<MascotCue | null>(null);
  const cueCount = useRef(0);
  const fireCue = useCallback((kind: MascotCueKind) => {
    cueCount.current += 1;
    setMascotCue({ kind, token: cueCount.current });
  }, []);

  const loggedWater = waterQuery.data;
  const lastWater = useRef<number | null>(null);
  useEffect(() => {
    if (loggedWater == null) return;
    const previous = lastWater.current;
    lastWater.current = loggedWater;
    if (previous == null || loggedWater <= previous) return;
    fireCue(loggedWater >= WATER_GOAL_CUPS ? 'excited' : 'pleased');
  }, [fireCue, loggedWater]);

  // Finishing a day happens on the day screen; this fires when Home comes
  // back and the count has gone up.
  const doneDays = daysQuery.data?.filter((day) => day.status === 'done').length;
  const lastDoneDays = useRef<number | null>(null);
  useEffect(() => {
    if (doneDays == null) return;
    const previous = lastDoneDays.current;
    lastDoneDays.current = doneDays;
    if (previous == null || doneDays <= previous) return;
    fireCue('laugh');
  }, [doneDays, fireCue]);

  const lastUnread = useRef<number | null>(null);
  useEffect(() => {
    if (!notificationsQuery.isSuccess) return;
    const previous = lastUnread.current;
    lastUnread.current = unreadCount;
    if (previous == null || unreadCount <= previous) return;
    fireCue('surprise');
  }, [fireCue, notificationsQuery.isSuccess, unreadCount]);

  // `programsQuery` and `daysQuery` are dependent queries. In TanStack Query
  // v5 a disabled query is still `isPending`, even though it is not fetching.
  // Using `isPending` here therefore leaves Home on an infinite spinner when
  // an upstream catalog/phases request fails. `isLoading` only stays true
  // while a request is actually in flight.
  // Only the FIRST frame of data blocks the screen. Everything after it —
  // the programme's days, its phase locks, the purchases — arrives into a
  // Home that is already on screen, because the hero has a resolving state of
  // its own and the cards below have empty states. Gating on the whole chain
  // meant a splash followed by a loading screen, which is not what anybody
  // expects to see after waiting through a splash (owner, 2026-10-24).
  //
  // These two are warmed during the splash by HomeWarmup, so in practice this
  // is usually already false on the first render and no skeleton appears.
  const isLoading = productsQuery.isLoading || programsQuery.isLoading;
  const loadError = productsQuery.error ?? programsQuery.error ?? (program ? daysQuery.error : null);
  const showSkeleton = useSteadyLoading(isLoading);

  // React Native has no `object-position`, so the cover crop is computed:
  // the box is the screen plus the 60pt the design hangs above it, and the
  // photo is scaled to cover that and centred horizontally — which lands its
  // top edge where `object-position: 50% 0%` would.
  const photoBoxHeight = windowHeight + 60;
  const photoScale = Math.max(windowWidth / HERO_PHOTO_W, photoBoxHeight / HERO_PHOTO_H);
  const photoWidth = HERO_PHOTO_W * photoScale;
  const photoHeight = HERO_PHOTO_H * photoScale;
  const photoGeometry = {
    left: (windowWidth - photoWidth) / 2,
    width: photoWidth,
    height: photoHeight,
  };

  // --- scroll-linked hero ---------------------------------------------
  // Opacity and transform only, so all of it stays on the UI thread. The
  // prototype also blurs the hero as it goes (`filter: blur(heroK * 6px)`);
  // React Native cannot blur a live view, so the fade and the shrink carry
  // that part.
  //
  // The photograph is the exception: `Image` has a native `blurRadius`, so
  // the blur the eye actually reads is two stacked copies of it, sharp and
  // blurred, cross-fading under the same parallax.
  const photoStyle = useAnimatedStyle(() => ({
    // The last stop used to be 0.15 — under the 0.75 scrim that is about four
    // percent of a photograph, invisible, and still two full-screen layers to
    // composite on every frame of the rest of the scroll.
    opacity: interpolate(
      scrollY.value,
      [0, HERO_FADE, HERO_FADE * 1.6],
      [1, 0.15, 0],
      Extrapolation.CLAMP,
    ),
    transform: [
      {
        translateY: interpolate(
          scrollY.value,
          [0, 1000],
          [0, 1000 * PHOTO_SHIFT_RATE],
          Extrapolation.CLAMP,
        ),
      },
    ],
  }));
  const photoSharpStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [0, HERO_FADE * 0.55], [1, 0], Extrapolation.CLAMP),
  }));
  const photoBlurStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [0, HERO_FADE * 0.55], [0, 1], Extrapolation.CLAMP),
    transform: [{ scale: 1.03 }],
  }));
  const scrimStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [0, HERO_FADE], [0, 0.75], Extrapolation.CLAMP),
  }));
  /** The whole hero block, exactly as the prototype moves it. */
  const heroStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [0, HERO_FADE / 1.15], [1, 0], Extrapolation.CLAMP),
    transform: [
      {
        translateY: interpolate(
          scrollY.value,
          [0, 1000],
          [0, 1000 * HERO_SHIFT_RATE],
          Extrapolation.CLAMP,
        ),
      },
      { scale: interpolate(scrollY.value, [0, HERO_FADE], [1, 0.94], Extrapolation.CLAMP) },
    ],
  }));
  const headerBackdropStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [0, HERO_FADE * 0.42], [0, 1], Extrapolation.CLAMP),
  }));

  const headerHeight = insets.top + 70;
  // Where the floating nav's top edge sits above the bottom of the screen —
  // HomeGlassNav's own offset plus its 60pt body (50pt pill + 5pt padding
  // either side). Content must be fully hidden by the time it reaches here.
  const navTopFromBottom = navBottomOffset(insets.bottom) + 60;
  const bottomClearance = navTopFromBottom + 24;
  const tabTop = windowHeight - navTopFromBottom;
  // Alpha, not colour: these are the mask's own transparency. The dissolve
  // sits just ABOVE the header's lower edge, so content is still at full
  // strength everywhere it has open space, and loses itself in the band the
  // header covers — which is transparent, so the dissolve is what you
  // actually watch happen. Below, it fades out before the nav rather than
  // sliding under it.
  const maskStops = useMemo(() => {
    const at = (y: number) => Math.min(1, Math.max(0, y / windowHeight));
    const c = homeGlassColors.text;
    return [
      { offset: 0, color: c, opacity: 0 },
      { offset: at(headerHeight - MASK_TOP_RAMP), color: c, opacity: 0 },
      { offset: at(headerHeight + 4), color: c, opacity: 1 },
      { offset: at(tabTop - MASK_BOTTOM_RAMP), color: c, opacity: 1 },
      { offset: at(tabTop + 14), color: c, opacity: 0 },
      { offset: 1, color: c, opacity: 0 },
    ];
  }, [headerHeight, tabTop, windowHeight]);
  // One object for the whole tree; every Reveal reads it from context rather
  // than being handed four props through three levels of card.
  // Every row measures itself against this view, and re-measures whenever
  // its height changes — a card growing above a row moves that row without
  // its own `onLayout` ever firing.
  const contentRef = useRef<View>(null);
  const [contentVersion, setContentVersion] = useState(0);
  const contentHeight = useRef(0);
  const fadeEnv = useMemo(
    () => ({
      scrollY,
      contentRef,
      headerBottom: headerHeight,
      tabTop,
      viewport: windowHeight,
      version: contentVersion,
      speed: 1,
    }),
    [contentVersion, headerHeight, scrollY, tabTop, windowHeight],
  );

  const shell = (children: React.ReactNode) => (
    <View style={[styles.root, { backgroundColor: homeGlassColors.sky[4] }]}>
      <StatusBar style="light" />
      <VerticalGradient stops={SKY_STOPS} />
      {children}
    </View>
  );

  if (isLoading || showSkeleton) {
    return shell(
      // Shaped like Home, not like a stack of cards: four metric discs, the
      // arc, the day numeral, the tagline, the button. When the real screen
      // lands it replaces this in place rather than rearranging everything.
      <View style={[styles.stateBody, { paddingTop: headerHeight, paddingBottom: bottomClearance }]}>
        <View style={styles.metrics}>
          {[0, 1, 2, 3].map((slot) => (
            <View key={slot} style={styles.skeletonMetric}>
              <SkeletonBlock width={64} height={64} radius={32} />
              <SkeletonBlock width={48} height={11} radius={6} />
            </View>
          ))}
        </View>
        <View style={styles.skeletonArc}>
          <SkeletonBlock width="86%" height={6} radius={3} />
        </View>
        <View style={styles.skeletonHero}>
          <SkeletonBlock width={196} height={64} radius={14} />
          <SkeletonBlock width="82%" height={14} radius={7} />
          <SkeletonBlock width="64%" height={14} radius={7} />
          <SkeletonBlock width={188} height={46} radius={23} />
        </View>
      </View>,
    );
  }

  if (loadError || !chartProduct) {
    return shell(
      <View style={[styles.stateBox, { paddingTop: headerHeight, paddingBottom: bottomClearance }]}>
        <View style={[styles.stateIcon, { backgroundColor: homeGlassColors.surfaceInset }]}>
          <Icon name={loadError ? 'activity' : 'box'} size={24} color={homeGlassColors.accent} />
        </View>
        <Text style={[theme.type.h2, heroFont('600'), styles.centered, { color: homeGlassColors.text, marginTop: 14 }]}>
          {loadError ? t('homeLoadErrorTitle') : t('homeNoProductsTitle')}
        </Text>
        <Text style={[theme.type.caption, heroFont('400'), styles.centered, { color: homeGlassColors.textMuted, marginTop: 6, lineHeight: 20 }]}>
          {loadError ? t('checkNetworkRetry') : t('homeNoCatalog')}
        </Text>
        <Pressable
          accessibilityRole="button"
          onPress={() => {
            void productsQuery.refetch();
            void programsQuery.refetch();
            if (program) void daysQuery.refetch();
          }}
          style={[styles.retryButton, glassRaised]}
        >
          <Text style={[theme.type.bodyStrong, heroFont('600'), { color: homeGlassColors.text }]}>{t('retry')}</Text>
        </Pressable>
      </View>,
    );
  }

  const days = daysQuery.data ?? [];
  // No activated program yet (roadmap tab is what actually gates on this —
  // see roadmap.tsx) — `today` stays null and the hero below renders an
  // "activate to unlock" prompt instead of day/phase progress.
  // Anchor on the shared accessible-progress day (review accounts advance
  // it by actual activity, not the calendar) so the hero, the chart and
  // the "Bắt đầu" button all tell the same story.
  const rawToday = program
    ? (days.find((d) => d.id === (progress.day || program.currentDay)) ??
       days.find((d) => d.status === 'current') ??
       days[days.length - 1] ??
       null)
    : null;
  const heroTotalDays = progress.totalDays;
  // The gauge's end label is how long the programme is, and before
  // activation there is no programme to ask: it fell back to 1, and rotated
  // along the arc that "1" even read as a "7" (owner, 2026-11-03). The
  // catalog product the rest of the hero already anchors on carries the
  // real figure — 14 for TheraNECK+.
  const gaugeTotalDays = heroTotalDays || chartProduct?.totalDays || 0;
  const heroDayNumber = rawToday && heroTotalDays ? Math.min(rawToday.id, heroTotalDays) : 0;
  // Once the calendar advances past the reachable days (phase 3 still
  // IAP-locked), the raw "today" row belongs to the locked phase — the hero
  // then anchors on the last REACHABLE day instead, so its phase label and
  // the "Bắt đầu" button never point into a locked phase.
  const today = rawToday ? (days.find((d) => d.id === heroDayNumber) ?? rawToday) : null;

  const chartData = painLogsQuery.data ?? [];
  const water = waterQuery.data ?? 0;
  const latestPain = chartData.length > 0 ? String(chartData[chartData.length - 1].score) : '—';
  // The design's second metric is a phase NUMBER; the data carries a phase
  // name and id, so the number is that phase's position in the programme.
  const phaseOrder = Array.from(new Set(days.map((d) => d.phaseId)));
  const phaseIndex = today ? phaseOrder.indexOf(today.phaseId) + 1 : 0;
  // Not a reaction — this is the mascot's baseline. Late at night it dozes
  // between blinks; once the programme is finished it keeps celebrating.
  const hourOfDay = new Date().getHours();
  const mascotMood: MascotMood =
    hourOfDay >= 21 || hourOfDay < 5
      ? 'night'
      : heroTotalDays > 0 && heroDayNumber >= heroTotalDays
        ? 'celebrating'
        : 'default';

  return (
    <View
      style={[styles.root, { backgroundColor: homeGlassColors.sky[4] }]}
      onTouchStart={onTouch}
    >
      <StatusBar style="light" />
      <VerticalGradient stops={SKY_STOPS} />

      <Reanimated.View pointerEvents="none" style={[StyleSheet.absoluteFill, photoStyle]}>
        <Reanimated.Image
          source={HERO_PHOTO}
          accessibilityIgnoresInvertColors
          resizeMode="cover"
          style={[styles.photo, photoGeometry, photoSharpStyle]}
        />
        {/* Scaled a hair so the softened edges never show a seam, the same
            trick the prototype uses on its blurred copy. */}
        <Reanimated.Image
          source={HERO_PHOTO}
          accessibilityIgnoresInvertColors
          resizeMode="cover"
          blurRadius={18}
          style={[styles.photo, photoGeometry, photoBlurStyle]}
        />
      </Reanimated.View>
      <VerticalGradient stops={SCRIM_STOPS} />
      <Reanimated.View
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, { backgroundColor: homeGlassColors.scrim }, scrimStyle]}
      />

      <Reanimated.View style={[styles.root, focusFadeStyle]}>
        {/* The design feathers both edges of the scroller with a vertical
            `mask-image`, and after a day of trying to do it with per-row
            opacity, there is no substitute: a mask dissolves content BY
            PIXEL, so the top half of a chart can be half gone while the
            bottom half is still crisp. Opacity can only take a whole row at
            once, which is either too early (it vanishes in open space) or too
            late (its top shows through the header).

            It costs an offscreen pass per frame, which is why it was removed
            on 2026-10-24 — but the live blur that shared the frame with it is
            gone now, and the vector content is cached. Measure again rather
            than assume (see docs/home-ui-rules.md). */}
        <MaskedView
          style={styles.root}
          maskElement={
            <View style={styles.root}>
              <VerticalGradient stops={maskStops} />
            </View>
          }
        >
        <Reanimated.ScrollView
          showsVerticalScrollIndicator={false}
          // Every frame. The worklet below runs on the UI thread, so this is
          // not a JS cost — and starving it is exactly what made the screen
          // kick backwards four times a second when it was 64.
          scrollEventThrottle={16}
          contentContainerStyle={{ paddingBottom: bottomClearance }}
          onScroll={onScroll}
        >
          <View
            ref={contentRef}
            onLayout={(event) => {
              const next = Math.round(event.nativeEvent.layout.height);
              if (next === contentHeight.current) return;
              contentHeight.current = next;
              setContentVersion((version) => version + 1);
            }}
          >
          <ScrollFadeProvider value={fadeEnv}>
          <View style={{ height: headerHeight }} />

          {/* One cached bitmap for the whole hero, not one per row. It is
              scaled and moved on every frame of the scroll, and everything
              in it — four SVG rims, the arc, the numeral — would otherwise
              be re-drawn each time the scale changed. Only once the arc has
              finished filling: caching something mid-animation invalidates
              the cache every frame. */}
          <FadeGroup rasterize={heroSettled} style={heroStyle}>
            {/* Each hero row dissolves on its own as it reaches the header —
                the mask used to do this for all of them at once. They move
                faster than the scroll because the hero also shifts itself,
                hence `speed`; and they only ever leave upward, so there is
                no bottom guard to apply.

                Rasterised: the hero is scaled from 1 to 0.9 as it leaves,
                and every rim in this row is an SVG, which iOS re-draws each
                time the scale changes. Values change a few times a session,
                and each change costs one re-draw. `rasterizationScale`
                follows the display, so the cached bitmap stays sharp. */}
            <View style={styles.metrics}>
              <MetricCircle icon="activity" value={latestPain} label={t('metricPain')} />
              <MetricCircle icon="layers" value={phaseIndex > 0 ? String(phaseIndex) : '—'} label={t('metricPhase')} />
              {/* Fixed on purpose: nothing records how long a session took,
                  and the owner asked (2026-10-23) to keep the design's figure
                  rather than drop the metric or invent a number. Swap this
                  for real data the day a session logs its duration. */}
              <MetricCircle icon="timer" value="30p" label={t('metricTraining')} />
              <MetricCircle
                icon="droplet"
                value={`${water}/${WATER_GOAL_CUPS}`}
                label={t('water')}
                onPress={() => setWaterMutation.mutate(Math.min(WATER_GOAL_CUPS, water + 1))}
              />
            </View>

            {/* Same, but only cached once the arc has finished filling —
                rasterising something mid-animation invalidates the cache
                every frame and costs more than it saves. */}
            <View style={styles.gauge}>
              <ArcGauge value={heroDayNumber} max={gaugeTotalDays} ready={gaugeReady} />
            </View>

            <View style={styles.heroCopy}>
              {program && !program.product.roadmapPublished ? (
                // Owner of a device whose roadmap Admin hasn't published yet:
                // no day counter, no Start — those would open an empty
                // programme. Same copy as the Roadmap tab's card.
                <>
                  <Text style={[theme.type.h2, heroFont('600'), styles.centered, { color: homeGlassColors.text }]}>
                    {t('roadmapComingSoonTitle', { product: program.product.name })}
                  </Text>
                  <Text style={[theme.type.body, heroFont('400'), styles.centered, styles.tagline, { color: homeGlassColors.textSoft }]}>
                    {t('roadmapComingSoonBody')}
                  </Text>
                </>
              ) : program && !progress.isReady ? (
                // While lock requirements / purchases are still loading, the
                // accessible-progress numbers are provisional (28 instead of
                // 14) and `today` could point into a locked phase — hold the
                // hero rather than expose "Bắt đầu" for it.
                // Placeholders in the shape of what is coming, not a
                // spinner spinning in open space — the numeral's block, the
                // two tagline lines, the button's pill. The real values land
                // in place.
                <View style={styles.heroPending}>
                  <SkeletonBlock width={196} height={64} radius={14} />
                  <SkeletonBlock width={232} height={14} radius={7} />
                  <SkeletonBlock width={180} height={14} radius={7} />
                  <SkeletonBlock width={188} height={46} radius={23} />
                </View>
              ) : program && today ? (
                <>
                  <View
                    style={[
                      styles.dayLine,
                      { transform: [{ translateX: (dayTotalWidth - dayWordWidth - DAY_WORD_GAP) / 2 }] },
                    ]}
                  >
                    <Text
                      onLayout={(event) => setDayWordWidth(event.nativeEvent.layout.width)}
                      style={[styles.dayWord, { color: homeGlassColors.textSoft, ...heroFont('500') }]}
                    >
                      {t('dayWord')}
                    </Text>
                    <TransitionText
                      value={String(heroDayNumber)}
                      style={[tabularNums, styles.dayNumber, { color: homeGlassColors.text, ...heroFont('200') }]}
                    />
                    <Text
                      onLayout={(event) => setDayTotalWidth(event.nativeEvent.layout.width)}
                      style={[tabularNums, styles.dayTotal, { color: homeGlassColors.textMuted, ...heroFont('200') }]}
                    >
                      /{heroTotalDays}
                    </Text>
                  </View>
                  <Text style={[theme.type.body, heroFont('400'), styles.centered, styles.tagline, { color: homeGlassColors.textSoft }]}>
                    {t('homeTagline')}
                  </Text>
                  <View style={styles.heroActions}>
                    <Pressable
                      accessibilityRole="button"
                      onPress={() => void requestDayGate.requestDay(today, program.userProgramId, program.productId)}
                      style={({ pressed }) => [pressed ? { transform: [{ scale: 0.97 }] } : null]}
                    >
                      {/* The same lighting model as the tab bar, but one
                          surface step lighter so the primary action stays
                          distinct after the bar itself was darkened. */}
                      <NeumorphicBox
                        color={homeGlassColors.surfaceActionNeumorphic}
                        gradient={homeGlassColors.actionSurface}
                        topHighlight
                        radius={999}
                        style={styles.startButton}
                      >
                        <Icon name="play" size={14} color={homeGlassColors.navIconActive} strokeWidth={2} />
                        {/* The label was hardcoded to "Bắt đầu hôm nay", so after
                            finishing today's session Home still invited you to
                            start it while Roadmap's card for the SAME day said
                            "Đã hoàn thành" and offered "Xem lại" — the two
                            screens contradicting each other (QA on device,
                            2026-11-02). The Roadmap card was fixed the day
                            before and this one was missed. Finished days stay
                            openable, so this changes what the button says, not
                            where it goes. */}
                        <Text style={[theme.type.bodyStrong, heroFont('600'), { color: homeGlassColors.text }]}>
                          {today.status === 'done' ? t('reviewSession') : t('startToday')}
                        </Text>
                      </NeumorphicBox>
                    </Pressable>
                  </View>
                </>
              ) : (
                <>
                  <Text style={[theme.type.h1, heroFont('700'), styles.centered, { color: homeGlassColors.text }]}>
                    {t('unlockRoadmapTitle')}
                  </Text>
                  <Text style={[theme.type.caption, heroFont('400'), styles.centered, styles.tagline, { color: homeGlassColors.textSoft }]}>
                    {t('unlockRoadmapHint')}
                  </Text>
                  <View style={styles.heroActions}>
                    <Pressable
                      accessibilityRole="button"
                      onPress={() => router.push('/activate')}
                      style={({ pressed }) => [
                        styles.startButton,
                        { backgroundColor: homeGlassColors.surfaceAction },
                        pressed && { opacity: 0.8 },
                      ]}
                    >
                      <NeumorphicSurface radius={999} />
                      <Text style={[theme.type.bodyStrong, heroFont('600'), { color: homeGlassColors.text }]}>{t('enterActivationCode')}</Text>
                    </Pressable>
                  </View>
                </>
              )}
            </View>
          </FadeGroup>

          {/* `box-none`, because this group's box is much taller than what
              it draws: `styles.cards` opens with 140pt of empty padding, and
              the stack scrolls at full speed while the hero above it lags at
              HERO_SHIFT_RATE. Every 100pt of scroll therefore slides that
              invisible padding 45pt further up over the hero — and the Start
              button sits at the hero's bottom edge, so a little way into the
              scroll the button was still on screen, still drawn, and every
              tap on it landed on empty padding instead (owner, 2026-11-03).
              The cards themselves still take their own taps. */}
          <FadeGroup style={styles.cards} pointerEvents="box-none">
            {/* Each of these reveals its own rows — a card is too big a
                unit for an edge effect, and the owner wants the pieces to
                arrive in order rather than as one slab. */}
            <GlassPainCard data={chartData} previewHighScore />

            <FadeGroup
              onMeasure={(top) => {
                waterTop.value = top;
              }}
            >
              <WaterDial
                cups={water}
                goal={WATER_GOAL_CUPS}
                onSet={(next) => setWaterMutation.mutate(next)}
              />
            </FadeGroup>

            {/* Today's Apple Activity rings, in place of the roadmap dot grid
                (owner, 2026-10-25). The card hides itself on Android and on
                any device without a Health app, so this is not gated here.
                Not rasterised from here: it caches itself once its rings have
                finished filling. */}
            <GlassHealthCard userId={userId} />

            {/* Hides itself when no paid tier is configured or the user
                already holds one — see src/components/UpgradeCard.tsx. Home
                v3 has no design for it, so it keeps its own card chrome
                rather than being dropped and silently losing the upsell. */}
            <Reveal>
              <UpgradeCard userId={userId} />
            </Reveal>

            <FadeGroup>
              <Reveal style={styles.sectionHeader}>
                <Text style={[styles.sectionTitle, { color: homeGlassColors.text, ...heroFont('600') }]}>
                  {t('articlesFrom')}
                </Text>
                <Pressable
                  accessibilityRole="button"
                  hitSlop={8}
                  onPress={() => router.push({ pathname: '/community', params: { filter: 'official', content: 'blog' } })}
                >
                  <Text style={[theme.type.caption, heroFont('400'), { color: homeGlassColors.link, ...heroFont('600') }]}>
                    {t('seeAll')}
                  </Text>
                </Pressable>
              </Reveal>
              {homeOfficialPost ? (
                <GlassArticleCard
                  title={homeOfficialDisplay!.title}
                  description={homeOfficialDisplay!.content}
                  thumbnailUrl={homeOfficialDisplay!.thumbnailUrl}
                  createdAt={homeOfficialPost.createdAt}
                  onPress={() => router.push({ pathname: '/community/[postId]', params: { postId: homeOfficialPost.id } })}
                />
              ) : (
                <Reveal>
                  <Text style={[theme.type.caption, heroFont('400'), { color: homeGlassColors.textFaint, paddingVertical: 8 }]}>
                    {t('homeNoSuggestions')}
                  </Text>
                </Reveal>
              )}
            </FadeGroup>
          </FadeGroup>
          </ScrollFadeProvider>
          </View>
        </Reanimated.ScrollView>
        </MaskedView>
      </Reanimated.View>

      {/* Design: "phía sau header có một dải gradient tối, độ đậm tăng theo
          heroK". At rest it is not there at all. */}
      <Reanimated.View
        pointerEvents="none"
        style={[styles.headerBackdrop, { height: headerHeight + 30 }, headerBackdropStyle]}
      >
        <VerticalGradient stops={HEADER_STOPS} />
      </Reanimated.View>

      {/* Header sits above the scroll view so it stays put. */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]} pointerEvents="box-none">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('profile')}
          onPress={() => router.push('/profile')}
          style={[styles.headerButton, glassRaised, styles.headerButtonFlat]}
        >
          <NeumorphicSurface radius={25} />
          <AvatarImg tone="glass" size={42} uri={profile?.avatarUrl} />
        </Pressable>
        <Text
          numberOfLines={1}
          style={[styles.wordmark, { color: homeGlassColors.text, ...heroFont('400') }]}
        >
          {deviceWordmark(chartProduct.name)}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('notifications')}
          onPress={() => router.push('/notifications')}
          // No drop shadow on the two header buttons: they sit on the
          // photograph, where a shadow reads as grime rather than depth
          // (owner, 2026-10-25). The painted rim is enough.
          style={[styles.headerButton, glassRaised, styles.headerButtonFlat]}
        >
          <NeumorphicSurface radius={25} />
          <Icon name="bell" size={21} color={homeGlassColors.text} />
          {unreadCount > 0 ? (
            // The count, not a dot: "thử để trường hợp có số badge" (owner,
            // 2026-10-25). Past nine it stops counting and says so, which is
            // what every other inbox does.
            <Reanimated.View
              style={[styles.badge, { backgroundColor: homeGlassColors.badge }, badgePopStyle]}
            >
              <Text style={styles.badgeCount} numberOfLines={1}>
                {unreadCount > 9 ? '9+' : unreadCount}
              </Text>
            </Reanimated.View>
          ) : null}
        </Pressable>
      </View>

      <HomeGlassNav
        active="home"
        onNavigate={(route) => router.navigate(route as '/home')}
        trailing={
          <HomeMascot cue={mascotCue} mood={mascotMood} isStaff={isStaff} />
        }
      />

      {/* Decides for itself whether to appear: after a first finished
          session, for somebody with no plan, once per app launch, and never
          again once they tick "không hiển thị lại". */}
      <UpgradePromptModal userId={userId} daysDone={days.filter((d) => d.status === 'done').length} />
      {requestDayGate.pendingDay !== null ? (
        <PainScaleModal
          dayId={requestDayGate.pendingDay}
          onCancel={requestDayGate.cancelPain}
          onConfirm={(value) => void requestDayGate.confirmPain(value)}
          submitting={requestDayGate.isSubmitting}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  photo: {
    position: 'absolute',
    // The box starts 60pt above the screen, as the prototype's does; `left`,
    // `width` and `height` are computed per device.
    top: -60,
  },
  headerBackdrop: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
  },
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 18,
    paddingBottom: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    zIndex: 35,
  },
  headerButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
    // No `overflow: hidden`: the badge sits half outside the circle, and
    // AvatarImg rounds itself anyway.
  },
  headerButtonFlat: {
    shadowOpacity: 0,
    elevation: 0,
  },
  badge: {
    position: 'absolute',
    top: -3,
    right: -3,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeCount: {
    color: '#FFFFFF',
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '700',
  },
  wordmark: {
    flex: 1,
    textAlign: 'center',
    fontSize: 21,
    lineHeight: 26,
    letterSpacing: 2.5,
  },
  metrics: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 26,
  },
  gauge: {
    paddingTop: 44,
    paddingHorizontal: 22,
  },
  heroCopy: {
    // The prototype's 150 put the numeral over the figure's torso on a real
    // phone — owner's note, 2026-10-24. A little further down clears her.
    marginTop: 172,
    alignItems: 'center',
    paddingHorizontal: 30,
  },
  heroPending: {
    alignItems: 'center',
    gap: 14,
  },
  dayLine: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  dayWord: {
    fontSize: 18,
    lineHeight: 24,
    letterSpacing: 1.5,
    marginRight: DAY_WORD_GAP,
  },
  dayNumber: {
    fontSize: 72,
    lineHeight: 78,
    letterSpacing: -2,
  },
  dayTotal: {
    fontSize: 30,
    lineHeight: 36,
  },
  tagline: {
    marginTop: 20,
    lineHeight: 23,
  },
  heroActions: {
    marginTop: 22,
    alignItems: 'center',
  },
  startButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 999,
    paddingHorizontal: 24,
    paddingVertical: 13,
  },
  cards: {
    // Room for the photograph before the stack starts. The prototype's figure
    // is 260; measured on a real phone that put the first card's top at
    // content y 974, so it was still only touching the bottom edge at the
    // scroll position where the hero has already blurred away — the owner
    // wanted it entering view by then (2026-10-24). 140 brings it up without
    // letting it peek above the bottom mask at rest.
    paddingTop: 140,
    paddingHorizontal: 14,
    gap: GLASS_CARD_GAP,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    paddingTop: 4,
    marginBottom: 2,
  },
  sectionTitle: {
    fontSize: 18,
    lineHeight: 24,
    letterSpacing: -0.3,
  },
  stateBody: {
    flex: 1,
    paddingHorizontal: 14,
  },
  skeletonMetric: {
    width: 72,
    alignItems: 'center',
    gap: 8,
  },
  skeletonArc: {
    paddingTop: 52,
    alignItems: 'center',
  },
  skeletonHero: {
    marginTop: 168,
    alignItems: 'center',
    gap: 14,
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
  centered: {
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 18,
    minWidth: 132,
    paddingHorizontal: 22,
    paddingVertical: 12,
    borderRadius: 999,
    alignItems: 'center',
  },
});
