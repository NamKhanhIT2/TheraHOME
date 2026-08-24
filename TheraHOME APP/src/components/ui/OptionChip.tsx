import React from 'react';
import { Pressable, StyleProp, StyleSheet, Text, ViewStyle } from 'react-native';
import { useTheme } from '@/theme';

export interface OptionChipProps {
  label: string;
  active: boolean;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
}

/** Small pill-shaped selectable chip — mirrors `SelectRow`'s option buttons
 * and the Community/filter chip rows in the reference. */
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
          borderColor: active ? theme.colors.primary : theme.colors.borderInput,
          backgroundColor: active ? theme.colors.primaryTint10 : theme.colors.bgCard,
        },
      ]}
    >
      <Text numberOfLines={1} style={[theme.type.captionSm, { fontFamily: theme.fontFamily.semiBold, color: active ? theme.colors.primary : theme.colors.textPrimary }]}> 
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
