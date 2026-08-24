import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View, type StyleProp, type TextStyle } from 'react-native';
import { useTheme } from '@/theme';
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
}: {
  text: string;
  collapsedLines?: number;
  style?: StyleProp<TextStyle>;
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
      {truncatable && !expanded ? (
        <Pressable onPress={() => setExpanded(true)} hitSlop={6}>
          <Text style={[style, { color: theme.colors.primary, fontFamily: theme.fontFamily.semiBold, marginTop: 2 }]}>
            {t('seeMore')}
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
