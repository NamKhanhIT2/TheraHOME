// The subscription ladder: one card per tier, side by side, swipeable.
//
// Every word on these cards — names, taglines, badges, prices, benefit lines
// and their icons — comes from `subscription_plans` and is edited in WEB
// Admin's "Gói đăng ký" tab, so a price change needs no store release. The
// one thing the admin text does NOT decide is the price actually charged:
// when the store knows the product, its own `displayPrice` wins, because
// that is the number the buyer's card will see.
//
// Layout rule (owner 2026-10-13): the page itself never scrolls. The cards
// take whatever height is left after the dots and the Terms/Privacy lines,
// so those two rows are ALWAYS visible; a card whose benefits do not fit
// scrolls inside itself and says so. The previous version let the whole page
// scroll, which pushed the footer off screen and buried the legal links that
// an auto-renewable subscription is required to show.
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useTheme } from '@/theme';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { BackBar } from '@/components/ui/BackBar';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/icons/Icon';
import { useI18n } from '@/lib/i18n';
import { useSession } from '@/hooks/useSession';
import { useSubscriptionPlans, type SubscriptionPlan } from '@/hooks/useSubscriptionPlans';
import { useActivePlanCode, useSubscriptionPurchase, type SubscriptionPurchaseState } from '@/hooks/useSubscription';

/** Apple's standard EULA. An auto-renewable subscription must link Terms of
 * Use from the screen that sells it, and this is the document that applies
 * unless a custom EULA is uploaded in App Store Connect. Android has no
 * equivalent, so there the link goes to TheraHOME's own terms. */
const APPLE_STANDARD_EULA = 'https://www.apple.com/legal/internet-services/itunes/dev/stdeula/';

/** Card width leaves both neighbours peeking, so it reads as a row to swipe
 * rather than a single page. */
const CARD_GAP = 12;
const PEEK = 36;

/** One shared empty array, so `query.data ?? NO_PLANS` keeps the same
 * reference between renders. */
const NO_PLANS: SubscriptionPlan[] = [];

