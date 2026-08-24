import { useEffect, useRef } from 'react';
import { useAnimatedStyle, useSharedValue, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import { useReduceMotion } from './useReduceMotion';

/** A one-time micro-pop (scale up then spring back) whenever `dep` changes —
 * used for the notification badge appearing/incrementing. Skips the initial
 * mount so it only fires on genuine changes, not first render. */
export function usePopOnChange(dep: unknown) {
  const reduceMotion = useReduceMotion();
  const scale = useSharedValue(1);
  const mounted = useRef(false);

  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    if (reduceMotion) return;
    scale.value = withSequence(
      withTiming(1.22, { duration: 90 }),
      withSpring(1, { damping: 9, stiffness: 220 }),
    );
  }, [dep, reduceMotion, scale]);

  return useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
}
