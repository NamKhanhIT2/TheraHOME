import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { homeGlassColors, useTheme } from '@/theme';
import { Icon } from '@/components/icons/Icon';
import { glassRaised, heroFont, tabularNums } from './glass';
import { NeumorphicSurface } from './NeumorphicSurface';

export interface MetricCircleProps {
  icon: string;
  /** Short enough to fit the 64pt disc — "3", "2", "30p", "5/8". */
  value: string;
  label: string;
  onPress?: () => void;
}

/** One of the four readings across the top of the hero. */
export function MetricCircle({ icon, value, label, onPress }: MetricCircleProps) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${label}: ${value}`}
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => [styles.wrap, pressed && onPress ? { opacity: 0.7 } : null]}
    >
      <View style={[styles.disc, glassRaised]}>
        <NeumorphicSurface radius={32} />
        <Icon name={icon} size={13} color={homeGlassColors.textSoft} />
        <Text
          numberOfLines={1}
          style={[
            tabularNums,
            styles.value,
            { color: homeGlassColors.text, ...heroFont('400') },
          ]}
        >
          {value}
        </Text>
      </View>
      <Text
        numberOfLines={1}
        style={[theme.type.captionSm, heroFont('500'), { color: homeGlassColors.textSoft }]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: 72,
    alignItems: 'center',
    gap: 8,
  },
  disc: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  value: {
    fontSize: 19,
    lineHeight: 22,
    letterSpacing: -0.4,
  },
});
