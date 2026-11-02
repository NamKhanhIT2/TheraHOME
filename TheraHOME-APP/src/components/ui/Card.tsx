import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { homeGlassColors, useTheme } from '@/theme';

export interface CardProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  padded?: boolean;
  /** 'glass' for the dark redesign. Kích hoạt still uses the light one, so
   * this cannot just be switched over. */
  tone?: 'app' | 'glass';
}

export function Card({ children, style, padded = true, tone = 'app' }: CardProps) {
  const theme = useTheme();
  const glass = tone === 'glass';
  return (
    <View
      style={[
        styles.base,
        // A drop shadow is invisible on the dark ground; the rim is the edge.
        glass ? { borderWidth: 1, borderColor: homeGlassColors.hairline } : theme.shadows.card,
        {
          backgroundColor: glass ? homeGlassColors.surface : theme.colors.bgCard,
          borderRadius: theme.radius.lg,
          padding: padded ? theme.cardPadding : 0,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {},
});
