import React, { useEffect, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useTheme } from '@/theme';
import { Icon } from '@/components/icons/Icon';
import { ExternalLinkModal } from '@/components/ExternalLinkModal';
import { usePhasePromo } from '@/hooks/usePhasePromo';
import { useI18n } from '@/lib/i18n';

export interface PhaseUnlockPromoProps {
  phaseId: string;
  phaseName: string;
  /** Already verified for this phase — hides the unlock card entirely. */
  unlocked: boolean;
}

/** Shown once a phase's quiz is completed: unless already unlocked, the
 * next-phase unlock card first (must go through real Apple IAP per App
 * Store Review Guideline 3.1.1, since it unlocks digital content inside the
 * app), then an optional physical-product cross-sell card (plain external
 * links — Apple exempts physical goods from IAP). Either card is simply
 * omitted if admin hasn't configured that half of `phase_promos` for this
 * phase. Cards are text-only — title+description+buttons, no thumbnail
 * (per explicit request 2026-09-03). */
export function PhaseUnlockPromo({ phaseId, phaseName, unlocked }: PhaseUnlockPromoProps) {
  const theme = useTheme();
  const { t } = useI18n();
  const [pendingUrl, setPendingUrl] = useState<string | null>(null);
  const { data: promo, isPending } = usePhasePromo(phaseId);

  // The cards themselves are text-only now, but the paywall screen still
  // opens with the unlock image as its hero — keep warming expo-image's
  // DISK cache as soon as the promo row loads. Must be expo-image's
  // prefetch — RN Image.prefetch fills a different cache the paywall's
  // RemoteImage hero never reads, which is why the hero used to show a
  // blank panel for a while on first open.
  const unlockImageUrl = promo?.unlockImageUrl;
  useEffect(() => {
    if (unlockImageUrl) void ExpoImage.prefetch([unlockImageUrl], { cachePolicy: 'disk' }).catch(() => {});
  }, [unlockImageUrl]);

  if (isPending || !promo) return null;
  // Selling paused (free-agreement mode): show NOTHING — neither the unlock
  // card nor the cross-sell — so no path into the paywall exists (per
  // explicit request 2026-09-04).
  if (!promo.salesEnabled) return null;

  const hasCrossSell = !!(promo.crossSellTitle || promo.crossSellDescription);
  // Per-platform gate: only show the unlock card when THIS platform's
  // store product exists — an apple-only phase must not dangle a dead
  // paywall on Android (and vice versa).
  const platformProductId = Platform.OS === 'android' ? promo.googleProductId : promo.appleProductId;
  const hasUnlock = !unlocked && !!platformProductId;
  if (!hasCrossSell && !hasUnlock) return null;

  return (
    <View style={{ gap: 14 }}>
      {hasUnlock ? (
        <View style={[styles.card, theme.shadows.card, { backgroundColor: theme.colors.bgCard, borderRadius: theme.radius.lg, borderColor: theme.colors.primary }]}>
          <View style={styles.content}>
            <View style={styles.titleRow}>
              <Text style={[theme.type.bodyStrong, { color: theme.colors.textPrimary, flexShrink: 1 }]} numberOfLines={2}>
                {t('unlockGiaiDoan', { phase: phaseName })}
              </Text>
              <Icon name="lock" size={15} color={theme.colors.textMuted} />
            </View>
            {promo.unlockDescription ? (
              <Text style={[theme.type.captionSm, { color: theme.colors.textSecondary, marginTop: 4 }]} numberOfLines={3}>
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

      {hasCrossSell ? (
        <View style={[styles.card, theme.shadows.card, { backgroundColor: theme.colors.bgCard, borderRadius: theme.radius.lg, borderColor: theme.colors.primary }]}>
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
              <Text style={[theme.type.captionSm, { color: theme.colors.textSecondary, marginTop: 4 }]} numberOfLines={3}>
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

      {pendingUrl ? <ExternalLinkModal url={pendingUrl} onClose={() => setPendingUrl(null)} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    overflow: 'hidden',
    // Primary-colored outline (per explicit request 2026-09-03) so the two
    // promo cards stand out from regular roadmap cards.
    borderWidth: 1.5,
  },
  content: {
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
