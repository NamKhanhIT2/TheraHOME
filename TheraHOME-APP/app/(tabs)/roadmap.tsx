import React, { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import { KeyboardAvoidingView, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import MaskedView from '@react-native-masked-view/masked-view';
import { router, useFocusEffect } from 'expo-router';
import Reanimated, { FadeOut } from 'react-native-reanimated';
import { homeGlassColors, useTheme } from '@/theme';
import { useSession } from '@/hooks/useSession';
import { useProfile } from '@/hooks/useProfile';
import { useActivatedPrograms, useCatalogProgramDays, useDefaultProductId, useProducts, useRoadmapProducts, type DayRow } from '@/hooks/usePrograms';
import { RoadmapComingSoonCard } from '@/components/roadmap/RoadmapComingSoonCard';
import { useRequestDay } from '@/hooks/useRequestDay';
import { useAccessibleProgress } from '@/hooks/useAccessibleProgress';
import { usePhaseLockRequirements } from '@/hooks/usePhasePromo';
import { usePhasePurchases, daysOpenAfterPurchase } from '@/hooks/usePhasePurchase';
import { useQuizResolvedMap } from '@/hooks/useQuiz';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { HomeGlassNav, navBottomOffset } from '@/components/home/HomeGlassNav';
import { HomeMascot } from '@/components/home/HomeMascot';
import { VerticalGradient } from '@/components/home/VerticalGradient';
import { heroFont } from '@/components/home/glass';
import { SkeletonBlock } from '@/components/ui/Skeleton';
import { useSteadyLoading } from '@/hooks/useSteadyLoading';
import { ProductDropdown } from '@/components/ProductDropdown';
import { PainScaleModal } from '@/components/PainScaleModal';
import { ProductActivateCard } from '@/components/roadmap/ProductActivateCard';
import { PhaseUnlockPromo } from '@/components/roadmap/PhaseUnlockPromo';
import { PathNode } from '@/components/PathNode';
import { PhaseFooter } from '@/components/roadmap/PhaseFooter';
import { RoadmapCalendar } from '@/components/roadmap/RoadmapCalendar';
import { TodayCard } from '@/components/roadmap/TodayCard';
import { SurveyPromptModal } from '@/components/roadmap/SurveyPromptModal';
import { Icon } from '@/components/icons/Icon';
import { Button } from '@/components/ui/Button';
import { IAP_ENABLED } from '@/lib/features';
import { useI18n } from '@/lib/i18n';
import { useAppStore } from '@/store/useAppStore';
import { useTabFocusFade } from '@/hooks/useTabFocusFade';
import { fadeUpEntering, staggerDelay } from '@/lib/motion';

/** A quieter version of Home's sky: no photograph here, so the screen is
 * its own backdrop — a little lift at the top, near-black by the nav. */
const ROADMAP_STOPS = [
  { offset: homeGlassColors.roadmapSkyStops[0], color: homeGlassColors.roadmapSky[0] },
  { offset: homeGlassColors.roadmapSkyStops[1], color: homeGlassColors.roadmapSky[1] },
  { offset: homeGlassColors.roadmapSkyStops[2], color: homeGlassColors.roadmapSky[2] },
];

/** How long a day's session is told to take. The catalogue carries no
 * per-day duration, and every published day is the same short session, so
 * this is a constant rather than a column that would always hold 10. */
const SESSION_MINUTES = 10;

export default function RoadmapScreen() {
  const theme = useTheme();
  const { t, language } = useI18n();
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  // Nothing may show through the floating bar — the same rule, and the same
  // mechanism, as Home (docs/home-ui-rules.md).
  const maskStops = useMemo(() => {
    const height = windowHeight - insets.top;
    const navTop = height - (navBottomOffset(insets.bottom) + 60);
    const at = (y: number) => Math.min(1, Math.max(0, y / height));
    const c = homeGlassColors.text;
    return [
      { offset: 0, color: c, opacity: 1 },
      { offset: at(navTop - 44), color: c, opacity: 1 },
      { offset: at(navTop + 14), color: c, opacity: 0 },
      { offset: 1, color: c, opacity: 0 },
    ];
  }, [insets.bottom, insets.top, windowHeight]);
  const { session } = useSession();
  const userId = session?.user.id;
  // App Review accounts get NO day/survey gating (per explicit request
  // 2026-09-03): every day is tappable and each phase's survey is open
  // without finishing the phase, so Apple's reviewer can exercise the whole
  // app in one sitting. The IAP lock on phase 3 deliberately stays — that's
  // the paywall Apple needs to test.
  const isReviewAccount = useProfile(userId).data?.accountType === 'review';
  const selectedProductId = useAppStore((state) => state.selectedProductId);
  const selectProduct = useAppStore((state) => state.selectProduct);
  // Collapsed by phaseId — collapsing tucks away both the day list *and*
  // that phase's quiz/promo footer (so a collapsed old phase's "take the
  // quiz" prompt isn't left dangling visible on its own). Only an explicit
  // tap overrides the computed default below; this map holds overrides,
  // not the effective state itself.

  const productsQuery = useProducts();
  const programsQuery = useActivatedPrograms(userId);
  const defaultProductQuery = useDefaultProductId(userId);
  const activatedPrograms = programsQuery.data ?? [];
  // Memoized (not a fresh `?? []` per render) — feeds the dropdownProducts
  // memo below.
  const catalogProducts = useMemo(() => productsQuery.data ?? [], [productsQuery.data]);
  // The dropdown lists every device in a PRIMARY store group ("nhóm sản
  // phẩm chính"), activated or not — a not-yet-activated device shows a
  // per-product unlock card instead of its days. Names come from the
  // viewer's market's store item row (admin fills them per market in the
  // Sản Phẩm tab). Falls back to the full catalog while the flag data
  // loads (or if admin flagged nothing yet).
  // Published roadmaps + the unpublished ones this customer already owns —
  // see useRoadmapProducts. (Was: the Store's "nhóm chính" flag, which tied
  // roadmap visibility to storefront grouping.)
  const activatedProductIds = useMemo(() => activatedPrograms.map((p) => p.productId), [activatedPrograms]);
  const dropdownProducts = useRoadmapProducts(catalogProducts, activatedProductIds, isReviewAccount);
  // Prefer the product the user actually ordered over just "first activated
  // program" — only kicks in when they haven't explicitly picked one via
  // the dropdown yet (`selectedProductId` always wins once set).
  // Only products in the VISIBLE list can be selected. A persisted
  // selection (or the account's default device) pointing at a hidden
  // roadmap — e.g. the review account's auto-provisioned TheraNECK PRO —
  // falls through to the first visible one instead of rendering it.
  const visible = (id: string | null | undefined) => (id && dropdownProducts.some((p) => p.id === id) ? id : undefined);
  const effectiveProductId =
    visible(selectedProductId) ??
    visible(defaultProductQuery.data) ??
    visible(activatedPrograms.find((p) => dropdownProducts.some((d) => d.id === p.productId))?.productId) ??
    dropdownProducts[0]?.id;
  const selectedProduct = dropdownProducts.find((p) => p.id === effectiveProductId);
  const program = activatedPrograms.find((p) => p.productId === effectiveProductId);
  // Same review-aware "Ngày N" the Home hero and Profile use — keeps the
  // roadmap's "Hôm nay" marker on the day the reviewer actually reached.
  const accessibleProgress = useAccessibleProgress(userId, program);
  const rawTodayMarker = isReviewAccount ? accessibleProgress.day : program?.currentDay;

  // Pin the first resolved device as the explicit (persisted) selection so
  // reopening the app always lands on the same roadmap — before this, an
  // unset selection re-resolved through the fallback chain on every open
  // and could land on a different product.
  useEffect(() => {
    if (!selectedProductId && program) selectProduct(program.productId);
  }, [selectedProductId, program, selectProduct]);

  // Manual expand/collapse taps stick for the session, and reset when the
  // product changes so every roadmap opens in its default layout.
  const [collapsedOverrides, setCollapsedOverrides] = useState<Record<string, boolean>>({});
  useEffect(() => {
    setCollapsedOverrides({});
  }, [effectiveProductId]);

  const daysQuery = useCatalogProgramDays(selectedProduct?.id, program?.userProgramId, program?.activatedAt);
  // Dependent queries can be `isPending` while disabled. Only show the
  // spinner for queries that are actively fetching, otherwise an upstream
  // error can leave this screen spinning forever.
  const isLoading =
    productsQuery.isLoading || programsQuery.isLoading || (!!selectedProduct && daysQuery.isLoading);
  const loadError = productsQuery.error ?? programsQuery.error ?? (selectedProduct ? daysQuery.error : null);
  // Stable reference (not a fresh `?? []` array each render) so the memos
  // below that key off `days` don't recompute every render.
  const days = useMemo(() => daysQuery.data ?? [], [daysQuery.data]);
  // Snap the "Hôm nay" marker onto a day that actually exists. `current_day`
  // is capped at products.total_days, which can exceed the number of days
  // Admin created (or land in a gap left by a deleted day) — the marker then
  // matched no node and the roadmap showed no "Hôm nay" at all.
  const todayMarkerDay = useMemo(() => {
    if (!rawTodayMarker || !days.length) return rawTodayMarker;
    if (days.some((d) => d.id === rawTodayMarker)) return rawTodayMarker;
    const before = days.filter((d) => d.id <= rawTodayMarker);
    return (before.length ? before[before.length - 1] : days[0]).id;
  }, [rawTodayMarker, days]);
  const focusFadeStyle = useTabFocusFade();
  // No global gate anymore (per explicit request): the device dropdown
  // always shows — even for a brand-new account with nothing activated —
  // and each not-yet-activated device renders its own inline phone/email
  // card (the RPC binds the first redeemed contact to the account).

  // Phase-level IAP gating layered on top of the calendar-based unlock: a
  // phase only appears here if admin configured an `apple_product_id` for
  // it, and stays hidden (regardless of how far the calendar has advanced)
  // until a verified purchase exists. See PhaseFooter/PhaseUnlockPromo for
  // the unlock UI itself.
  const phaseIds = useMemo(() => Array.from(new Set(days.map((d) => d.phaseId))), [days]);
  const lockRequirementsQuery = usePhaseLockRequirements();
  const purchasesQuery = usePhasePurchases(userId);
  // Hold the skeleton until the paid-phase list has answered. Until it does,
  // `lockedPhaseIds` below is empty — nothing is paid — so a customer whose
  // calendar is already past day 14 would see the paid phase's days for that
  // instant (owner 2026-09-26). One more beat of the skeleton costs less than
  // a flash of content nobody bought. The query itself now falls back to the
  // last known list when it fails, so this only waits on a genuinely first,
  // still-running lookup.
  const showSkeleton = useSteadyLoading(
    isLoading || (IAP_ENABLED && !!selectedProduct && lockRequirementsQuery.isLoading),
  );
  // A phase the user has PAID for opens its first two days immediately and
  // one more every 24 hours from the purchase (owner 2026-09-25) — the
  // buyer can start at once without being handed the whole phase to binge.
  // Maps phase id → the highest day number open in it right now.
  const boughtPhaseOpenThrough = useMemo(() => {
    const out = new Map<string, number>();
    if (!IAP_ENABLED) return out;
    const requirements = lockRequirementsQuery.data;
    const purchased = purchasesQuery.data;
    if (!requirements || !purchased) return out;
    for (const phaseId of requirements.keys()) {
      const purchasedAt = purchased.get(phaseId);
      if (!purchasedAt) continue;
      const firstDay = days.filter((d) => d.phaseId === phaseId).reduce((min, d) => Math.min(min, d.id), Infinity);
      if (!Number.isFinite(firstDay)) continue;
      out.set(phaseId, daysOpenAfterPurchase(firstDay, purchasedAt));
    }
    return out;
  }, [lockRequirementsQuery.data, purchasesQuery.data, days]);
  /** This day is inside a bought phase AND its turn has come. */
  const dayBoughtOpen = useCallback(
    (day: { id: number; phaseId: string }) => day.id <= (boughtPhaseOpenThrough.get(day.phaseId) ?? -Infinity),
    [boughtPhaseOpenThrough],
  );
  /** Bought, but still waiting for its 49 hours. */
  const dayBoughtWaiting = useCallback(
    (day: { id: number; phaseId: string }) => boughtPhaseOpenThrough.has(day.phaseId) && !dayBoughtOpen(day),
    [boughtPhaseOpenThrough, dayBoughtOpen],
  );
  /** The one gate for opening a day.
   *
   * A phase that must be BOUGHT answers ONLY to the purchase rule — never to
   * the calendar (owner 2026-09-29). Someone who lapsed past day 17 and then
   * bought used to get those days immediately, because the calendar already
   * counted them as due, so the 49-hour wait never bit for exactly the people
   * most likely to buy, binge and ask for a refund. A day already watched
   * stays reachable so nothing completed disappears.
   *
   * A free phase keeps the calendar rule it always had. */
  const dayBlocked = useCallback(
    (day: { id: number; phaseId: string; status: DayRow['status'] }) => {
      if (isReviewAccount) return false;
      if (IAP_ENABLED && (lockRequirementsQuery.data?.has(day.phaseId) ?? false)) {
        return !dayBoughtOpen(day) && day.status !== 'done';
      }
      return day.status === 'locked' || day.status === 'upcoming';
    },
    [isReviewAccount, lockRequirementsQuery.data, dayBoughtOpen],
  );
  // Declared after dayBlocked: the gate needs it.
  const requestDayGate = useRequestDay(dayBlocked);
  const lockedPhaseIds = useMemo(() => {
    // IAP is off for now — never lock a phase, so the paywall/purchase card is
    // unreachable and StoreKit is never opened (see IAP_ENABLED).
    if (!IAP_ENABLED) return new Set<string>();
    const requirements = lockRequirementsQuery.data;
    const purchased = purchasesQuery.data;
    if (!requirements) return new Set<string>();
    return new Set(Array.from(requirements.keys()).filter((id) => !purchased?.has(id)));
  }, [lockRequirementsQuery.data, purchasesQuery.data]);
  const quizResolvedQuery = useQuizResolvedMap(userId, phaseIds);
  // A phase's footer content unlocks once every one of ITS OWN days has run
  // its course — under the calendar-unlock mechanic that means each
  // non-rest day is either watched ('done') or already in the past
  // ('missed'); watching is no longer what moves time forward. A locked
  // future phase's days are 'locked'/'upcoming' so its footer stays
  // disabled.
  const phaseAllDone = useMemo(() => {
    const map = new Map<string, boolean>();
    for (const d of days) {
      if (d.type === 'rest') continue;
      map.set(d.phaseId, (map.get(d.phaseId) ?? true) && (d.status === 'done' || d.status === 'missed'));
    }
    return map;
  }, [days]);

  // The promo pair for the bottom-of-list cards: the LAST reachable
  // (non-IAP-locked) phase must have all days run their course AND its
  // survey submitted; the cards then advertise the phase that follows it
  // (usually the locked phase 3). Nothing renders mid-journey or when the
  // product has no further phase. Review accounts skip the all-days gate
  // (they can take the survey early via the same bypass, so the survey
  // alone reveals the cards — per explicit request 2026-09-03).
  const bottomPromoPhase = useMemo(() => {
    const phaseOrder: { id: string; name: string }[] = [];
    for (const d of days) if (!phaseOrder.some((p) => p.id === d.phaseId)) phaseOrder.push({ id: d.phaseId, name: d.phase });
    let lastVisibleIdx = -1;
    for (let i = 0; i < phaseOrder.length; i++) if (!lockedPhaseIds.has(phaseOrder[i].id)) lastVisibleIdx = i;
    if (lastVisibleIdx < 0) return null;
    const donePhase = phaseOrder[lastVisibleIdx];
    const nextPhase = phaseOrder[lastVisibleIdx + 1];
    if (!nextPhase) return null;
    if (!isReviewAccount && !(phaseAllDone.get(donePhase.id) ?? false)) return null;
    if (!(quizResolvedQuery.data?.get(donePhase.id) ?? false)) return null;
    return nextPhase;
  }, [days, lockedPhaseIds, phaseAllDone, quizResolvedQuery.data, isReviewAccount]);

  // The phase whose survey is now DUE: its last day has unlocked on the
  // calendar (e.g. day 7 for phase 1), it isn't behind the IAP paywall, and
  // this user has a survey for it they haven't answered yet. Picks the
  // earliest such phase. Review accounts are never nagged — they get no
  // day/survey gating at all (see isReviewAccount).
  const dueSurveyPhase = useMemo(() => {
    if (isReviewAccount || !program) return null;
    const phaseLastDay = new Map<string, { name: string; lastDay: number }>();
    for (const d of days) {
      if (lockedPhaseIds.has(d.phaseId)) continue;
      const cur = phaseLastDay.get(d.phaseId);
      if (!cur || d.id > cur.lastDay) phaseLastDay.set(d.phaseId, { name: d.phase, lastDay: d.id });
    }
    for (const [phaseId, info] of phaseLastDay) {
      // quizResolvedQuery === false means "has a survey AND not yet answered".
      if (program.currentDay >= info.lastDay && quizResolvedQuery.data?.get(phaseId) === false) {
        return { id: phaseId, name: info.name };
      }
    }
    return null;
  }, [days, program, lockedPhaseIds, quizResolvedQuery.data, isReviewAccount]);

  // The prompt is dismissible ("Để sau") but comes back the next time the
  // roadmap tab is focused while the survey is still due — reset the
  // per-focus dismissal on focus. It also stops on its own once the survey
  // is answered (dueSurveyPhase becomes null).
  /** The day the whole screen is about: today's, or the last one that opened. */
  const todayDay = useMemo(() => days.find((d) => d.id === todayMarkerDay) ?? null, [days, todayMarkerDay]);
  /** Every day the user may actually see. A phase behind the paywall is not
   * listed, and a phase whose `salesEnabled` is false is not even advertised
   * — so its days must not surface anywhere else either. The calendar used to
   * be handed the raw `days`, which plotted the unbought phase across the
   * weeks after day 14 and, once those dates passed, drew them as "chưa hoàn
   * thành" — blaming the customer for missing days they were never sold,
   * right under a progress bar that says 12/14 (2026-11-01). */
  const visibleDays = useMemo(
    () => days.filter((d) => !lockedPhaseIds.has(d.phaseId)),
    [days, lockedPhaseIds],
  );
  /** Which phase opens expanded: the one today sits in. A locked phase can
   * never be it — its days are not listed at all. */
  const currentPhaseId = useMemo(() => {
    const current =
      visibleDays.find((d) => d.status === 'current') ?? visibleDays.find((d) => d.id === todayMarkerDay);
    return current?.phaseId ?? visibleDays[visibleDays.length - 1]?.phaseId ?? null;
  }, [visibleDays, todayMarkerDay]);

  const [surveyPromptDismissed, setSurveyPromptDismissed] = useState(false);
  useFocusEffect(useCallback(() => { setSurveyPromptDismissed(false); }, []));
  // Only over the real day list — never on the skeleton, an error, a
  // coming-soon roadmap, or a not-yet-activated device.
  /** The bottom of the "what do I do now" block, measured inside the
   * scroll view, and what is left of the visible area under it. */
  const [todayCardBottom, setTodayCardBottom] = useState(0);
  const [contentTop, setContentTop] = useState(0);
  const listSpacer = useMemo(() => {
    if (!todayCardBottom) return 0;
    // The scroll view's own visible height: the screen, less the status
    // bar, less the floating bar and the gap it sits in.
    const visible = windowHeight - insets.top - (navBottomOffset(insets.bottom) + 72);
    return Math.max(0, visible - (contentTop + todayCardBottom));
  }, [todayCardBottom, contentTop, windowHeight, insets.top, insets.bottom]);

  /** Walks with the day list below, so a phase header is drawn once. Reset
   * on every render, which is exactly the scope it is read in. */
  let lastPhase: string | null = null;

  const showSurveyPrompt =
    !!dueSurveyPhase && !surveyPromptDismissed && !showSkeleton && !loadError && !!selectedProduct?.roadmapPublished;


  return (
    // The owner's dark design (2026-10-25). Same screen, same rules — the
    // whole of the logic above is untouched; what changed is that the day
    // list is drawn on Home's glass palette and carries Home's floating nav
    // instead of the shared white strip.
    <View style={[styles.root, { backgroundColor: homeGlassColors.roadmapSky[2] }]}> 
      <StatusBar style="light" />
      <VerticalGradient stops={ROADMAP_STOPS} />
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
      {/* Keeps the inline activation input above the keyboard (per
          explicit request); same pattern as the chat screens. */}
      <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
      <ScrollView
        contentContainerStyle={[styles.scrollBody, { paddingBottom: navBottomOffset(insets.bottom) + 96 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Reanimated.View entering={fadeUpEntering(0)} style={styles.header}>
          <Text numberOfLines={1} style={[styles.title, styles.titleShrink, heroFont('700'), { color: homeGlassColors.text }]}>
            {t('roadmap')}
          </Text>
          {!loadError && selectedProduct ? (
            <View style={styles.headerAction}>
              <ProductDropdown
                appearance="glass"
                product={selectedProduct}
                products={dropdownProducts}
                onSelect={selectProduct}
              />
            </View>
          ) : null}
        </Reanimated.View>


        {showSkeleton ? (
          /* Three dependent queries: measured around six seconds on a real
             Galaxy A12, all of it a spinner in an empty column. */
          <View style={styles.skeletonBody}>
            <SkeletonBlock height={54} radius={16} />
            {[0, 1].map((phase) => (
              <View key={phase} style={styles.skeletonPhase}>
                <SkeletonBlock width="64%" height={15} />
                {[0, 1, 2].map((day) => (
                  <View key={day} style={styles.skeletonDay}>
                    <SkeletonBlock width={40} height={40} radius={20} />
                    <SkeletonBlock width="46%" height={14} />
                  </View>
                ))}
              </View>
            ))}
          </View>
        ) : loadError ? (
          <View style={styles.errorBox}>
            <Text style={[theme.type.h2, heroFont('600'), { color: homeGlassColors.text, textAlign: 'center' }]}>
              {t('roadmapLoadErrorTitle')}
            </Text>
            <Text style={[theme.type.caption, styles.errorText, { color: homeGlassColors.textMuted }]}>
              {t('checkNetworkRetry')}
            </Text>
            <Button
              style={{ marginTop: 16, minWidth: 132 }}
              onPress={() => {
                void productsQuery.refetch();
                void programsQuery.refetch();
                if (selectedProduct) void daysQuery.refetch();
              }}
            >
              {t('retry')}
            </Button>
          </View>
        ) : selectedProduct && !selectedProduct.roadmapPublished ? (
          // Owner of a device whose roadmap Admin hasn't published yet (only
          // TheraNECK+ has real videos as of 2026-09-05). No days, no
          // survey, no promos — just the honest "coming soon" state.
          <Reanimated.View entering={fadeUpEntering(90)} style={{ marginTop: 16 }}>
            <RoadmapComingSoonCard productName={selectedProduct.name} />
          </Reanimated.View>
        ) : selectedProduct && !program ? (
          // Device not yet activated for this account — the activation
          // input sits INLINE in the card (per explicit request, no detour
          // to /activate): redeem the contact CSKH registered for THIS
          // device (entering one contact never unlocks everything).
          <Reanimated.View entering={fadeUpEntering(90)} style={{ marginTop: 16 }}>
            <ProductActivateCard key={selectedProduct.id} productId={selectedProduct.id} />
          </Reanimated.View>
        ) : selectedProduct && days.length === 0 ? (
          // Published, activated, but Admin has not added any days yet. The
          // list would otherwise render as a blank screen under the product
          // picker with nothing to explain it.
          <Reanimated.View entering={fadeUpEntering(90)} style={{ marginTop: 16 }}>
            <RoadmapComingSoonCard productName={selectedProduct.name} />
          </Reanimated.View>
        ) : selectedProduct ? (
          // Its own y inside the scroll content, because the card below
          // reports a y relative to THIS view, not to the scroll view —
          // measuring only the card would place the fold a header's height
          // too low.
          <View style={{ marginTop: 0 }} onLayout={(event) => setContentTop(event.nativeEvent.layout.y)}>
            {/* The month, then today, then the phase's survey — the owner's
                reference (2026-10-27). The fourteen-row day list it replaced
                said the same thing at four times the height, and said it
                about every day equally; this screen is for the one day that
                is actually open. Any other day is still reachable: tapping
                its square runs the same gate the list ran. */}
            <Reanimated.View entering={fadeUpEntering(60)}>
              <RoadmapCalendar
                days={visibleDays}
                activatedAt={program?.activatedAt}
                doneCount={visibleDays.filter((d) => d.status === 'done').length}
                totalDays={accessibleProgress.totalDays || days.length}
                onSelectDay={(d) => {
                  if (dayBlocked(d)) return;
                  if (program) {
                    void requestDayGate.requestDay(d, program.userProgramId, program.productId);
                  } else {
                    router.push({ pathname: '/day/[dayId]', params: { dayId: String(d.id), productId: selectedProduct.id } });
                  }
                }}
              />
            </Reanimated.View>

            {todayDay && program ? (
              <Reanimated.View entering={fadeUpEntering(110)} onLayout={(event) => setTodayCardBottom(event.nativeEvent.layout.y + event.nativeEvent.layout.height)}>
                <TodayCard
                  day={todayDay}
                  date={new Date()}
                  productName={selectedProduct.name}
                  minutes={SESSION_MINUTES}
                  language={language}
                  onStart={() => {
                    if (dayBlocked(todayDay)) return;
                    void requestDayGate.requestDay(todayDay, program.userProgramId, program.productId);
                  }}
                />
              </Reanimated.View>
            ) : null}

            {/* Measured, not guessed. The list has to START below the
                fold on every phone, and a fixed margin cannot do that: it
                leaves a strip of the next section showing on a tall screen
                and a hole on a short one. The spacer is whatever is left of
                the visible scroll area after the calendar and the card
                (owner, 2026-10-28: "vẫn đang lộ 1 tí nội dung phần sau"). */}
            <View style={{ height: listSpacer }} pointerEvents="none" />

            {/* The day list, back under the fold (owner, 2026-10-28). The
                calendar answers "where am I" and the card answers "what do
                I do now"; this answers "what does the whole thing look
                like", which is a question people only ask by scrolling.
                A locked phase keeps its greyed, tappable header here — the
                path into the paywall, and the path App Review uses to find
                the IAP without playing through fourteen days. */}
            {days.map((d, index) => {
              const nextDay = days[index + 1];
              const isLastOfPhase = !nextDay || nextDay.phaseId !== d.phaseId;
              const showPhase = d.phase !== lastPhase;
              lastPhase = d.phase;

              if (lockedPhaseIds.has(d.phaseId)) {
                if (!showPhase) return null;
                // Selling paused (free-agreement mode): locked AND invisible,
                // so there is no tap path into a paywall nobody may buy from.
                if (lockRequirementsQuery.data?.get(d.phaseId)?.salesEnabled === false) return null;
                return (
                  <Reanimated.View key={d.id} entering={fadeUpEntering(200 + staggerDelay(index, 20, 10))}>
                    <Pressable
                      onPress={() => router.push({ pathname: '/paywall/[phaseId]', params: { phaseId: d.phaseId, phaseName: d.phase } })}
                      style={[styles.phaseHeader, { opacity: 0.5 }]}
                    >
                      <Text numberOfLines={1} style={[theme.type.captionSm, styles.phaseLabel, { fontSize: 13.5, lineHeight: 18, color: homeGlassColors.textFaint, textTransform: 'uppercase', letterSpacing: 0.8 }]}>
                        {d.phase}
                      </Text>
                      <View style={styles.phaseChevron}>
                        <Icon name="lock" size={15} color={homeGlassColors.textFaint} />
                      </View>
                    </Pressable>
                  </Reanimated.View>
                );
              }

              // Stagger within the PHASE, not the whole list: expanding a
              // phase halfway down should cascade from its own first row
              // rather than wait out the delay of every row above it.
              const phaseStart = days.findIndex((x) => x.phaseId === d.phaseId);
              const itemDelay = 200 + staggerDelay(index - phaseStart, 26, 12);
              const collapsed = collapsedOverrides[d.phaseId] ?? d.phaseId !== currentPhaseId;

              return (
                <Fragment key={d.id}>
                  {showPhase ? (
                    <Reanimated.View entering={fadeUpEntering(itemDelay)}>
                      <Pressable
                        onPress={() => setCollapsedOverrides((cur) => ({ ...cur, [d.phaseId]: !collapsed }))}
                        hitSlop={6}
                        style={({ pressed }) => [styles.phaseHeader, pressed ? { opacity: 0.6 } : null]}
                      >
                        <Text numberOfLines={1} style={[theme.type.captionSm, styles.phaseLabel, { fontSize: 13.5, lineHeight: 18, color: homeGlassColors.textFaint, textTransform: 'uppercase', letterSpacing: 0.8 }]}>
                          {d.phase}
                        </Text>
                        <View style={[styles.phaseChevron, { transform: [{ rotate: collapsed ? '-90deg' : '0deg' }] }]}>
                          <Icon name="chevron-down" size={18} color={homeGlassColors.textFaint} strokeWidth={2.2} />
                        </View>
                      </Pressable>
                    </Reanimated.View>
                  ) : null}
                  {!collapsed ? (
                    <Reanimated.View entering={fadeUpEntering(itemDelay)} exiting={FadeOut.duration(120)}>
                      <PathNode
                        day={d}
                        isLast={isLastOfPhase}
                        isToday={program ? d.id === todayMarkerDay : false}
                        unrestricted={isReviewAccount || dayBoughtOpen(d)}
                        opensIn24h={dayBoughtWaiting(d)}
                        onPress={() => {
                          if (dayBlocked(d)) return;
                          if (program) {
                            void requestDayGate.requestDay(d, program.userProgramId, program.productId);
                          } else {
                            router.push({ pathname: '/day/[dayId]', params: { dayId: String(d.id), productId: selectedProduct.id } });
                          }
                        }}
                      />
                    </Reanimated.View>
                  ) : null}
                  {/* A phase's survey belongs after its last day — "đánh
                      giá sau Ngày 7" means after day 7, not above it
                      (owner, 2026-10-28). It used to be pinned under the
                      start button, where it also cost the pre-scroll
                      screen a row. */}
                  {isLastOfPhase ? (
                    <Reanimated.View entering={fadeUpEntering(itemDelay + 20)} style={{ marginTop: 14, marginBottom: 6 }}>
                      <PhaseFooter
                        userId={userId}
                        productId={selectedProduct.id}
                        phaseId={d.phaseId}
                        phaseName={d.phase}
                        enabled={isReviewAccount || (program ? program.currentDay >= d.id : false)}
                        lockedDayNumber={d.id}
                        collapsed={collapsed}
                      />
                    </Reanimated.View>
                  ) : null}
                </Fragment>
              );
            })}

            {bottomPromoPhase ? (
              <Reanimated.View entering={fadeUpEntering(220)} style={{ marginTop: 14 }}>
                <PhaseUnlockPromo
                  phaseId={bottomPromoPhase.id}
                  phaseName={bottomPromoPhase.name}
                  unlocked={!lockedPhaseIds.has(bottomPromoPhase.id)}
                />
              </Reanimated.View>
            ) : null}
          </View>
        ) : null}
      </ScrollView>
      </KeyboardAvoidingView>
      </Reanimated.View>
      </MaskedView>
      </SafeAreaView>

      <HomeGlassNav
        active="roadmap"
        onNavigate={(route) => router.navigate(route as '/roadmap')}
        trailing={<HomeMascot cue={null} mood="default" isStaff={false} />}
      />

      {requestDayGate.pendingDay !== null ? (
        <PainScaleModal
          dayId={requestDayGate.pendingDay}
          onCancel={requestDayGate.cancelPain}
          onConfirm={(value) => void requestDayGate.confirmPain(value)}
          submitting={requestDayGate.isSubmitting}
        />
      ) : null}
      {showSurveyPrompt && dueSurveyPhase ? (
        <SurveyPromptModal
          phaseName={dueSurveyPhase.name}
          onTake={() => {
            setSurveyPromptDismissed(true);
            router.push({ pathname: '/quiz/[phaseId]', params: { phaseId: dueSurveyPhase.id, productId: selectedProduct?.id, phaseName: dueSurveyPhase.name } });
          }}
          onLater={() => setSurveyPromptDismissed(true)}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  lockedPhase: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 18,
    borderWidth: 1,
    padding: 14,
    marginTop: 10,
  },
  lockedPhaseIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  phaseHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 18,
    paddingBottom: 8,
    paddingHorizontal: 10,
  },
  // Clamped so the phase name can never crowd the chevron out of its
  // column, whatever the product calls its phases.
  phaseLabel: {
    flex: 1,
    minWidth: 0,
  },
  phaseChevron: {
    width: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 30,
    lineHeight: 36,
    letterSpacing: -0.6,
  },
  skeletonBody: {
    gap: 22,
    paddingTop: 4,
  },
  skeletonPhase: {
    gap: 16,
  },
  skeletonDay: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  scrollBody: {
    paddingHorizontal: 14,
  },
  // Both children shrink; neither may push the other off a narrow phone.
  headerAction: {
    flexShrink: 1,
    minWidth: 0,
    maxWidth: '62%',
  },
  titleShrink: {
    flexShrink: 1,
    minWidth: 0,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingTop: 10,
    paddingBottom: 6,
    paddingHorizontal: 6,
  },
  lockedCard: {
    alignItems: 'center',
  },
  lockedIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingBox: {
    paddingVertical: 60,
    alignItems: 'center',
  },
  errorBox: {
    paddingHorizontal: 20,
    paddingVertical: 54,
    alignItems: 'center',
  },
  errorText: {
    marginTop: 6,
    lineHeight: 20,
    textAlign: 'center',
  },
});
