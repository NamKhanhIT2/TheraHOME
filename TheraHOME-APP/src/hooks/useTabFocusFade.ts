import { useCallback } from 'react';
import { useFocusEffect } from 'expo-router';
import { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useReduceMotion } from './useReduceMotion';

/** Fade (opacity 0→1) + translateY(6px→0) each time one of the 4 bottom-tab
 * screens regains focus — covers switching tabs and returning from a pushed
 * screen, without needing the tab screen to actually unmount/remount (it
 * doesn't; `Tabs` keeps them alive). Doesn't fire on ordinary re-renders
 * (data refetches, state updates) since those don't touch navigation focus —
 * only an actual focus transition replays it. */
export function useTabFocusFade() {
  const reduceMotion = useReduceMotion();
  const opacity = useSharedValue(1);
  const translateY = useSharedValue(0);

  useFocusEffect(
    useCallback(() => {
      if (reduceMotion) {
        opacity.value = 1;
        translateY.value = 0;
        return;
      }
      opacity.value = 0;
      translateY.value = 6;
      opacity.value = withTiming(1, { duration: 200, easing: Easing.out(Easing.quad) });
      translateY.value = withTiming(0, { duration: 200, easing: Easing.out(Easing.quad) });
    }, [reduceMotion, opacity, translateY]),
  );

  return useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));
}
