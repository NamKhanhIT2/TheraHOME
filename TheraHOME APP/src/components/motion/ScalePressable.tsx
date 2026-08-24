import React from 'react';
import { Pressable, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import Reanimated from 'react-native-reanimated';
import { usePressScale } from '@/hooks/usePressScale';

const AnimatedPressable = Reanimated.createAnimatedComponent(Pressable);

export interface ScalePressableProps extends PressableProps {
  style?: StyleProp<ViewStyle>;
  scaleTo?: number;
}

/** Pressable with the standard 1→0.98 spring press feedback — each instance
 * needs its own `usePressScale` shared value, so this wraps the hook rather
 * than every call site trying to use it inline inside a `.map()`. */
export function ScalePressable({ style, scaleTo, onPressIn, onPressOut, ...rest }: ScalePressableProps) {
  const { animatedStyle, onPressIn: scaleIn, onPressOut: scaleOut } = usePressScale(scaleTo);
  return (
    <AnimatedPressable
      {...rest}
      style={[style, animatedStyle]}
      onPressIn={(event) => {
        scaleIn();
        onPressIn?.(event);
      }}
      onPressOut={(event) => {
        scaleOut();
        onPressOut?.(event);
      }}
    />
  );
}
