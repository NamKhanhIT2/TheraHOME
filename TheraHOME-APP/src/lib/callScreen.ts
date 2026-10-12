// What the screen does during a call: blanking at the ear, and not locking
// itself while you are watching someone.
//
// "Don't hang up with your cheek."
//
// During a voice call the phone is against an ear, and a live touchscreen
// there is a liability: the ear mutes the call, opens the keypad, or ends it
// outright. Every phone app blanks the screen for exactly this, and the app
// did not, which is why a call could end for no reason the user could name.
//
// The work is native on both platforms — iOS blanks on
// `UIDevice.isProximityMonitoringEnabled`, Android on a
// PROXIMITY_SCREEN_OFF_WAKE_LOCK — so this is a thin wrapper over a local
// Expo module. See modules/therahome-proximity for why it is ours rather
// than a package.
import { Platform } from 'react-native';
import { requireOptionalNativeModule } from 'expo-modules-core';

// The key the module registers itself under: the string in its `Name(...)`,
// on both platforms. Checked against modules/therahome-proximity, not
// guessed from the directory name — guessing that is what disabled video
// and PushKit for an entire release (see CLAUDE.md).
const PROXIMITY = requireOptionalNativeModule<{
  setEnabled: (enabled: boolean) => Promise<boolean>;
  setKeepAwake: (enabled: boolean) => Promise<boolean>;
}>('TheraHomeProximity');

/** False on a build made before the module existed, and on web. */
export function isProximitySupported(): boolean {
  return Platform.OS !== 'web' && !!PROXIMITY;
}

/**
 * Arms or disarms the sensor. Idempotent on both platforms.
 *
 * Deliberately not a promise anyone waits on: nothing in a call should
 * block on this, and a device that cannot do it (an iPad, a handset with no
 * sensor) is not an error — the call simply runs with the screen on.
 */
export function setProximityBlanking(enabled: boolean): void {
  if (!PROXIMITY) return;
  void PROXIMITY.setEnabled(enabled).catch((error: unknown) => {
    if (__DEV__) console.warn('proximity blanking unavailable:', error);
  });
}

/**
 * Keeps the screen on for the length of a call.
 *
 * Both platforms lock the screen on their own idle timeout no matter what
 * is on it, and a video call watched without touching anything hits that
 * timeout every time — the picture goes dark mid-sentence and the user is
 * left tapping to get their own call back. Every caller disables it for the
 * duration. On an audio call it matters just as much, for a less obvious
 * reason: the proximity blanking above is not the screen locking, and a
 * phone that locks under your ear comes back wanting a passcode.
 *
 * Paired with a `false` on the way out, without exception — a device left
 * in this state never sleeps again.
 */
export function setCallScreenAwake(enabled: boolean): void {
  if (!PROXIMITY?.setKeepAwake) return;
  void PROXIMITY.setKeepAwake(enabled).catch((error: unknown) => {
    console.warn('could not hold the screen awake:', error);
  });
}
