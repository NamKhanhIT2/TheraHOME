import React from 'react';
import { Pressable, StyleProp, StyleSheet, Text, ViewStyle } from 'react-native';
import { homeGlassColors, useTheme } from '@/theme';

export interface OptionChipProps {
  label: string;
  active: boolean;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
}

/** Small pill-shaped selectable chip — mirrors `SelectRow`'s option buttons
 * and the Community/filter chip rows in the reference.
 *
 * On the glass palette throughout: its only caller is Chỉnh sửa hồ sơ, which
 * is dark. Left on `bgCard` it drew white pills with black text across a
 * near-black screen, and — worse — the selected one looked exactly like the
 * other three (2026-11-01). */
export function OptionChip({ label, active, onPress, style }: OptionChipProps) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.base,
        style,
        {
          borderRadius: theme.radius.full,
          borderWidth: active ? 2 : 1,
          borderColor: active ? homeGlassColors.tick : homeGlassColors.hairline,
          backgroundColor: active ? homeGlassColors.surfaceRaised : homeGlassColors.surface,
        },
      ]}
    >
      <Text numberOfLines={1} style={[theme.type.captionSm, { fontFamily: theme.fontFamily.semiBold, color: active ? homeGlassColors.tick : homeGlassColors.text }]}> 
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    alignItems: 'center',
  },
});
