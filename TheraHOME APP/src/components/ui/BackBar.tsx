import React, { type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '@/theme';
import { Icon } from '@/components/icons/Icon';

export interface BackBarProps {
  onBack: () => void;
  title?: ReactNode;
  right?: ReactNode;
}

/** Mirrors the reference `BackBar` — assumes it sits inside a safe-area-aware
 * container, so it only carries its own local padding (the 62px top padding
 * in the web reference was standing in for the iOS status bar / notch, which
 * `ScreenContainer`'s SafeAreaView already accounts for here). */
export function BackBar({ onBack, title, right }: BackBarProps) {
  const theme = useTheme();
  return (
    <View style={styles.row}>
      <Pressable
        onPress={onBack}
        style={[styles.btn, { backgroundColor: theme.colors.bgCardAlt }]}
        hitSlop={8}
      >
        <Icon name="chevron-left" size={20} color={theme.colors.textPrimary} />
      </Pressable>
      {typeof title === 'string' ? <Text numberOfLines={1} style={[theme.type.h2, styles.title, { color: theme.colors.textPrimary }]}>{title}</Text> : title ? <View style={styles.title}>{title}</View> : null}
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
    width: 36,
    height: 36,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
});
