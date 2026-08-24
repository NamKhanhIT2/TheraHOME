import React from 'react';
import type { StyleProp, TextStyle } from 'react-native';
import Animated, { FadeInUp, FadeOutUp } from 'react-native-reanimated';

export interface TransitionTextProps {
  value: string;
  style?: StyleProp<TextStyle>;
  numberOfLines?: number;
}

/** Crossfades text when `value` changes: the old value fades + slides up and
 * out, the new value fades + slides up in from below — a keyed remount lets
 * Reanimated's entering/exiting handle both halves of the transition (the
 * standard pattern for an animated counter/value swap). Used for the
 * notification badge count and the roadmap hero card's day/phase text. */
export function TransitionText({ value, style, numberOfLines }: TransitionTextProps) {
  return (
    <Animated.Text
      key={value}
      entering={FadeInUp.duration(180)}
      exiting={FadeOutUp.duration(180)}
      style={style}
      numberOfLines={numberOfLines}
    >
      {value}
    </Animated.Text>
  );
}
