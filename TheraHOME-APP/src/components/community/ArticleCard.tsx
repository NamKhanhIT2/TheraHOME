import React from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '@/theme';
import { useI18n } from '@/lib/i18n';
import { timeAgo } from '@/lib/timeAgo';
import { RemoteImage } from '@/components/ui/RemoteImage';

const LOGO = require('../../../assets/brandmark-blue.png');

/** The curated "TheraHOME article" card — used for Home's "Gợi ý cho bạn"
 * section and Community's pinned slot, so a pinned post reads identically
 * in both places rather than each screen inventing its own layout. Left
 * side: brand identity (logo/name/verified tick/time) + bold title + a
 * 2-line description; right side: a rounded thumbnail. No like/comment/
 * save icons — this is a curated editorial card, not a social post, so it
 * ends in a single text CTA instead. Tapping anywhere navigates to the
 * full post (`onPress`, supplied by the caller). */
export function ArticleCard({
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
    <Pressable
      onPress={onPress}
      style={[styles.card, theme.shadows.card, { backgroundColor: theme.colors.bgCard, borderRadius: theme.radius.lg }]}
    >
      <View style={styles.row}>
        <View style={styles.left}>
          <View style={styles.brandRow}>
            <Image source={LOGO} style={styles.logo} resizeMode="contain" />
            <Text style={[theme.type.bodyStrong, { color: theme.colors.textPrimary, fontFamily: theme.fontFamily.bold }]}>
              TheraHOME
            </Text>
            <View style={[styles.verifiedBadge, { backgroundColor: theme.colors.primary }]}>
              <Text style={styles.verifiedTick}>✓</Text>
            </View>
            <Text style={[theme.type.caption, { color: theme.colors.textMuted }]}> · {timeAgo(createdAt, t)}</Text>
          </View>
          <Text numberOfLines={2} style={[theme.type.bodyStrong, { color: theme.colors.textPrimary, marginTop: 6 }]}>
            {title}
          </Text>
          <Text numberOfLines={2} style={[theme.type.caption, { color: theme.colors.textSecondary, marginTop: 3, lineHeight: 18 }]}>
            {description}
          </Text>
        </View>
        {thumbnailUrl ? (
          <RemoteImage uri={thumbnailUrl} contentFit="cover" style={[styles.thumb, { borderRadius: theme.radius.md, backgroundColor: theme.colors.bgCardAlt }]} />
        ) : null}
      </View>
      <Text style={[theme.type.captionSm, { color: theme.colors.primary, fontFamily: theme.fontFamily.semiBold, marginTop: 10 }]}>
        {t('readMore')}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 14,
  },
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
    width: 36,
    height: 36,
    borderRadius: 10,
  },
  verifiedBadge: {
    width: 19,
    height: 19,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  verifiedTick: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 14,
  },
  thumb: {
    width: 72,
    height: 72,
  },
});
