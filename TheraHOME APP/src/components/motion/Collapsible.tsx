import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useReduceMotion } from '@/hooks/useReduceMotion';

export interface CollapsibleProps {
  open: boolean;
  children: React.ReactNode;
}

/** Expands/collapses `children` by animating height + opacity together
 * (used for reply threads), instead of content appearing/disappearing
 * instantly. RN has no "measure before paint" API, so the natural height is
 * captured from an invisible, non-interactive copy of the same content
 * rendered off to the side — the standard technique for animating to an
 * unknown target height. */
export function Collapsible({ open, children }: CollapsibleProps) {
  const reduceMotion = useReduceMotion();
  const [measuredHeight, setMeasuredHeight] = useState(0);
  const progress = useSharedValue(open ? 1 : 0);
  const everOpened = useRef(open);

  function onMeasure(event: LayoutChangeEvent) {
    const height = event.nativeEvent.layout.height;
    if (height > 0 && Math.abs(height - measuredHeight) > 0.5) setMeasuredHeight(height);
  }

  useEffect(() => {
    if (reduceMotion) {
      progress.value = open ? 1 : 0;
      return;
    }
    if (!everOpened.current && !open) return;
    everOpened.current = true;
    progress.value = withTiming(open ? 1 : 0, { duration: 220, easing: Easing.out(Easing.quad) });
  }, [open, reduceMotion, progress]);

  const animatedStyle = useAnimatedStyle(() => ({
    height: progress.value * measuredHeight,
    opacity: progress.value,
  }));

  return (
    <>
      <View onLayout={onMeasure} style={styles.hiddenMeasure} pointerEvents="none">
        {children}
      </View>
      <Animated.View style={[styles.clip, animatedStyle]}>{children}</Animated.View>
    </>
  );
}

const styles = StyleSheet.create({
  hiddenMeasure: { position: 'absolute', left: 0, right: 0, top: 0, opacity: 0 },
  clip: { overflow: 'hidden' },
});
