// Named haptic presets — a single, consistent tactile vocabulary instead of
// ad-hoc impactAsync calls scattered per call site. Started with the
// reaction picker (community posts/comments, the human-chat action sheet)
// and now also covers the tab bar, the water knobs and Apple Health.
import { Platform } from 'react-native';
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

/**
 * One short, light tick as a selection changes: moving to another tab, a cup
 * of water in or out. Never fired for a press that changes nothing — tapping
 * the tab you are already on, or `+` on a full glass, stays silent.
 *
 * **It is two different calls because only one of them obeys the phone.**
 * `impactAsync`/`selectionAsync` reach Android's `Vibrator`, which buzzes
 * whatever the owner has set under Sounds → Touch feedback;
 * `performAndroidHapticsAsync` goes through `View.performHapticFeedback`,
 * which the system silences when haptics are off (and needs no VIBRATE
 * permission). On iOS `UISelectionFeedbackGenerator` already respects
 * System Haptics, so there is nothing to add there.
 */
export function hapticSelect() {
  if (Platform.OS === 'android') {
    void Haptics.performAndroidHapticsAsync(Haptics.AndroidHaptics.Segment_Tick).catch(
      () => undefined,
    );
    return;
  }
  void Haptics.selectionAsync().catch(() => undefined);
}
