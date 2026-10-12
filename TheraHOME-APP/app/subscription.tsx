// The subscription ladder: one card per tier, side by side, swipeable.
//
// Every word on these cards — names, taglines, badges, prices, benefit lines
// and their icons — comes from `subscription_plans` and is edited in WEB
// Admin's "Gói đăng ký" tab, so the offer changes without a store release.
// The one thing the admin text does NOT decide is the price actually
// charged: when the store knows the product, its own `displayPrice` wins,
// because that is the number the buyer's card will see.
//
// Buying goes through src/hooks/useSubscription.ts. A card's button is only
// live when BOTH the build says subscriptions are on (SUBSCRIPTIONS_ENABLED)
// and the store has returned that product — so a product id typed into WEB
// Admin cannot, by itself, offer a purchase that would fail.
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
 * unless a custom EULA is uploaded in App Store Connect — the same link
 * every other App Store subscription screen points at. Android has no
 * equivalent, so there the link goes to TheraHOME's own terms. */
const APPLE_STANDARD_EULA = 'https://www.apple.com/legal/internet-services/itunes/dev/stdeula/';

/** Card width leaves both neighbours peeking, so it reads as a row to swipe
 * rather than a single page. */
const CARD_GAP = 12;
const PEEK = 36;

/** One shared empty array, so `query.data ?? NO_PLANS` keeps the same
 * reference between renders — a fresh `[]` would make every memo and effect
 * downstream see a change on every render. */
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
  // Open on the tier Admin marked as the one to try, not on the free one.
  // Guarded by the list's identity, not by a boolean, so it runs once per
  // list and a swipe is never yanked back — and in an effect, not in render,
  // because it scrolls a ref that only exists after the first paint.
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

  // Restore and the renewal disclosure both describe buying, so neither
  // belongs on screen while nothing can be bought.
  const anythingBuyable = plans.some((plan) => store.canBuy(plan));
  // The renewal disclosure is specifically about auto-renewing products.
  // Premium Trọn Đời does not renew, so saying it does would be a false
  // statement about the thing being sold — the opposite of what the rule is
  // for.
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
          anythingBuyable ? (
            <Pressable onPress={store.restore} disabled={store.restoring || store.verifying} hitSlop={8}>
              <Text style={[theme.type.captionSm, { color: theme.colors.primary, fontFamily: theme.fontFamily.semiBold }]}>
                {t('restorePurchase')}
              </Text>
            </Pressable>
          ) : undefined
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
        <ScrollView contentContainerStyle={styles.page} showsVerticalScrollIndicator={false}>
          <Text style={[theme.type.body, styles.intro, { color: theme.colors.textSecondary }]}>{t('plansIntro')}</Text>

          <ScrollView
            ref={scrollRef}
            horizontal
            showsHorizontalScrollIndicator={false}
            snapToInterval={stride}
            decelerationRate="fast"
            disableIntervalMomentum
            onScroll={onScroll}
            scrollEventThrottle={16}
            // `stretch` is what makes all three cards as tall as the tallest
            // one, so a tier with fewer benefits does not sit short next to
            // its neighbours. Each card then pushes its button to the bottom.
            contentContainerStyle={{ paddingHorizontal: PEEK, gap: CARD_GAP, alignItems: 'stretch' }}
          >
            {plans.map((plan) => (
              <PlanCard
                key={plan.id}
                plan={plan}
                width={cardWidth}
                store={store}
                isCurrent={plan.code === activePlanCode}
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

          {/* Three different things in three different tones: money on its
              way (not an error), a refunded or lapsed subscription, and an
              actual failure. One place for all of them, under the carousel —
              a message inside a card would scroll out of sight. */}
          {store.paymentPending ? (
            <Text style={[theme.type.captionSm, styles.notice, { color: theme.colors.warning }]}>{t('purchasePending')}</Text>
          ) : store.purchaseError ? (
            <Text style={[theme.type.captionSm, styles.notice, { color: theme.colors.error }]}>
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
          ) : null}

          {anyRenewingBuyable ? (
            <Text style={[theme.type.captionSm, styles.notice, { color: theme.colors.textMuted }]}>
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
        </ScrollView>
      )}
    </ScreenContainer>
  );
}

function PlanCard({
  plan,
  width,
  store,
  isCurrent,
}: {
  plan: SubscriptionPlan;
  width: number;
  store: SubscriptionPurchaseState;
  isCurrent: boolean;
}) {
  const theme = useTheme();
  const { t } = useI18n();
  const product = store.productFor(plan);
  const canBuy = store.canBuy(plan) && !isCurrent;
  const busy = store.pendingPlanCode === plan.code || (store.verifying && store.pendingPlanCode === plan.code);
  // The store's price beats the admin label: it is the real amount in the
  // buyer's own currency, and it stays right after a price change on the
  // store side that nobody remembered to mirror in WEB Admin.
  const priceLabel = product?.displayPrice ?? plan.priceLabel;

  return (
    // The badge straddles the card's top border, so the wrapper carries the
    // space it needs and the card starts below it. The badge is rendered
    // AFTER the card, not before: on Android the card's elevation shadow
    // paints over an earlier sibling whatever its zIndex says.
    <View style={{ width }}>
      <View
        style={[
          styles.card,
          theme.shadows.card,
          {
            marginTop: plan.badge ? 13 : 0,
            backgroundColor: theme.colors.bgCard,
            borderRadius: theme.radius.lg,
            borderColor: plan.highlighted ? theme.colors.primary : theme.colors.divider,
            borderWidth: plan.highlighted ? 2 : 1,
          },
        ]}
      >
        <Text style={[theme.type.h1, { color: theme.colors.textPrimary, textAlign: 'center' }]} numberOfLines={2}>
          {plan.name}
        </Text>
        {plan.tagline ? (
          <Text style={[theme.type.body, { color: theme.colors.textSecondary, textAlign: 'center', marginTop: 6, lineHeight: 21 }]}>
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

        {/* flexGrow, so the button below lands at the bottom of the tallest
            card instead of floating mid-air on the shorter ones. */}
        <View style={{ marginTop: 18, gap: 12, flexGrow: 1 }}>
          {plan.features.map((feature, index) => (
            <View key={`${feature.text}-${index}`} style={styles.featureRow}>
              <View style={[styles.featureIcon, { backgroundColor: theme.colors.primaryTint10 }]}>
                <Icon name={feature.icon || 'check'} size={13} color={theme.colors.primary} />
              </View>
              <Text style={[theme.type.body, { color: theme.colors.textPrimary, flex: 1, lineHeight: 21 }]}>{feature.text}</Text>
            </View>
          ))}
        </View>

        <Button
          variant={canBuy ? 'primary' : 'secondary'}
          disabled={!canBuy}
          loading={busy}
          style={{ width: '100%', marginTop: 20 }}
          onPress={canBuy ? () => store.buy(plan) : undefined}
        >
          {isCurrent
            ? t('plansCurrentPlan')
            : canBuy
              ? t('plansChoose')
              : store.verifying
                ? t('purchaseVerifying')
                : t('plansComingSoon')}
        </Button>
        {!isCurrent && !canBuy ? (
          <Text style={[theme.type.captionSm, { color: theme.colors.textMuted, textAlign: 'center', marginTop: 8 }]}>
            {t('plansComingSoonHint')}
          </Text>
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
  page: {
    paddingTop: 8,
    paddingBottom: 28,
  },
  intro: {
    textAlign: 'center',
    paddingHorizontal: 32,
    marginBottom: 20,
    lineHeight: 21,
  },
  notice: {
    textAlign: 'center',
    paddingHorizontal: 32,
    marginTop: 16,
    lineHeight: 18,
  },
  card: {
    padding: 20,
    overflow: 'hidden',
    flex: 1,
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
  dots: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 20,
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
    marginTop: 22,
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
