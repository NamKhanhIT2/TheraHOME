import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { homeGlassColors, useTheme } from '@/theme';
import { useI18n } from '@/lib/i18n';
import { timeAgo } from '@/lib/timeAgo';
import { RemoteImage } from '@/components/ui/RemoteImage';
import { GlassCard } from './GlassCard';
import { Reveal } from './ScrollFade';
import { heroFont } from './glass';

const LOGO = require('../../../assets/brandmark-blue.png');

/**
 * Home v3's "Gợi ý cho bạn" card — the same curated post `ArticleCard`
 * renders on Community's pinned slot, re-skinned for the glass surface.
 *
 * Kept as its own component rather than a variant of `ArticleCard`: the two
 * share a shape but not a single colour, and threading a theme switch through
 * that one would have left neither easy to read.
 */
export function GlassArticleCard({
  title,
  description,
  thumbnailUrl,
  createdAt,
  onPress,
}: {
  title: string;
  description: string;
  thumbnailUrl: string | null;
  createdAt: string;
  onPress: () => void;
}) {
  const theme = useTheme();
  const { t } = useI18n();

  return (
    <GlassCard onPress={onPress} accessibilityLabel={title}>
      <Reveal style={styles.row}>
        <View style={styles.left}>
          <View style={styles.brandRow}>
            <Image source={LOGO} style={styles.logo} resizeMode="contain" />
            <Text style={[theme.type.caption, heroFont('400'), { color: homeGlassColors.text, ...heroFont('700') }]}>
              TheraHOME
            </Text>
            <View style={[styles.verifiedBadge, { backgroundColor: homeGlassColors.accentStrong }]}>
              <Text style={styles.verifiedTick}>✓</Text>
            </View>
            <Text style={[theme.type.captionSm, heroFont('500'), { color: homeGlassColors.textFaint }]}> · {timeAgo(createdAt, t)}</Text>
          </View>
          <Text numberOfLines={2} style={[styles.title, { color: homeGlassColors.text, ...heroFont('600') }]}>
            {title}
          </Text>
          <Text numberOfLines={2} style={[theme.type.caption, heroFont('400'), { color: homeGlassColors.textMuted, marginTop: 4, lineHeight: 19 }]}>
            {description}
          </Text>
          <Text style={[theme.type.caption, heroFont('400'), { color: homeGlassColors.accent, ...heroFont('600'), marginTop: 8 }]}>
            {t('readMore')}
          </Text>
        </View>
        {thumbnailUrl ? (
          <RemoteImage
            uri={thumbnailUrl}
            contentFit="cover"
            style={[styles.thumb, { backgroundColor: homeGlassColors.surfaceInset }]}
          />
        ) : null}
      </Reveal>
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  left: {
    flex: 1,
    minWidth: 0,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  logo: {
    width: 22,
    height: 22,
    borderRadius: 7,
  },
  verifiedBadge: {
    width: 15,
    height: 15,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  verifiedTick: {
    color: '#fff',
    fontSize: 9,
    lineHeight: 12,
    fontWeight: '700',
  },
  title: {
    fontSize: 16,
    lineHeight: 22,
    letterSpacing: -0.3,
    marginTop: 10,
  },
  thumb: {
    width: 92,
    height: 92,
    borderRadius: 14,
  },
});
