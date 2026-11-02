import React from 'react';
import { Pressable, View, type StyleProp, type ViewStyle } from 'react-native';
import { GLASS_CARD_PADDING, glassCard } from './glass';

export interface GlassCardProps {
  children: React.ReactNode;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
}

/**
 * What is left of the Home v3 card once its panel is gone: an inset and a
 * press target. Kept as a component rather than deleted so the stack still
 * has one place to change its mind about this.
 */
export function GlassCard({ children, onPress, style, accessibilityLabel }: GlassCardProps) {
  const content: StyleProp<ViewStyle> = [
    glassCard,
    { paddingHorizontal: GLASS_CARD_PADDING },
    style,
  ];
  if (!onPress) return <View style={content}>{children}</View>;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      style={({ pressed }) => [content, pressed && { opacity: 0.6 }]}
    >
      {children}
    </Pressable>
  );
}