export default function SubscriptionScreen() {
  const theme = useTheme();
  const { t } = useI18n();
  const { width } = useWindowDimensions();
  const { session } = useSession();
  const query = useSubscriptionPlans();
  const plans = query.data ?? NO_PLANS;
  const activePlanCode = useActivePlanCode(session?.user.id).data ?? null;
  const store = useSubscriptionPurchase(plans);

  const cardWidth = width - PEEK * 2;
  const stride = cardWidth + CARD_GAP;

  const scrollRef = useRef<ScrollView>(null);
  const [active, setActive] = useState(0);
  // Open on the tier Admin marked as the one to try. Guarded by the list's
  // identity so it runs once per list and a swipe is never yanked back, and
  // in an effect because it scrolls a ref that exists only after first paint.
  const landedOn = useRef<string | null>(null);
  useEffect(() => {
    if (!plans.length) return;
    const key = plans.map((plan) => plan.id).join();
    if (landedOn.current === key) return;
    landedOn.current = key;
    const index = Math.max(0, plans.findIndex((plan) => plan.highlighted));
    if (index > 0) {
      setActive(index);
      scrollRef.current?.scrollTo({ x: index * stride, animated: false });
    }
  }, [plans, stride]);

  function onScroll(event: NativeSyntheticEvent<NativeScrollEvent>) {
    const index = Math.round(event.nativeEvent.contentOffset.x / stride);
    setActive(Math.min(Math.max(index, 0), Math.max(plans.length - 1, 0)));
  }

  // The renewal disclosure is specifically about auto-renewing products.
  // Premium Trọn Đời does not renew, so printing it under a one-off purchase
  // would be a false statement about the thing being sold.
  const anyRenewingBuyable = plans.some((plan) => plan.billing === 'subscription' && store.canBuy(plan));
  const storeName = Platform.OS === 'android' ? 'Google Play' : 'App Store';

  function openTerms() {
    if (Platform.OS === 'ios') {
      void WebBrowser.openBrowserAsync(APPLE_STANDARD_EULA);
      return;
    }
    router.push({ pathname: '/profile/legal/[doc]', params: { doc: 'terms' } });
  }

  return (
    <ScreenContainer>
      <BackBar
        onBack={() => router.back()}
        title={t('plansTitle')}
        right={
          // Always offered, never conditional on anything being buyable: a
          // customer reinstalling on a new phone needs it precisely when the
          // app thinks they own nothing, and Apple requires the route to
          // exist. It answers "không tìm thấy giao dịch nào" when there is
          // nothing to find, which is a real answer.
          <Pressable onPress={store.restore} disabled={store.restoring || store.verifying} hitSlop={8}>
            <Text style={[theme.type.captionSm, { color: theme.colors.primary, fontFamily: theme.fontFamily.semiBold }]}>
              {store.restoring ? '…' : t('restorePurchase')}
            </Text>
          </Pressable>
        }
      />
      {query.isPending ? (
        <View style={styles.centered}>
          <ActivityIndicator color={theme.colors.primary} />
        </View>
      ) : query.isError ? (
        <View style={styles.centered}>
          <Text style={[theme.type.bodyStrong, { color: theme.colors.textPrimary, textAlign: 'center' }]}>
            {t('plansLoadErrorTitle')}
          </Text>
          <Text style={[theme.type.body, { color: theme.colors.textSecondary, textAlign: 'center', marginTop: 6 }]}>
            {t('checkNetworkRetry')}
          </Text>
          <Button variant="secondary" style={{ marginTop: 18 }} onPress={() => void query.refetch()}>
            {t('retry')}
          </Button>
        </View>
      ) : plans.length === 0 ? (
        <View style={styles.centered}>
          <Text style={[theme.type.bodyStrong, { color: theme.colors.textPrimary, textAlign: 'center' }]}>
            {t('plansEmptyTitle')}
          </Text>
          <Text style={[theme.type.body, { color: theme.colors.textSecondary, textAlign: 'center', marginTop: 6 }]}>
            {t('plansEmptyBody')}
          </Text>
        </View>
      ) : (
        <>
          {/* flex: 1 — the carousel takes what is left, which is what keeps
              the footer on screen no matter how long a card's benefit list
              is. `stretch` then makes all three cards that same height, so
              their buttons line up. */}
          <ScrollView
            ref={scrollRef}
            horizontal
            style={styles.carousel}
            showsHorizontalScrollIndicator={false}
            snapToInterval={stride}
            decelerationRate="fast"
            disableIntervalMomentum
            onScroll={onScroll}
            scrollEventThrottle={16}
            contentContainerStyle={{ paddingHorizontal: PEEK, gap: CARD_GAP, alignItems: 'stretch', paddingVertical: 8 }}
          >
            {plans.map((plan, index) => (
              <PlanCard
                key={plan.id}
                plan={plan}
                width={cardWidth}
                store={store}
                isCurrent={plan.code === activePlanCode}
                isActive={index === active}
              />
            ))}
          </ScrollView>

          {plans.length > 1 ? (
            <View style={styles.dots}>
              {plans.map((plan, index) => (
                <View
                  key={plan.id}
                  style={[
                    styles.dot,
                    index === active
                      ? { width: 22, backgroundColor: theme.colors.primary }
                      : { backgroundColor: theme.colors.borderInput },
                  ]}
                />
              ))}
            </View>
          ) : null}

          {/* Money on its way, a refunded or lapsed subscription, and an
              actual failure — three different things in three tones, in one
              place under the carousel. */}
          {store.paymentPending ? (
            <Text style={[theme.type.captionSm, styles.notice, { color: theme.colors.warning }]} numberOfLines={3}>
              {t('purchasePending')}
            </Text>
          ) : store.purchaseError ? (
            <Text style={[theme.type.captionSm, styles.notice, { color: theme.colors.error }]} numberOfLines={3}>
              {store.purchaseError === 'restore_not_found'
                ? t('restoreNotFound')
                : store.purchaseError === 'purchase_revoked'
                  ? t('purchaseRefunded')
                  : store.purchaseError === 'subscription_expired'
                    ? t('plansExpired')
                    : store.purchaseError === 'claimed_by_other'
                      ? t('purchaseClaimedByOther')
                      : t('purchaseFailed')}
            </Text>
          ) : anyRenewingBuyable ? (
            <Text style={[theme.type.captionSm, styles.notice, { color: theme.colors.textMuted }]} numberOfLines={2}>
              {t('plansAutoRenewNote', { store: storeName })}
            </Text>
          ) : null}

          <View style={styles.footerRow}>
            <Pressable style={styles.footerItem} hitSlop={6} onPress={openTerms}>
              <Icon name="file-text" size={13} color={theme.colors.textMuted} />
              <Text style={[theme.type.captionSm, { color: theme.colors.textMuted }]} numberOfLines={1}>
                {t('terms')}
              </Text>
            </Pressable>
            <View style={[styles.footerDivider, { backgroundColor: theme.colors.borderInput }]} />
            <Pressable
              style={styles.footerItem}
              hitSlop={6}
              onPress={() => router.push({ pathname: '/profile/legal/[doc]', params: { doc: 'privacy' } })}
            >
              <Icon name="shield-check" size={13} color={theme.colors.textMuted} />
              <Text style={[theme.type.captionSm, { color: theme.colors.textMuted }]} numberOfLines={1}>
                {t('paywallSecurity')}
              </Text>
            </Pressable>
          </View>
        </>
      )}
    </ScreenContainer>
  );
}

