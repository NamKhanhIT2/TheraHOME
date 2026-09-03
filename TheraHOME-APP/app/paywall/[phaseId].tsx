import React, { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Reanimated, { FadeIn } from 'react-native-reanimated';
import { useTheme } from '@/theme';
import { useSession } from '@/hooks/useSession';
import { usePhasePromo } from '@/hooks/usePhasePromo';
import { usePhasePurchases, usePurchasePhase } from '@/hooks/usePhasePurchase';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { RemoteImage } from '@/components/ui/RemoteImage';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/icons/Icon';
import { useI18n } from '@/lib/i18n';

/** Full-screen paywall for one payment-gated phase, opened from
 * `PhaseUnlockPromo`'s "Mở khoá ngay" button. Every content block (hero
 * image, badge, title, subtitle, benefit list, package name/description and
 * the fallback price label) is admin-authored in `phase_promos` via WEB
 * Admin's "Quản lý Quiz & Upsell" modal, with i18n defaults when unset. The
 * CTA price prefers the live StoreKit `displayPrice`; `unlock_price_label`
 * only covers builds/environments where StoreKit can't answer. */
export default function PaywallScreen() {
  const theme = useTheme();
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  const { phaseId, phaseName } = useLocalSearchParams<{ phaseId: string; phaseName?: string }>();
  const { session } = useSession();
  const userId = session?.user.id;

  const promoQuery = usePhasePromo(phaseId);
  const promo = promoQuery.data;
  const purchasesQuery = usePhasePurchases(userId);
  const [purchasedNow, setPurchasedNow] = useState(false);
  const { product, purchase, restore, verifying, restoring, purchaseError, connected } = usePurchasePhase(
    phaseId,
    { apple: promo?.appleProductId ?? null, google: promo?.googleProductId ?? null },
    { onVerified: () => setPurchasedNow(true) },
  );

  const title = promo?.unlockTitle ?? t('unlockGiaiDoan', { phase: phaseName ?? '' }).trim();
  const unlocked = purchasedNow || !!purchasesQuery.data?.has(phaseId);
  const busy = verifying || restoring;
  const purchaseDisabled = busy || !connected;
  const benefits = promo?.unlockBenefits?.length
    ? promo.unlockBenefits
    : [t('paywallBenefit1'), t('paywallBenefit2'), t('paywallBenefit3')];
  const priceLabel = product?.displayPrice ?? promo?.unlockPriceLabel ?? null;

  return (
    // Bottom-only safe area: the hero image deliberately bleeds under the
    // status bar (full-screen-paywall style); the X button offsets itself by
    // the top inset instead.
    <ScreenContainer edges={['bottom']}>
      {promoQuery.isPending ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator color={theme.colors.primary} />
        </View>
      ) : unlocked ? (
        <Reanimated.View entering={FadeIn.duration(220)} style={styles.resultBody}>
          <View style={[styles.resultIcon, { backgroundColor: theme.colors.successTint }]}>
            <Icon name="check" size={30} color={theme.colors.success} />
          </View>
          <Text style={[theme.type.h1, { color: theme.colors.textPrimary, textAlign: 'center' }]}>
            {t('paywallUnlockedTitle')}
          </Text>
          <Text style={[theme.type.body, { color: theme.colors.textSecondary, textAlign: 'center', marginTop: 6 }]}>
            {t('paywallUnlockedBody', { phase: phaseName ?? '' })}
          </Text>
          <Button style={{ width: '100%', marginTop: 24 }} onPress={() => router.back()}>
            {t('continue')}
          </Button>
        </Reanimated.View>
      ) : (
        <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
          {/* Hero — bleeds edge-to-edge under the status bar */}
          <View
            style={[
              styles.heroWrap,
              {
                backgroundColor: theme.colors.primaryTint10,
                borderBottomLeftRadius: theme.radius.xl,
                borderBottomRightRadius: theme.radius.xl,
              },
            ]}
          >
            {promo?.unlockImageUrl ? (
              // expo-image (disk-cached): shares the cache PhaseUnlockPromo
              // pre-warms from the roadmap, so the hero is instant on
              // revisits instead of re-downloading each open.
              <RemoteImage uri={promo.unlockImageUrl} contentFit="cover" style={styles.heroImage} />
            ) : (
              <View style={styles.heroPlaceholder}>
                <Icon name="lock" size={48} color={theme.colors.primary} />
              </View>
            )}
          </View>
          <Pressable
            onPress={() => router.back()}
            hitSlop={8}
            style={[styles.closeBtn, theme.shadows.card, { backgroundColor: theme.colors.bgCard, top: insets.top + 8 }]}
          >
            <Icon name="x" size={20} color={theme.colors.textPrimary} />
          </Pressable>

          <View style={styles.content}>
            {/* Badge */}
            <View style={[styles.badge, { backgroundColor: theme.colors.warningTint }]}>
              <Icon name="lock" size={12} color={theme.colors.warning} />
              <Text style={[theme.type.captionSm, { color: theme.colors.warning, fontFamily: theme.fontFamily.semiBold }]}>
                {promo?.unlockBadge ?? t('paywallBadge')}
              </Text>
            </View>

            {/* Title + subtitle */}
            <Text style={[theme.type.h1, { color: theme.colors.textPrimary, marginTop: 10 }]}>{title}</Text>
            {promo?.unlockSubtitle || promo?.unlockDescription ? (
              <Text style={[theme.type.body, { color: theme.colors.textSecondary, marginTop: 4, lineHeight: 21 }]}>
                {promo.unlockSubtitle ?? promo.unlockDescription}
              </Text>
            ) : null}

            {/* Benefits */}
            <View style={[styles.card, theme.shadows.card, { backgroundColor: theme.colors.bgCard, borderRadius: theme.radius.lg, marginTop: 16 }]}>
              {benefits.map((benefit, index) => (
                <View key={benefit} style={[styles.benefitRow, index > 0 && { marginTop: 14 }]}>
                  <View style={[styles.benefitIcon, { backgroundColor: theme.colors.primary }]}>
                    <Icon name="check" size={12} color="#fff" />
                  </View>
                  <Text style={[theme.type.body, { color: theme.colors.textPrimary, flex: 1 }]}>{benefit}</Text>
                </View>
              ))}
            </View>

            {/* Package / price */}
            <View style={[styles.card, styles.packageRow, theme.shadows.card, { backgroundColor: theme.colors.bgCard, borderRadius: theme.radius.lg, marginTop: 14 }]}>
              <View style={[styles.packageIcon, { backgroundColor: theme.colors.primary, borderRadius: theme.radius.md }]}>
                <Icon name="crown" size={22} color="#fff" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[theme.type.bodyStrong, { color: theme.colors.textPrimary }]}>
                  {promo?.unlockPackageName ?? t('paywallPackageName')}
                </Text>
                <Text style={[theme.type.captionSm, { color: theme.colors.textSecondary, marginTop: 2 }]}>
                  {promo?.unlockPackageDesc ?? t('paywallPackageDesc')}
                </Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                {priceLabel ? (
                  <Text style={[theme.type.h2, { color: theme.colors.primary }]}>{priceLabel}</Text>
                ) : null}
                <Text style={[theme.type.captionSm, { color: theme.colors.textSecondary }]}>{t('paywallPriceSuffix')}</Text>
              </View>
            </View>

            {purchaseError ? (
              <Text style={[theme.type.captionSm, { color: theme.colors.error, textAlign: 'center', marginTop: 12 }]}>
                {purchaseError === 'restore_not_found' ? t('restoreNotFound') : t('purchaseFailed')}
              </Text>
            ) : null}

            {/* CTA */}
            <Button
              style={{ width: '100%', marginTop: purchaseError ? 8 : 16 }}
              disabled={purchaseDisabled}
              loading={busy}
              onPress={purchase}
              icon={!busy ? <Icon name="lock" size={16} color={theme.colors.textOnPrimary} /> : undefined}
            >
              {verifying ? t('purchaseVerifying') : t('unlockNow')}
            </Button>

            {/* Footer links — restore first (per request 2026-09-03). Each
                item can shrink and its label stays on one line with a capped
                font scale, so all three fit on narrow screens without
                clipping. */}
            <View style={styles.footerRow}>
              <Pressable style={styles.footerItem} hitSlop={6} onPress={restore} disabled={busy || !connected}>
                <Icon name="rotate-ccw" size={13} color={theme.colors.textMuted} />
                <Text style={[theme.type.captionSm, styles.footerLabel, { color: theme.colors.textMuted }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8} maxFontSizeMultiplier={1.2}>
                  {t('restorePurchase')}
                </Text>
              </Pressable>
              <View style={[styles.footerDivider, { backgroundColor: theme.colors.borderInput }]} />
              <Pressable style={styles.footerItem} hitSlop={6} onPress={() => router.push({ pathname: '/profile/legal/[doc]', params: { doc: 'terms' } })}>
                <Icon name="file-text" size={13} color={theme.colors.textMuted} />
                <Text style={[theme.type.captionSm, styles.footerLabel, { color: theme.colors.textMuted }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8} maxFontSizeMultiplier={1.2}>
                  {t('terms')}
                </Text>
              </Pressable>
              <View style={[styles.footerDivider, { backgroundColor: theme.colors.borderInput }]} />
              <Pressable style={styles.footerItem} hitSlop={6} onPress={() => router.push({ pathname: '/profile/legal/[doc]', params: { doc: 'privacy' } })}>
                <Icon name="shield-check" size={13} color={theme.colors.textMuted} />
                <Text style={[theme.type.captionSm, styles.footerLabel, { color: theme.colors.textMuted }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8} maxFontSizeMultiplier={1.2}>
                  {t('paywallSecurity')}
                </Text>
              </Pressable>
            </View>
          </View>
        </ScrollView>
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  loadingBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    flexGrow: 1,
    paddingBottom: 26,
  },
  content: {
    paddingHorizontal: 16,
  },
  heroWrap: {
    width: '100%',
    height: 360,
    overflow: 'hidden',
  },
  heroImage: {
    width: '100%',
    height: '100%',
  },
  heroPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtn: {
    position: 'absolute',
    left: 16,
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    marginTop: 16,
  },
  card: {
    padding: 16,
  },
  benefitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  benefitIcon: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  packageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  packageIcon: {
    width: 46,
    height: 46,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 16,
    // The three Vietnamese labels need a bit more than the content column's
    // width — let the row borrow the padding gutter instead of ellipsizing.
    marginHorizontal: -10,
  },
  footerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    flexShrink: 1,
    minWidth: 0,
  },
  footerLabel: {
    flexShrink: 1,
  },
  footerDivider: {
    width: 1,
    height: 14,
  },
  resultBody: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  resultIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },
});
