import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import Reanimated, { FadeIn } from 'react-native-reanimated';
import { useTheme } from '@/theme';
import { landingPage, websiteDomain } from '@/lib/mockData';
import { useStoreCategories } from '@/hooks/useStore';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { Icon } from '@/components/icons/Icon';
import { ExternalLinkModal } from '@/components/ExternalLinkModal';
import { useI18n } from '@/lib/i18n';
import { ProductVideoModal } from '@/components/ProductVideoModal';
import { useTabFocusFade } from '@/hooks/useTabFocusFade';
import { ScalePressable } from '@/components/motion/ScalePressable';
import { fadeUpEntering, staggerDelay } from '@/lib/motion';
import { RemoteImage } from '@/components/ui/RemoteImage';

function StoreSkeleton({ bg, bgAlt, radius, cardPadding, shadow }: { bg: string; bgAlt: string; radius: { lg: number; md: number }; cardPadding: number; shadow: object }) {
  return (
    <View style={styles.categoryBlock}>
      <View style={[styles.skelLine, { width: 120, height: 20, backgroundColor: bgAlt, marginBottom: 12 }]} />
      <View style={{ gap: 12 }}>
        {[0, 1].map((i) => (
          <View key={i} style={[styles.itemCard, shadow, { backgroundColor: bg, borderRadius: radius.lg, padding: cardPadding }]}>
            <View style={styles.itemRow}>
              <View style={[styles.itemIcon, { backgroundColor: bgAlt, borderRadius: radius.md, borderWidth: 0 }]} />
              <View style={{ flex: 1, gap: 8 }}>
                <View style={[styles.skelLine, { width: '70%', height: 15, backgroundColor: bgAlt }]} />
                <View style={[styles.skelLine, { width: '90%', height: 12, backgroundColor: bgAlt }]} />
                <View style={[styles.skelLine, { width: 60, height: 14, backgroundColor: bgAlt }]} />
              </View>
            </View>
            <View style={styles.itemActions}>
              <View style={[styles.skelLine, styles.actionBtnOutline, { height: 38, backgroundColor: bgAlt, borderWidth: 0 }]} />
              <View style={[styles.skelLine, styles.actionBtnFilled, { height: 38, backgroundColor: bgAlt }]} />
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

export default function StoreScreen() {
  const theme = useTheme();
  const { t } = useI18n();
  const [pendingUrl, setPendingUrl] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ title: string; url: string | null } | null>(null);
  const { data: categories, isPending } = useStoreCategories();
  const focusFadeStyle = useTabFocusFade();

  let cardIndex = -1;

  return (
    <ScreenContainer edges={['top']}>
      <Reanimated.View style={[{ flex: 1 }, focusFadeStyle]}>
      <ScrollView contentContainerStyle={styles.scrollBody}>
        <View style={styles.header}>
          <Text style={[theme.type.display, { color: theme.colors.textPrimary }]}>{t('store')}</Text>
          <Text style={[theme.type.caption, { color: theme.colors.textSecondary, marginTop: 2 }]}>
            {t('productEcosystem')}
          </Text>
        </View>

        {isPending ? (
          <Reanimated.View key="skeleton" entering={FadeIn.duration(160)}>
            <StoreSkeleton bg={theme.colors.bgCard} bgAlt={theme.colors.bgCardAlt} radius={theme.radius} cardPadding={theme.cardPadding} shadow={theme.shadows.card} />
            <StoreSkeleton bg={theme.colors.bgCard} bgAlt={theme.colors.bgCardAlt} radius={theme.radius} cardPadding={theme.cardPadding} shadow={theme.shadows.card} />
          </Reanimated.View>
        ) : (
          <Reanimated.View key="content" entering={FadeIn.duration(200)}>
          {(categories ?? []).map((cat) => (
            <View key={cat.id} style={styles.categoryBlock}>
              <Text style={[theme.type.h2, { color: theme.colors.textPrimary, marginBottom: 10 }]}>{cat.title}</Text>
              <View style={{ gap: 12 }}>
                {cat.items.map((item) => {
                  cardIndex += 1;
                  const accentColor = theme.colors[item.accent];
                  const openLink = () => setPendingUrl(item.externalLink ?? landingPage);
                  return (
                    <Reanimated.View key={item.id} entering={fadeUpEntering(staggerDelay(cardIndex, 50, 8))}>
                    <View
                      style={[styles.itemCard, theme.shadows.card, { backgroundColor: theme.colors.bgCard, borderRadius: theme.radius.lg, padding: theme.cardPadding }]}
                    >
                      <View style={styles.itemRow}>
                        {item.imageUrl ? (
                          <RemoteImage uri={item.imageUrl} priority="high" contentFit="cover" style={[styles.itemImage, { borderRadius: theme.radius.md, backgroundColor: theme.colors.bgCardAlt }]} />
                        ) : (
                          <View style={[styles.itemIcon, { borderColor: accentColor, borderRadius: theme.radius.md }]}>
                            <Icon name="activity" size={20} color={accentColor} />
                          </View>
                        )}
                        <View style={{ flex: 1 }}>
                          <Text style={[theme.type.bodyStrong, { color: theme.colors.textPrimary }]}>{item.name}</Text>
                          <Text style={[theme.type.caption, { color: theme.colors.textSecondary, marginTop: 2 }]}>
                            {item.description}
                          </Text>
                          <Text style={[theme.type.bodyStrong, { color: accentColor, marginTop: 6, fontFamily: theme.fontFamily.bold }]}>
                            {item.priceText}
                          </Text>
                        </View>
                      </View>
                      <View style={styles.itemActions}>
                        {cat.hasTrial ? (
                          <ScalePressable
                            onPress={() => setPreview({ title: item.name, url: item.previewVideoUrl })}
                            style={[styles.actionBtnOutline, { borderColor: accentColor, borderRadius: theme.radius.md }]}
                          >
                            <Text style={[theme.type.bodyStrong, { color: accentColor }]}>{t('tryNow')}</Text>
                          </ScalePressable>
                        ) : null}
                        <ScalePressable
                          onPress={openLink}
                          style={[styles.actionBtnFilled, { backgroundColor: accentColor, borderRadius: theme.radius.md }]}
                        >
                          <Text style={[theme.type.bodyStrong, { color: '#fff' }]}>{t('buyNow')}</Text>
                        </ScalePressable>
                      </View>
                    </View>
                    </Reanimated.View>
                  );
                })}
              </View>
            </View>
          ))}

          <ScalePressable onPress={() => setPendingUrl(landingPage)} style={styles.footerLink}>
            <Text style={[theme.type.caption, { color: theme.colors.primary }]}>{t('viewAllWebsite', { domain: websiteDomain })}</Text>
          </ScalePressable>
          </Reanimated.View>
        )}
      </ScrollView>
      </Reanimated.View>

      {pendingUrl ? <ExternalLinkModal url={pendingUrl} onClose={() => setPendingUrl(null)} /> : null}
      {preview ? <ProductVideoModal title={preview.title} url={preview.url} onClose={() => setPreview(null)} /> : null}
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
  categoryBlock: {
    marginTop: 20,
  },
  itemCard: {},
  itemRow: {
    flexDirection: 'row',
    gap: 14,
    alignItems: 'center',
  },
  itemIcon: {
    width: 48,
    height: 48,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemImage: {
    width: 48,
    height: 48,
    resizeMode: 'cover',
  },
  itemActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  actionBtnOutline: {
    flex: 1,
    borderWidth: 1,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionBtnFilled: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footerLink: {
    marginTop: 20,
    alignItems: 'center',
  },
  skelLine: {
    borderRadius: 6,
  },
});
