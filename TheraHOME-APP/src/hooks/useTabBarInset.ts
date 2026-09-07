import { Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/**
 * Extra space the bottom tab bar has to reserve *below* its 84pt body, and
 * the matching lift for anything that floats above the bar.
 *
 * iOS: zero. 84pt already IS the platform tab-bar height — 49pt of controls
 * plus the 34pt home-indicator strip — so the safe area is baked into the
 * design. Adding `insets.bottom` on top counted that strip a second time and
 * lifted the whole bar, and the assistant bubble that clears it, 34pt off the
 * bottom of the screen (owner report, 2026-09-07: "thanh phía dưới đang bị
 * nhô lên cao hơn trước").
 *
 * Android: the real inset. Nothing is baked in there — the app draws
 * edge-to-edge since SDK 52, so the system navigation bar covers the tab
 * labels unless its height is reserved. That was the fault this rule was
 * introduced for; it just must not apply to iOS.
 *
 * Modals and sheets are a different case and must keep using the raw
 * `insets.bottom` on both platforms — nothing has reserved that space for
 * them (see AssistantBubble's sheet padding).
 */
export function useTabBarInset(): number {
  const insets = useSafeAreaInsets();
  return Platform.OS === 'android' ? insets.bottom : 0;
}
