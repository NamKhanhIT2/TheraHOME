import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import { painColor } from '@/theme/colors';

export interface MoodFaceProps {
  value: number;
  size?: number;
}

const MOOD_EMOJIS = ['🥳', '😄', '😊', '🙂', '😐', '😕', '😟', '😣', '😖', '😫', '😭'] as const;

/** A familiar, expressive face for every discrete discomfort step. */
export function MoodFace({ value, size = 92 }: MoodFaceProps) {
  const safeValue = Math.max(0, Math.min(10, Math.round(value)));
  const color = painColor(safeValue);
  const bounce = useRef(new Animated.Value(1)).current;
  const tilt = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    bounce.setValue(0.72);
    tilt.setValue(safeValue >= 8 ? -1 : safeValue <= 2 ? 1 : 0);
    Animated.parallel([
      Animated.spring(bounce, { toValue: 1, friction: 4, tension: 150, useNativeDriver: true }),
      Animated.timing(tilt, { toValue: 0, duration: 300, easing: Easing.out(Easing.back(1.4)), useNativeDriver: true }),
    ]).start();
  }, [bounce, safeValue, tilt]);

  const rotate = tilt.interpolate({ inputRange: [-1, 0, 1], outputRange: ['-7deg', '0deg', '7deg'] });
  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={`${safeValue} / 10`}
      style={[styles.glow, { width: size, height: size, borderRadius: size / 2, backgroundColor: `${color}20` }]}
    >
      <Animated.View key={safeValue} style={{ transform: [{ scale: bounce }, { rotate }] }}>
        <Text style={{ fontSize: size * 0.72, lineHeight: size * 0.88 }} allowFontScaling={false}>
          {MOOD_EMOJIS[safeValue]}
        </Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  glow: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
