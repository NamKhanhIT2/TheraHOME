import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

/** OS-level "Reduce Motion" preference — true skips decorative/looping
 * animation (parallax, traveling highlights, ...) while leaving small
 * functional feedback (press states, chevron rotation) untouched. */
export function useReduceMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    let mounted = true;
    void AccessibilityInfo.isReduceMotionEnabled()
      .then((value) => {
        if (mounted) setReduced(value);
      })
      .catch(() => {
        // Keep the default when the native accessibility bridge is not yet
        // ready (most commonly while a development client reconnects).
      });
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduced);
    return () => {
      mounted = false;
      subscription.remove();
    };
  }, []);

  return reduced;
}
