import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useTheme } from '@/theme';
import { Icon } from '@/components/icons/Icon';
import { RemoteImage } from '@/components/ui/RemoteImage';
import { ExternalLinkModal } from '@/components/ExternalLinkModal';
import { usePhasePromo } from '@/hooks/usePhasePromo';
import { useI18n } from '@/lib/i18n';

export interface PhaseUnlockPromoProps {
  phaseId: string;
  phaseName: string;
  /** Already verified for this phase — hides the unlock card entirely. */
  unlocked: boolean;
}

/** Shown once a phase's quiz is completed: an optional physical-product
 * cross-sell card (plain external links — Apple exempts physical goods from
 * IAP) and, unless already unlocked, the next-phase unlock card (must go
 * through real Apple IAP per App Store Review Guideline 3.1.1, since it
 * unlocks digital content inside the app). Either card is simply omitted if
 * admin hasn't configured that half of `phase_promos` for this phase. Each
 * card is a left image / right title+description+buttons split, matching
 * the supplied reference layout. */
export function PhaseUnlockPromo({ phaseId, phaseName, unlocked }: PhaseUnlockPromoProps) {
  const theme = useTheme();
  const { t } = useI18n();
  const [pendingUrl, setPendingUrl] = useState<string | null>(null);
  const { data: promo, isPending } = usePhasePromo(phaseId);

  // Warm expo-image's DISK cache with both card images (and the paywall's
  // hero) as soon as the promo row loads. Must be expo-image's prefetch —
  // RN Image.prefetch fills a different cache the RemoteImage-based cards
  // and paywall hero never read, which is why the hero used to show a blank
  // panel for a while on first open.
  const unlockImageUrl = promo?.unlockImageUrl;
  const crossSellImageUrl = promo?.crossSellImageUrl;
  useEffect(() => {
    const urls = [unlockImageUrl, crossSellImageUrl].filter((u): u is string => !!u);
    if (urls.length) void ExpoImage.prefetch(urls, { cachePolicy: 'disk' }).catch(() => {});
  }, [unlockImageUrl, crossSellImageUrl]);

  if (isPending || !promo) return null;

  const hasCrossSell = !!(promo.crossSellTitle || promo.crossSellDescription);
  const hasUnlock = !unlocked && !!promo.appleProductId;
  if (!hasCrossSell && !hasUnlock) return null;

  return (
    <View style={{ gap: 14 }}>
      {hasCrossSell ? (
        <View style={[styles.card, theme.shadows.card, { backgroundColor: theme.colors.bgCard, borderRadius: theme.radius.lg }]}>
          {promo.crossSellImageUrl ? (
            <RemoteImage uri={promo.crossSellImageUrl} contentFit="cover" style={[styles.image, { borderTopLeftRadius: theme.radius.lg, borderBottomLeftRadius: theme.radius.lg }]} />
          ) : (
            <View style={[styles.image, styles.imagePlaceholder, { backgroundColor: theme.colors.primaryTint10, borderTopLeftRadius: theme.radius.lg, borderBottomLeftRadius: theme.radius.lg }]}>
              <Icon name="sparkles" size={30} color={theme.colors.primary} />
            </View>
          )}
          <View style={styles.content}>
            <View style={styles.titleRow}>
              <Text style={[theme.type.bodyStrong, { color: theme.colors.textPrimary, flexShrink: 1 }]} numberOfLines={2}>
                {promo.crossSellTitle}
              </Text>
              {promo.crossSellBadge ? (
                <View style={[styles.badge, { backgroundColor: theme.colors.primary }]}>
                  <Text style={[theme.type.captionSm, { color: '#fff', fontFamily: theme.fontFamily.bold }]}>{promo.crossSellBadge}</Text>
                </View>
              ) : null}
            </View>
            {promo.crossSellDescription ? (
              <Text style={[theme.type.captionSm, { color: theme.colors.textSecondary, marginTop: 4, lineHeight: 16 }]} numberOfLines={3}>
                {promo.crossSellDescription}
              </Text>
            ) : null}
            <View style={{ marginTop: 10, gap: 6 }}>
              {promo.crossSellCtaUrl ? (
                <Pressable
                  style={[styles.btnFilled, { backgroundColor: theme.colors.primary, borderRadius: theme.radius.sm }]}
                  onPress={() => setPendingUrl(promo.crossSellCtaUrl)}
                >
                  <Text style={[theme.type.captionSm, { color: '#fff', fontFamily: theme.fontFamily.semiBold }]}>{t('learnMore')}</Text>
                  <Icon name="chevron-right" size={13} color="#fff" />
                </Pressable>
              ) : null}
              {promo.crossSellVideoUrl ? (
                <Pressable
                  style={[styles.btnOutline, { borderColor: theme.colors.borderInput, borderRadius: theme.radius.sm }]}
                  onPress={() => void WebBrowser.openBrowserAsync(promo.crossSellVideoUrl!)}
                >
                  <Icon name="play" size={12} color={theme.colors.primary} />
                  <Text style={[theme.type.captionSm, { color: theme.colors.primary, fontFamily: theme.fontFamily.semiBold }]}>{t('watchIntroVideo')}</Text>
                </Pressable>
              ) : null}
            </View>
          </View>
        </View>
      ) : null}

      {hasUnlock ? (
        <View style={[styles.card, theme.shadows.card, { backgroundColor: theme.colors.bgCard, borderRadius: theme.radius.lg }]}>
          {promo.unlockImageUrl ? (
            <RemoteImage uri={promo.unlockImageUrl} contentFit="cover" style={[styles.image, { borderTopLeftRadius: theme.radius.lg, borderBottomLeftRadius: theme.radius.lg }]} />
          ) : (
            <View style={[styles.image, styles.imagePlaceholder, { backgroundColor: theme.colors.primaryTint10, borderTopLeftRadius: theme.radius.lg, borderBottomLeftRadius: theme.radius.lg }]}>
              <Icon name="lock" size={30} color={theme.colors.primary} />
            </View>
          )}
          <View style={styles.content}>
            <View style={styles.titleRow}>
              <Text style={[theme.type.bodyStrong, { color: theme.colors.textPrimary, flexShrink: 1 }]} numberOfLines={2}>
                {t('unlockGiaiDoan', { phase: phaseName })}
              </Text>
              <Icon name="lock" size={15} color={theme.colors.textMuted} />
            </View>
            {promo.unlockDescription ? (
              <Text style={[theme.type.captionSm, { color: theme.colors.textSecondary, marginTop: 4, lineHeight: 16 }]} numberOfLines={3}>
                {promo.unlockDescription}
              </Text>
            ) : null}
            <View style={{ marginTop: 10, gap: 6 }}>
              <Pressable
                style={[styles.btnFilled, { backgroundColor: theme.colors.primary, borderRadius: theme.radius.sm }]}
                onPress={() => router.push({ pathname: '/paywall/[phaseId]', params: { phaseId, phaseName } })}
              >
                <Text style={[theme.type.captionSm, { color: '#fff', fontFamily: theme.fontFamily.semiBold }]} numberOfLines={1}>
                  {t('unlockNow')}
                </Text>
                <Icon name="chevron-right" size={13} color="#fff" />
              </Pressable>
              {promo.unlockVideoUrl ? (
                <Pressable
                  style={[styles.btnOutline, { borderColor: theme.colors.borderInput, borderRadius: theme.radius.sm }]}
                  onPress={() => void WebBrowser.openBrowserAsync(promo.unlockVideoUrl!)}
                >
                  <Icon name="play" size={12} color={theme.colors.primary} />
                  <Text style={[theme.type.captionSm, { color: theme.colors.primary, fontFamily: theme.fontFamily.semiBold }]}>{t('watchIntroVideo')}</Text>
                </Pressable>
              ) : null}
            </View>
          </View>
        </View>
      ) : null}

      {pendingUrl ? <ExternalLinkModal url={pendingUrl} onClose={() => setPendingUrl(null)} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    overflow: 'hidden',
    alignItems: 'stretch',
  },
  image: {
    width: 108,
  },
  imagePlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flex: 1,
    padding: 12,
    justifyContent: 'center',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 6,
  },
  badge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  btnFilled: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 9,
  },
  btnOutline: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    borderWidth: 1,
    paddingVertical: 9,
  },
});
