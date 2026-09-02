import React, { Fragment, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import Reanimated from 'react-native-reanimated';
import { useTheme } from '@/theme';
import { useSession } from '@/hooks/useSession';
import { useActivatedPrograms, useCatalogProgramDays, useDefaultProductId, usePrimaryProducts, useProducts } from '@/hooks/usePrograms';
import { useRequestDay } from '@/hooks/useRequestDay';
import { usePhaseLockRequirements } from '@/hooks/usePhasePromo';
import { usePhasePurchases } from '@/hooks/usePhasePurchase';
import { useQuizResolvedMap } from '@/hooks/useQuiz';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { ProductDropdown } from '@/components/ProductDropdown';
import { PainScaleModal } from '@/components/PainScaleModal';
import { ProductActivateCard } from '@/components/roadmap/ProductActivateCard';
import { PathNode } from '@/components/PathNode';
import { PhaseFooter } from '@/components/roadmap/PhaseFooter';
import { Icon } from '@/components/icons/Icon';
import { Button } from '@/components/ui/Button';
import { useI18n } from '@/lib/i18n';
import { useAppStore } from '@/store/useAppStore';
import { useTabFocusFade } from '@/hooks/useTabFocusFade';
import { fadeUpEntering, staggerDelay } from '@/lib/motion';

export default function RoadmapScreen() {
  const theme = useTheme();
  const { t } = useI18n();
  const { session } = useSession();
  const userId = session?.user.id;
  const selectedProductId = useAppStore((state) => state.selectedProductId);
  const selectProduct = useAppStore((state) => state.selectProduct);
  // Collapsed by phaseId — collapsing tucks away both the day list *and*
  // that phase's quiz/promo footer (so a collapsed old phase's "take the
  // quiz" prompt isn't left dangling visible on its own). Only an explicit
  // tap overrides the computed default below; this map holds overrides,
  // not the effective state itself.
  const [collapsedOverrides, setCollapsedOverrides] = useState<Record<string, boolean>>({});

  const productsQuery = useProducts();
  const programsQuery = useActivatedPrograms(userId);
  const defaultProductQuery = useDefaultProductId(userId);
  const primaryQuery = usePrimaryProducts();
  const requestDayGate = useRequestDay();
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
  const dropdownProducts = useMemo(() => {
    const info = primaryQuery.data;
    if (!info || info.ids.length === 0) return catalogProducts;
    const filtered = catalogProducts.filter((p) => info.ids.includes(p.id));
    const base = filtered.length ? filtered : catalogProducts;
    return base.map((p) => ({ ...p, name: info.nameById[p.id] ?? p.name }));
  }, [catalogProducts, primaryQuery.data]);
  // Prefer the product the user actually ordered over just "first activated
  // program" — only kicks in when they haven't explicitly picked one via
  // the dropdown yet (`selectedProductId` always wins once set).
  const effectiveProductId =
    selectedProductId ?? defaultProductQuery.data ?? activatedPrograms[0]?.productId ?? dropdownProducts[0]?.id;
  const selectedProduct =
    dropdownProducts.find((p) => p.id === effectiveProductId) ?? catalogProducts.find((p) => p.id === effectiveProductId);
  const program = activatedPrograms.find((p) => p.productId === effectiveProductId);

  // Pin the first resolved device as the explicit (persisted) selection so
  // reopening the app always lands on the same roadmap — before this, an
  // unset selection re-resolved through the fallback chain on every open
  // and could land on a different product.
  useEffect(() => {
    if (!selectedProductId && program) selectProduct(program.productId);
  }, [selectedProductId, program, selectProduct]);

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
  const lockRequirementsQuery = usePhaseLockRequirements(phaseIds);
  const purchasesQuery = usePhasePurchases(userId);
  const lockedPhaseIds = useMemo(() => {
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
  // The phase that should default expanded: normally the one containing the
  // user's actual current day — but once a phase's days AND its survey are
  // both finished there is nothing left to act on inside it, so it
  // collapses by default (per explicit request: when the two promo cards
  // appear after survey 2, phases 1/2 fold up and the cards stand apart —
  // PhaseFooter renders them regardless of collapse). While days are done
  // but the survey isn't, the last visible phase stays open so its
  // take-survey prompt is on screen.
  const currentPhaseId = useMemo(() => {
    const resolved = (phaseId: string) => quizResolvedQuery.data?.get(phaseId) ?? false;
    // Today's day by the calendar — once it's watched its status flips to
    // 'done' and nothing is 'current' anymore, so fall back to the day
    // number the program says is today.
    const currentDay =
      days.find((d) => d.status === 'current') ?? (program ? days.find((d) => d.id === program.currentDay) : undefined);
    if (
      currentDay &&
      !lockedPhaseIds.has(currentDay.phaseId) &&
      !((phaseAllDone.get(currentDay.phaseId) ?? false) && resolved(currentDay.phaseId))
    ) {
      return currentDay.phaseId;
    }
    const visibleDays = days.filter((d) => !lockedPhaseIds.has(d.phaseId));
    const lastVisiblePhaseId = visibleDays[visibleDays.length - 1]?.phaseId ?? null;
    if (lastVisiblePhaseId && quizResolvedQuery.data?.get(lastVisiblePhaseId) === false) return lastVisiblePhaseId;
    return null;
  }, [days, program, lockedPhaseIds, phaseAllDone, quizResolvedQuery.data]);

  let lastPhase: string | null = null;

  return (
    <ScreenContainer edges={['top']}>
      <Reanimated.View style={[{ flex: 1 }, focusFadeStyle]}>
      {/* Keeps the inline activation input above the keyboard (per
          explicit request); same pattern as the chat screens. */}
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.scrollBody} keyboardShouldPersistTaps="handled">
        <Reanimated.View entering={fadeUpEntering(0)} style={styles.header}>
          <Text style={[theme.type.display, { color: theme.colors.textPrimary }]}>{t('recoveryRoadmap')}</Text>
          <Text style={[theme.type.caption, { color: theme.colors.textSecondary, marginTop: 2 }]}>
            {t('chooseProduct')}
          </Text>
        </Reanimated.View>

        {!loadError && selectedProduct ? (
          <Reanimated.View entering={fadeUpEntering(70)} style={{ marginTop: 12 }}>
            <ProductDropdown
              product={selectedProduct}
              products={dropdownProducts}
              onSelect={selectProduct}
            />
          </Reanimated.View>
        ) : null}

        {isLoading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator color={theme.colors.primary} />
          </View>
        ) : loadError ? (
          <View style={styles.errorBox}>
            <Text style={[theme.type.h2, { color: theme.colors.textPrimary, textAlign: 'center' }]}>Chưa thể tải lộ trình</Text>
            <Text style={[theme.type.caption, styles.errorText, { color: theme.colors.textSecondary }]}>
              Vui lòng kiểm tra kết nối mạng rồi thử lại.
            </Text>
            <Button
              style={{ marginTop: 16, minWidth: 132 }}
              onPress={() => {
                void productsQuery.refetch();
                void programsQuery.refetch();
                if (selectedProduct) void daysQuery.refetch();
              }}
            >
              Thử lại
            </Button>
          </View>
        ) : selectedProduct && !program ? (
          // Device not yet activated for this account — the activation
          // input sits INLINE in the card (per explicit request, no detour
          // to /activate): redeem the contact CSKH registered for THIS
          // device (entering one contact never unlocks everything).
          <Reanimated.View entering={fadeUpEntering(90)} style={{ marginTop: 16 }}>
            <ProductActivateCard key={selectedProduct.id} productId={selectedProduct.id} />
          </Reanimated.View>
        ) : selectedProduct ? (
          <View style={{ marginTop: 8 }}>
            {days.map((d, index) => {
              const nextDay = days[index + 1];
              const isLastOfPhase = !nextDay || nextDay.phaseId !== d.phaseId;
              // A phase behind the IAP paywall is fully hidden — header and
              // every one of its days — until purchased; the only visible
              // sign of it is the unlock promo card on the previous phase's
              // footer. Once purchased it reappears here like any other
              // phase (lockedPhaseIds no longer contains it).
              if (lockedPhaseIds.has(d.phaseId)) return null;

              const showPhase = d.phase !== lastPhase;
              lastPhase = d.phase;
              const itemDelay = 140 + staggerDelay(index, 20, 10);
              const collapsed = collapsedOverrides[d.phaseId] ?? d.phaseId !== currentPhaseId;
              return (
                <Fragment key={d.id}>
                  {showPhase ? (
                    <Reanimated.View entering={fadeUpEntering(itemDelay)}>
                      <Pressable
                        onPress={() => setCollapsedOverrides((cur) => ({ ...cur, [d.phaseId]: !collapsed }))}
                        style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 18, paddingBottom: 8 }}
                      >
                        <Text
                          style={[
                            theme.type.captionSm,
                            { color: theme.colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.4 },
                          ]}
                        >
                          {d.phase}
                        </Text>
                        <View style={{ transform: [{ rotate: collapsed ? '-90deg' : '0deg' }] }}>
                          <Icon name="chevron-down" size={16} color={theme.colors.textMuted} />
                        </View>
                      </Pressable>
                    </Reanimated.View>
                  ) : null}
                  {!collapsed ? (
                    <Reanimated.View entering={fadeUpEntering(itemDelay)}>
                      <PathNode
                        day={d}
                        isToday={program ? d.id === program.currentDay : false}
                        onPress={() => {
                          // Today's day goes through the discomfort
                          // check-in gate; anything else (and the no-
                          // program preview) opens directly.
                          if (program) {
                            void requestDayGate.requestDay(d, program.userProgramId, program.productId);
                          } else {
                            router.push({
                              pathname: '/day/[dayId]',
                              params: { dayId: String(d.id), productId: selectedProduct.id },
                            });
                          }
                        }}
                      />
                    </Reanimated.View>
                  ) : null}
                  {isLastOfPhase ? (
                    // Always rendered at a phase's end: enabled (quiz
                    // prompt + promos) once every day has run its course,
                    // otherwise a visibly disabled quiz row with a
                    // "complete Day N to unlock" hint.
                    <Reanimated.View entering={fadeUpEntering(itemDelay + 20)} style={{ marginTop: 14, marginBottom: 6 }}>
                      <PhaseFooter
                        userId={userId}
                        productId={selectedProduct.id}
                        phaseId={d.phaseId}
                        phaseName={d.phase}
                        nextPhaseId={nextDay?.phaseId ?? null}
                        nextPhaseName={nextDay?.phase ?? null}
                        unlocked={nextDay ? !lockRequirementsQuery.data?.has(nextDay.phaseId) : true}
                        enabled={phaseAllDone.get(d.phaseId) ?? false}
                        lockedDayNumber={d.id}
                        collapsed={collapsed}
                      />
                    </Reanimated.View>
                  ) : null}
                </Fragment>
              );
            })}
          </View>
        ) : null}
      </ScrollView>
      </KeyboardAvoidingView>
      </Reanimated.View>
      {requestDayGate.pendingDay !== null ? (
        <PainScaleModal
          dayId={requestDayGate.pendingDay}
          onCancel={requestDayGate.cancelPain}
          onConfirm={(value) => void requestDayGate.confirmPain(value)}
          submitting={requestDayGate.isSubmitting}
        />
      ) : null}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  scrollBody: {
    paddingHorizontal: 20,
    paddingBottom: 140,
  },
  header: {
    paddingTop: 12,
    paddingBottom: 4,
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
