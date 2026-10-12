// The subscription ladder: one card per tier, side by side, swipeable.
//
// Every word on these cards — names, taglines, badges, prices, benefit lines
// and their icons — comes from `subscription_plans` and is edited in WEB
// Admin's "Gói đăng ký" tab. Nothing about the offer is written here, so a
// price change needs no store release.
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
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
import { useTheme } from '@/theme';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { BackBar } from '@/components/ui/BackBar';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/icons/Icon';
import { useI18n } from '@/lib/i18n';
import { useSubscriptionPlans, type SubscriptionPlan } from '@/hooks/useSubscriptionPlans';

/**
 * Whether a paid tier can actually be bought. False, and not a placeholder:
 * no subscription product exists in App Store Connect or Play Console,
 * nothing verifies a recurring receipt server-side, and no table records who
 * holds which tier. There is no purchase to start, so every paid card says
 * "Sắp mở" — which is true — and no button pretends otherwise.
 *
 * Deliberately a constant here rather than keyed off the product id in WEB
 * Admin: typing an id into the "Gói đăng ký" tab is editing copy, and copy
 * must not be able to light up a buy button on its own. Flip this in the
 * same change that adds the purchase call and the entitlement check, not
 * before.
 */
const CAN_BUY_A_SUBSCRIPTION = false;

/** Card width leaves both neighbours peeking, so it reads as a row to swipe
 * rather than a single page. */
const CARD_GAP = 12;
const PEEK = 36;

/** One shared empty array, so `query.data ?? NO_PLANS` keeps the same
 * reference between renders — a fresh `[]` would re-run the landing effect
 * below on every render. */
const NO_PLANS: SubscriptionPlan[] = [];

export default function SubscriptionScreen() {
  const theme = useTheme();
  const { t } = useI18n();
  const { width } = useWindowDimensions();
  const query = useSubscriptionPlans();
  const plans = query.data ?? NO_PLANS;

  const cardWidth = width - PEEK * 2;
  const stride = cardWidth + CARD_GAP;

  const scrollRef = useRef<ScrollView>(null);
  const [active, setActive] = useState(0);
  // Open on the tier Admin marked as the one to try, not on the free one.
  // Done once per load (not on every render) so a swipe is never yanked back.
  const landedOn = useRef<string | null>(null);
  useEffect(() => {
    if (!plans.length) return;
    const key = plans.map((plan) => plan.id).join();
    if (landedOn.current === key) return;
    landedOn.current = key;
    const index = Math.max(0, plans.findIndex((plan) => plan.highlighted));
    setActive(index);
    if (index > 0) scrollRef.current?.scrollTo({ x: index * stride, animated: false });
  }, [plans, stride]);

  function onScroll(event: NativeSyntheticEvent<NativeScrollEvent>) {
    const index = Math.round(event.nativeEvent.contentOffset.x / stride);
    setActive(Math.min(Math.max(index, 0), Math.max(plans.length - 1, 0)));
  }

  return (
    <ScreenContainer>
      <BackBar onBack={() => router.back()} title={t('plansTitle')} />
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
              <PlanCard key={plan.id} plan={plan} width={cardWidth} />
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

          <View style={styles.footerRow}>
            <Pressable
              style={styles.footerItem}
              hitSlop={6}
              onPress={() => router.push({ pathname: '/profile/legal/[doc]', params: { doc: 'terms' } })}
            >
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

function PlanCard({ plan, width }: { plan: SubscriptionPlan; width: number }) {
  const theme = useTheme();
  const { t } = useI18n();
  const canBuy = CAN_BUY_A_SUBSCRIPTION && !plan.isFree && !!plan.storeProductId;

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

        {plan.priceLabel ? (
          <View style={styles.priceRow}>
            <Text style={[theme.type.h1, { color: theme.colors.primary, fontSize: 30, lineHeight: 36 }]}>{plan.priceLabel}</Text>
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

        {/* "Gói hiện tại của bạn" on the free tier is a statement about
            today, not a lookup: nobody can hold a paid tier yet, so everyone
            is on the free one. The moment a purchase can succeed this has to
            read the user's entitlement instead of `isFree`. */}
        <Button
          variant={canBuy ? 'primary' : 'secondary'}
          disabled={!canBuy}
          style={{ width: '100%', marginTop: 20 }}
          onPress={canBuy ? () => { /* the purchase call lands here with CAN_BUY_A_SUBSCRIPTION */ } : undefined}
        >
          {plan.isFree ? t('plansCurrentPlan') : canBuy ? t('plansChoose') : t('plansComingSoon')}
        </Button>
        {!plan.isFree && !canBuy ? (
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
