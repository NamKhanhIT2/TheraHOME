import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { homeGlassColors, useTheme } from '@/theme';

/**
 * Placeholder blocks for screens whose first paint is a bare spinner.
 *
 * Deliberately static, matching the skeletons already in Store and Community:
 * the win here is that the screen keeps its shape while data loads, so nothing
 * jumps when the real content lands. A shimmer would add a Reanimated loop per
 * block for no extra information, and this app already had to strip entrance
 * animations out of the community feed for costing frames on release builds.
 *
 * `bgCardAlt` on `bgCard` is the same pairing the existing skeletons use, so
 * these read as one family across the app and follow the theme into dark mode.
 * `tone="glass"` swaps that pairing for the dark redesign's own surfaces —
 * without it a glass screen flashes two light-grey bars before its first paint
 * (Thông báo and Hồ sơ did, 2026-11-01).
 */
export type SkeletonTone = 'app' | 'glass';
export function SkeletonBlock({
  width,
  height,
  radius,
  style,
  tone = 'app',
}: {
  width?: number | `${number}%`;
  height: number;
  radius?: number;
  style?: StyleProp<ViewStyle>;
  tone?: SkeletonTone;
}) {
  const theme = useTheme();
  return (
    <View
      style={[
        {
          width: width ?? '100%',
          height,
          borderRadius: radius ?? 8,
          backgroundColor: tone === 'glass' ? homeGlassColors.surfaceRaised : theme.colors.bgCardAlt,
        },
        style,
      ]}
    />
  );
}

/** Card-shaped container the blocks sit inside, so a skeleton lines up with
 * the real card it stands in for rather than floating on the page. */
export function SkeletonCard({ children, style, tone = 'app' }: { children: React.ReactNode; style?: StyleProp<ViewStyle>; tone?: SkeletonTone }) {
  const theme = useTheme();
  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: tone === 'glass' ? homeGlassColors.surface : theme.colors.bgCard,
          borderRadius: theme.radius.lg,
          padding: theme.cardPadding,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

/** One list row: leading circle plus two text lines. Used by the screens whose
 * loading state stands in for a uniform list. */
export function SkeletonRow({ circle = 44, tone = 'app' }: { circle?: number; tone?: SkeletonTone }) {
  return (
    <View style={styles.row}>
      <SkeletonBlock width={circle} height={circle} radius={circle / 2} tone={tone} />
      <View style={styles.rowLines}>
        <SkeletonBlock width="62%" height={13} tone={tone} />
        <SkeletonBlock width="88%" height={11} tone={tone} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: '100%',
    gap: 12,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  rowLines: {
    flex: 1,
    gap: 8,
  },
});
