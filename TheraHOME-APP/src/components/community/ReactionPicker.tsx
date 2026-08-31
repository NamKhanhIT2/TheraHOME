import React, { useEffect, useRef } from 'react';
import { Animated, Pressable, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { useTheme } from '@/theme';
import { useI18n } from '@/lib/i18n';
import { POST_REACTIONS, reactionLabel, type PostReaction } from '@/hooks/useCommunity';
import { ReactionAsset } from '@/components/ReactionAsset';
import { hapticHoverTick } from '@/lib/haptics';
import { REACTION_EMOJI_SIZE, REACTION_GAP, REACTION_ITEM_SIZE, REACTION_PAD_H, REACTION_PAD_V } from './reactionPickerGeometry';

export interface ReactionPickerProps {
  onSelect: (reaction: PostReaction) => void;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
  highlightedReaction?: PostReaction | null;
}

/** A light, reusable social-reaction tray. Its parent controls positioning and
 * dismissal so it works both above a comment and in a contextual menu. Each
 * icon is a real animated vector asset (`ReactionAsset` — pulsing rings/
 * twinkling orbit dots via react-native-svg + Animated, glyph itself never
 * transformed) rather than a static emoji scaled/translated/rotated; the
 * hover pop/lift here is a separate interaction-feedback layer applied to
 * that whole composed asset, not the animation itself. */
export function ReactionPicker({ onSelect, style, accessibilityLabel, highlightedReaction = null }: ReactionPickerProps) {
  const theme = useTheme();
  const { t, language } = useI18n();
  const resolvedAccessibilityLabel = accessibilityLabel ?? t('chooseReaction');
  const enter = useRef(new Animated.Value(0)).current;
  const hoverScales = useRef(new Map(POST_REACTIONS.map((item) => [item.key, new Animated.Value(1)]))).current;
  const previousHovered = useRef<PostReaction | null>(null);

  useEffect(() => {
    Animated.spring(enter, { toValue: 1, useNativeDriver: true, speed: 18, bounciness: 5 }).start();
  }, [enter]);

  // Springs each reaction's scale toward its hovered/idle target and buzzes
  // once per icon crossed while dragging — the same tactile cue a native
  // reaction tray gives as your finger lands on a new emoji.
  useEffect(() => {
    if (highlightedReaction === previousHovered.current) return;
    if (highlightedReaction) hapticHoverTick();
    POST_REACTIONS.forEach((item) => {
      const hovered = item.key === highlightedReaction;
      Animated.spring(hoverScales.get(item.key)!, {
        toValue: hovered ? 1.45 : 1,
        useNativeDriver: true,
        speed: hovered ? 22 : 16,
        bounciness: hovered ? 11 : 5,
      }).start();
    });
    previousHovered.current = highlightedReaction;
  }, [highlightedReaction, hoverScales]);

  return (
    <Animated.View
      accessibilityLabel={resolvedAccessibilityLabel}
      style={[
        styles.tray,
        { backgroundColor: theme.colors.bgCard, borderColor: theme.colors.borderInput },
        { opacity: enter, transform: [{ translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) }, { scale: enter.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1] }) }] },
        style,
      ]}
    >
      {POST_REACTIONS.map((item, index) => {
        const hoverScale = hoverScales.get(item.key)!;
        return (
          <Animated.View key={item.key} style={{ opacity: enter, transform: [{ scale: enter.interpolate({ inputRange: [0, 1], outputRange: [0.88 + index * 0.005, 1] }) }] }}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={reactionLabel(item.key, language)}
              onPress={() => onSelect(item.key)}
              hitSlop={8}
              style={styles.reaction}
            >
              <Animated.View
                style={{
                  transform: [
                    { scale: hoverScale },
                    { translateY: hoverScale.interpolate({ inputRange: [1, 1.45], outputRange: [0, -12] }) },
                  ],
                }}
              >
                <ReactionAsset emoji={item.emoji} size={REACTION_EMOJI_SIZE} />
              </Animated.View>
            </Pressable>
          </Animated.View>
        );
      })}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  tray: {
    flexDirection: 'row',
    gap: REACTION_GAP,
    paddingHorizontal: REACTION_PAD_H,
    paddingVertical: REACTION_PAD_V,
    borderWidth: 1,
    borderRadius: 999,
    shadowColor: '#0A1424',
    shadowOpacity: 0.18,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 5 },
    elevation: 6,
  },
  reaction: { width: REACTION_ITEM_SIZE, height: REACTION_ITEM_SIZE, alignItems: 'center', justifyContent: 'center' },
});
