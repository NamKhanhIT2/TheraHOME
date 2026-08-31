import React, { useEffect, useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text, type GestureResponderEvent } from 'react-native';
import { useTheme } from '@/theme';
import { useI18n } from '@/lib/i18n';
import { POST_REACTIONS, reactionLabel, type PostReaction } from '@/hooks/useCommunity';
import { Icon } from '@/components/icons/Icon';
import { hapticPressHold } from '@/lib/haptics';

export type ReactionGesturePoint = { pageX: number; pageY: number };

export interface ReactionButtonProps {
  currentReaction: PostReaction | null;
  onQuickPress: () => void;
  onLongPress: (point: ReactionGesturePoint) => void;
  onLongPressMove?: (point: ReactionGesturePoint) => void;
  onLongPressRelease?: () => void;
  /** When set, a text label is rendered next to the icon and the whole row —
   * not just the 44px icon — becomes the tap/long-press/drag target, so
   * pressing or holding the word does exactly what pressing the icon does.
   * Used by the post-level "Thích" action; left unset for the icon-only
   * comment/reply control. */
  label?: string;
  labelColor?: string;
}

export function ReactionButton({ currentReaction, onQuickPress, onLongPress, onLongPressMove, onLongPressRelease, label, labelColor }: ReactionButtonProps) {
  const theme = useTheme();
  const { t, language } = useI18n();
  const pressScale = useRef(new Animated.Value(1)).current;
  const reactionPop = useRef(new Animated.Value(1)).current;
  const longPressActive = useRef(false);
  const longPressConsumed = useRef(false);
  const selected = POST_REACTIONS.find((item) => item.key === currentReaction);
  const accessibilityText = selected
    ? t('reactionSelectedHint', { label: reactionLabel(selected.key, language) })
    : t('reactionUnselectedHint');

  function handlePressIn() {
    Animated.timing(pressScale, { toValue: 0.92, duration: 140, useNativeDriver: true }).start();
  }
  function pointFromEvent(event: GestureResponderEvent): ReactionGesturePoint | null {
    const nativeEvent = event.nativeEvent;
    if (!nativeEvent || !Number.isFinite(nativeEvent.pageX) || !Number.isFinite(nativeEvent.pageY)) return null;
    return { pageX: nativeEvent.pageX, pageY: nativeEvent.pageY };
  }
  function handlePressOut() {
    Animated.spring(pressScale, { toValue: 1, useNativeDriver: true, speed: 25, bounciness: 4 }).start();
    if (longPressActive.current) {
      longPressActive.current = false;
      onLongPressRelease?.();
      setTimeout(() => { longPressConsumed.current = false; }, 0);
    }
  }
  function handleLongPress(event: GestureResponderEvent) {
    const point = pointFromEvent(event);
    if (!point) return;
    longPressActive.current = true;
    longPressConsumed.current = true;
    hapticPressHold();
    onLongPress(point);
  }

  useEffect(() => {
    if (!currentReaction) return;
    reactionPop.setValue(1);
    Animated.sequence([
      Animated.timing(reactionPop, { toValue: 1.25, duration: 100, useNativeDriver: true }),
      Animated.spring(reactionPop, { toValue: 1, useNativeDriver: true, speed: 24, bounciness: 5 }),
    ]).start();
  }, [currentReaction, reactionPop]);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityText}
      delayLongPress={380}
      onPress={() => {
        if (longPressConsumed.current) {
          longPressConsumed.current = false;
          return;
        }
        onQuickPress();
      }}
      onLongPress={handleLongPress}
      onTouchMove={(event) => {
        if (!longPressActive.current) return;
        const point = pointFromEvent(event);
        if (point) onLongPressMove?.(point);
      }}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      cancelable={false}
      hitSlop={10}
      // RN's default press-retention box is tiny (~20px) — once a drag
      // toward the reaction tray above the button crosses it, Pressability
      // treats that as "left the press area" and fires onPressOut even
      // though the finger never lifted, ending the picker instantly. This
      // widens that box to comfortably cover the tray so only an actual
      // lift (or a drag far enough to back out on purpose) ends it.
      pressRetentionOffset={{ top: 160, left: 160, right: 160, bottom: 40 }}
      style={label ? styles.hitLabelled : styles.hit}
    >
      <Animated.View style={[label ? styles.row : null, { transform: [{ scale: Animated.multiply(pressScale, reactionPop) }] }]}>
        {selected ? <Text style={label ? styles.emojiSm : styles.emoji}>{selected.emoji}</Text> : <Icon name="heart" size={label ? 18 : 17} color={theme.colors.textMuted} />}
        {label ? <Text style={[theme.type.caption, styles.label, { color: labelColor ?? theme.colors.textSecondary, fontFamily: theme.fontFamily.semiBold }]}>{label}</Text> : null}
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  hit: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  hitLabelled: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 9, gap: 6 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  emoji: { fontSize: 18 },
  emojiSm: { fontSize: 18 },
  label: { includeFontPadding: false },
});
