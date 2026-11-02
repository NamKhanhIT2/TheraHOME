import React, { type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { homeGlassColors, useTheme } from '@/theme';
import { Icon } from '@/components/icons/Icon';

export interface BackBarProps {
  onBack: () => void;
  title?: ReactNode;
  right?: ReactNode;
  /** Matches ScreenContainer's tone — see there. */
  tone?: 'app' | 'glass' | 'violet';
}

/** Mirrors the reference `BackBar` — assumes it sits inside a safe-area-aware
 * container, so it only carries its own local padding (the 62px top padding
 * in the web reference was standing in for the iOS status bar / notch, which
 * `ScreenContainer`'s SafeAreaView already accounts for here). */
export function BackBar({ onBack, title, right, tone = 'app' }: BackBarProps) {
  const theme = useTheme();
  const glass = tone !== 'app';
  const surface = glass ? homeGlassColors.surfaceRaised : theme.colors.bgCardAlt;
  const ink = glass ? homeGlassColors.text : theme.colors.textPrimary;
  return (
    <View style={styles.row}>
      <Pressable
        accessibilityRole="button"
        onPress={onBack}
        // 36pt with a hitSlop was reachable but read as small, and nothing
        // on screen answered the tap until the next screen appeared (owner,
        // 2026-10-26). 42pt, a wider slop, and an immediate press state.
        style={({ pressed }) => [styles.btn, { backgroundColor: surface }, pressed ? { opacity: 0.55 } : null]}
        hitSlop={12}
      >
        <Icon name="chevron-left" size={23} color={ink} strokeWidth={2.2} />
      </Pressable>
      {typeof title === 'string' ? <Text numberOfLines={1} style={[theme.type.h2, styles.title, { color: ink }]}>{title}</Text> : title ? <View style={styles.title}>{title}</View> : null}
      {right ? <View style={styles.right}>{right}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 2,
    gap: 12,
  },
  title: { flex: 1, minWidth: 0 },
  right: { flexShrink: 0 },
  btn: {
    width: 42,
    height: 42,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
});