function PlanCard({
  plan,
  width,
  store,
  isCurrent,
  isActive,
}: {
  plan: SubscriptionPlan;
  width: number;
  store: SubscriptionPurchaseState;
  isCurrent: boolean;
  /** The card currently centred in the viewport. The accent treatment
   * follows the swipe rather than staying on whichever tier Admin marked as
   * highlighted — that flag decides where the screen OPENS, and after that
   * the card you are looking at is the one being considered (owner
   * 2026-10-13). */
  isActive: boolean;
}) {
  const theme = useTheme();
  const { t } = useI18n();
  const product = store.productFor(plan);
  const canBuy = store.canBuy(plan) && !isCurrent;
  const busy = store.pendingPlanCode === plan.code;
  // The store's price beats the admin label: it is the real amount in the
  // buyer's own currency, and it stays right after a price change on the
  // store side that nobody remembered to mirror into WEB Admin.
  const priceLabel = product?.displayPrice ?? plan.priceLabel;

  // Whether the benefit list is taller than the space it has. Measured
  // rather than guessed, because it depends on the device's text size as
  // much as on how many lines Admin wrote.
  const [overflow, setOverflow] = useState(false);
  const [atBottom, setAtBottom] = useState(false);
  const viewport = useRef(0);
  const content = useRef(0);
  function measure() {
    setOverflow(content.current > viewport.current + 4);
  }

  return (
    // The badge straddles the card's top border, so the wrapper carries the
    // space it needs and the card starts below it. The badge renders AFTER
    // the card: on Android the card's elevation shadow paints over an earlier
    // sibling whatever its zIndex says.
    <View style={{ width }}>
      <View
        style={[
          styles.card,
          theme.shadows.card,
          {
            marginTop: plan.badge ? 13 : 0,
            backgroundColor: theme.colors.bgCard,
            borderRadius: theme.radius.lg,
            borderColor: isActive ? theme.colors.primary : theme.colors.divider,
            borderWidth: isActive ? 2 : 1,
          },
        ]}
      >
        <Text style={[theme.type.h1, { color: theme.colors.textPrimary, textAlign: 'center' }]} numberOfLines={2}>
          {plan.name}
        </Text>
        {plan.tagline ? (
          <Text style={[theme.type.body, { color: theme.colors.textSecondary, textAlign: 'center', marginTop: 6, lineHeight: 21 }]} numberOfLines={2}>
            {plan.tagline}
          </Text>
        ) : null}

        {priceLabel ? (
          <View style={styles.priceRow}>
            <Text style={[theme.type.h1, { color: theme.colors.primary, fontSize: 30, lineHeight: 36 }]}>{priceLabel}</Text>
            {plan.periodLabel ? (
              <Text style={[theme.type.captionSm, { color: theme.colors.textSecondary }]}>/{plan.periodLabel}</Text>
            ) : null}
          </View>
        ) : null}

        {/* The only flexible part of the card, so the button below stays put
            and the page never grows. minHeight 0 is what lets a flex child
            actually shrink enough for its own ScrollView to scroll. */}
        <View style={styles.featuresArea}>
          <ScrollView
            showsVerticalScrollIndicator={false}
            scrollEventThrottle={16}
            onLayout={(event) => {
              viewport.current = event.nativeEvent.layout.height;
              measure();
            }}
            onContentSizeChange={(_, height) => {
              content.current = height;
              measure();
            }}
            onScroll={(event) => {
              const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
              setAtBottom(contentOffset.y + layoutMeasurement.height >= contentSize.height - 8);
            }}
          >
            <View style={{ gap: 12, paddingBottom: 4 }}>
              {plan.features.map((feature, index) => (
                <View key={`${feature.text}-${index}`} style={styles.featureRow}>
                  <View style={[styles.featureIcon, { backgroundColor: theme.colors.primaryTint10 }]}>
                    <Icon name={feature.icon || 'check'} size={13} color={theme.colors.primary} />
                  </View>
                  <Text style={[theme.type.body, { color: theme.colors.textPrimary, flex: 1, lineHeight: 21 }]}>{feature.text}</Text>
                </View>
              ))}
            </View>
          </ScrollView>
          {/* Says there is more, and gets out of the way once you reach it.
              A list that is cut off with no sign of it reads as a bug. */}
          {overflow && !atBottom ? (
            <View style={[styles.scrollHint, { backgroundColor: theme.colors.bgCard }]} pointerEvents="none">
              <Text style={[theme.type.captionSm, { color: theme.colors.textMuted }]}>{t('plansScrollMore')}</Text>
              <Icon name="chevron-down" size={12} color={theme.colors.textMuted} />
            </View>
          ) : null}
        </View>

        <Button
          variant={canBuy ? 'primary' : 'secondary'}
          disabled={!canBuy}
          loading={busy}
          style={{ width: '100%', marginTop: 16 }}
          onPress={canBuy ? () => store.buy(plan) : undefined}
        >
          {isCurrent ? t('plansCurrentPlan') : store.verifying && busy ? t('purchaseVerifying') : t('plansBuy')}
        </Button>

        {/* The discount this tier includes, shown ONLY to whoever holds it —
            a code everybody can read is a public discount, not a benefit. */}
        {isCurrent && plan.perkDiscountCode ? (
          <View style={[styles.perk, { borderColor: theme.colors.primary, borderRadius: theme.radius.md }]}>
            <Text style={[theme.type.captionSm, { color: theme.colors.textSecondary }]}>
              {t('plansPerkDiscount', { percent: String(plan.perkDiscountPercent ?? '') })}
            </Text>
            <Text style={[theme.type.bodyStrong, { color: theme.colors.primary, letterSpacing: 1 }]} selectable>
              {plan.perkDiscountCode}
            </Text>
          </View>
        ) : null}
      </View>
      {plan.badge ? (
        <View style={styles.badgeRow} pointerEvents="none">
          <View style={[styles.badge, { backgroundColor: theme.colors.primary, borderRadius: theme.radius.sm }]}>
            <Text style={[theme.type.captionSm, { color: theme.colors.textOnPrimary, fontFamily: theme.fontFamily.bold }]} numberOfLines={1}>
              {plan.badge}
            </Text>
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  carousel: {
    flex: 1,
  },
  notice: {
    textAlign: 'center',
    paddingHorizontal: 32,
    marginTop: 10,
    lineHeight: 18,
  },
  card: {
    padding: 20,
    overflow: 'hidden',
    flex: 1,
  },
  featuresArea: {
    flex: 1,
    minHeight: 0,
    marginTop: 16,
  },
  scrollHint: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingTop: 6,
    paddingBottom: 2,
  },
  // Full-width row that only centres; the pill inside keeps its own size, so
  // nothing depends on how Yoga aligns an inset-less absolute child.
  badgeRow: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  badge: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    maxWidth: '80%',
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    gap: 3,
    marginTop: 14,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  featureIcon: {
    width: 22,
    height: 22,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  perk: {
    marginTop: 12,
    borderWidth: 1,
    borderStyle: 'dashed',
    paddingVertical: 10,
    paddingHorizontal: 12,
    alignItems: 'center',
    gap: 2,
  },
  dots: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 12,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 999,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
    marginTop: 14,
    marginBottom: 6,
  },
  footerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  footerDivider: {
    width: 1,
    height: 12,
  },
});
