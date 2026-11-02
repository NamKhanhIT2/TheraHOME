import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View, type StyleProp, type TextStyle } from 'react-native';
import { useTheme, homeGlassColors } from '@/theme';
import { useI18n } from '@/lib/i18n';

/** Truncates long post content to a fixed number of lines with a trailing
 * "Xem thêm" that expands the text inline — the card itself never navigates
 * from tapping it, matching the familiar social-feed pattern (Facebook/
 * Instagram) rather than the curated `ArticleCard`'s "navigate to detail"
 * CTA. Short content that already fits within `collapsedLines` renders as
 * plain text with no affordance at all.
 *
 * Measuring whether text overflows a line clamp isn't directly knowable
 * from RN's `numberOfLines` alone (once applied, `onTextLayout` only ever
 * reports the already-clamped line count) — so this renders one invisible,
 * unclamped measuring pass first (same double-render-to-measure technique
 * `Collapsible.tsx` already uses elsewhere in this app) to decide once
 * whether the toggle is needed, before the real, correctly-sized-from-the-
 * first-frame text ever paints. */
export function ExpandableText({
  text,
  collapsedLines = 3,
  style,
  toggleColor = homeGlassColors.textMuted,
}: {
  text: string;
  collapsedLines?: number;
  style?: StyleProp<TextStyle>;
  /** The default is tuned for the dark community feed. A light surface has
   * to pass its own, or the toggle disappears into the panel. */
  toggleColor?: string;
}) {
  const theme = useTheme();
  const { t } = useI18n();
  const [expanded, setExpanded] = useState(false);
  const [truncatable, setTruncatable] = useState<boolean | null>(null);

  if (truncatable === null) {
    return (
      <Text
        style={[style, styles.measuring]}
        onTextLayout={(e) => setTruncatable(e.nativeEvent.lines.length > collapsedLines)}
      >
        {text}
      </Text>
    );
  }

  return (
    <View>
      <Text style={style} numberOfLines={expanded || !truncatable ? undefined : collapsedLines}>
        {text}
      </Text>
      {truncatable ? (
        // Expanding without a way back left the reader stuck with a wall of
        // text (owner, 2026-10-26), so the toggle stays after it opens.
        <Pressable onPress={() => setExpanded((open) => !open)} hitSlop={8}>
          {/* Not purple: on a violet ground, beside a violet tick and a
              violet bookmark, a violet "Xem thêm" read as one more accent
              rather than as a control (owner, 2026-10-26). Muted grey is
              what every feed uses for it. */}
          <Text style={[style, { color: toggleColor, fontFamily: theme.fontFamily.semiBold, marginTop: 2 }]}>
            {expanded ? t('seeLess') : t('seeMore')}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  measuring: {
    position: 'absolute',
    left: 0,
    right: 0,
    opacity: 0,
  },
});
