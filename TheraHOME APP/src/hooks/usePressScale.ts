import { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { useReduceMotion } from './useReduceMotion';

/** Press feedback shared by Store cards/buttons: scale 1→0.98 on touch-down,
 * spring back to 1 on release — a light, consistent "this responded" cue. */
export function usePressScale(to = 0.98) {
  const reduceMotion = useReduceMotion();
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  function onPressIn() {
    if (reduceMotion) return;
    scale.value = withSpring(to, { damping: 18, stiffness: 260 });
  }
  function onPressOut() {
    if (reduceMotion) return;
    scale.value = withSpring(1, { damping: 14, stiffness: 220 });
  }

  return { animatedStyle, onPressIn, onPressOut };
}
