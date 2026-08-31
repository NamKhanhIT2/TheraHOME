// Named haptic presets for the reaction-picker interaction (community posts/
// comments and the human-chat action sheet) — a single, consistent tactile
// vocabulary instead of ad-hoc impactAsync calls scattered per call site.
import * as Haptics from 'expo-haptics';

/** Opening the reaction tray/action sheet on long-press. A single impact
 * reads as a flat buzz, especially on Android — a strong initial pulse
 * followed by a lighter echo ~65ms later feels closer to a real mechanical
 * "thock", the way a native long-press menu feels opening. */
export function hapticPressHold() {
  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => undefined);
  setTimeout(() => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => undefined);
  }, 65);
}

/** A light tick as the finger crosses each icon while dragging/browsing. */
export function hapticHoverTick() {
  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
}

/** The moment a reaction is actually committed (tap-select or drag-release-
 * select) — iOS's own "success" notification pattern, a genuinely textured
 * multi-pulse confirmation rather than a single flat tap. */
export function hapticConfirm() {
  void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
}
