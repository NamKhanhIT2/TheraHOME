// Small shared conventions for the one-time mount/stagger reveals used
// across Home/Roadmap/Store/Community — kept as plain helpers (not a wrapper
// component) so call sites can still use Reanimated's own `entering` prop
// directly, which already auto-respects the OS Reduce Motion setting for
// layout animations (`ReduceMotion.System` is the default on every builder
// below) without extra plumbing.
import { Easing, FadeInDown } from 'react-native-reanimated';

export const REVEAL_DURATION = 220;
export const REVEAL_TRANSLATE_Y = 10;

/** A capped stagger delay (ms) for list entrances — e.g. Store's product
 * grid or Community's feed/comments. Caps how many items actually stagger
 * so a long list's last item isn't stuck waiting seconds to appear. */
export function staggerDelay(index: number, step = 50, max = 8): number {
  return Math.min(index, max) * step;
}

/** One consistent "fade up" entrance builder, timing-based (no bounce). */
export function fadeUpEntering(delay = 0, translateY = REVEAL_TRANSLATE_Y, duration = REVEAL_DURATION) {
  return FadeInDown.duration(duration).delay(delay).easing(Easing.out(Easing.quad)).withInitialValues({
    opacity: 0,
    transform: [{ translateY }],
  });
}
