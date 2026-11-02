// The call after you have left the app: a floating window over whatever you
// do next, with a way back in.
//
// "Tôi bấm home là mất cuộc gọi luôn."
//
// <OngoingCallBar> already keeps a minimised call visible INSIDE the app.
// The moment the user presses Home it is gone, because it is a React view
// in an app that is no longer on screen — the call is still connected,
// still billing, still carrying someone's voice, with nothing to show for
// it. Every caller solves this the same way, and on Android the way is
// picture-in-picture: the system takes the app's own window, shrinks it,
// and floats it over the next app. No permission, no overlay, no policy
// question — see modules/therahome-callwindow/README.md for why the
// obvious alternative (SYSTEM_ALERT_WINDOW) is the wrong one.
//
// Android only. On iOS a call stays visible through CallKit, which
// src/lib/callkeep.ts already drives, and there is no app-level equivalent
// of this to reach for.
import { useSyncExternalStore } from 'react';
import { Platform } from 'react-native';
import { requireOptionalNativeModule } from 'expo-modules-core';

// The key the module registers itself under: the string in its `Name(...)`,
// checked against modules/therahome-callwindow/.../TheraHomeCallWindowModule.kt
// rather than guessed from the directory name. Guessing it is what silently
// disabled video and PushKit for a whole release (see CLAUDE.md).
const CALL_WINDOW = requireOptionalNativeModule<{
  isSupported: () => boolean;
  isActive: () => boolean;
  setArmed: (armed: boolean, ratio: number) => Promise<boolean>;
  enter: () => Promise<boolean>;
  exit: () => Promise<boolean>;
  addListener: (event: 'onPipChange', listener: (payload: { inPip: boolean }) => void) =>
    { remove: () => void };
}>('TheraHomeCallWindow');

/** Shapes to ask the system for. A voice call is a name and a timer, so it
 * gets something close to a bar; a video call gets the shape of the video.
 * Android clamps anything outside 1:2.39…2.39:1, so both are inside it. */
export const CALL_WINDOW_VOICE_RATIO = 2;
export const CALL_WINDOW_VIDEO_RATIO = 16 / 9;

/** False on iOS, on web, on a build made before the module existed, and on
 * the handsets (and every Android before 8) with no picture-in-picture. */
export function isCallWindowSupported(): boolean {
  if (Platform.OS !== 'android' || !CALL_WINDOW) return false;
  try {
    return CALL_WINDOW.isSupported();
  } catch {
    return false;
  }
}

/**
 * Arms or disarms the window, and says what shape it should be.
 *
 * Armed means "a call is running": on Android 12 and up this is what makes
 * a Home press slide the app into a small window by itself, and below that
 * it is the flag `onUserLeaveHint` checks. It must be turned off when the
 * call ends, without exception — an app that shrinks itself into a corner
 * every time you press Home is a bug, and it would do exactly that forever.
 *
 * Deliberately not a promise anyone waits on: nothing in a call should
 * block on this, and a device that cannot do it simply runs without it.
 */
export function armCallWindow(armed: boolean, ratio = CALL_WINDOW_VOICE_RATIO): void {
  if (!CALL_WINDOW) return;
  void CALL_WINDOW.setArmed(armed, ratio).catch((error: unknown) => {
    if (__DEV__) console.warn('could not arm the call window:', error);
  });
}

/** Shrinks the app now. For the one exit `onUserLeaveHint` never sees: Back
 * from the last screen, which moves the task to the background without
 * telling anybody it was the user leaving. */
export function enterCallWindow(): void {
  if (!CALL_WINDOW) return;
  void CALL_WINDOW.enter().catch(() => undefined);
}

/** Closes the window. For a call that ends while the user is in another
 * app: without this the window stays on their screen showing a call that is
 * over, and the only way to be rid of it is to find and press its X. */
export function exitCallWindow(): void {
  if (!CALL_WINDOW) return;
  void CALL_WINDOW.exit().catch(() => undefined);
}

// ------------------------------------------------- are we a small window?
//
// One subscription for the whole app, not one per component: the event
// comes from native and says the same thing to everybody.
let active = CALL_WINDOW?.isActive() ?? false;
const listeners = new Set<() => void>();
let nativeSubscription: { remove: () => void } | undefined;

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  if (CALL_WINDOW && !nativeSubscription) {
    nativeSubscription = CALL_WINDOW.addListener('onPipChange', ({ inPip }) => {
      if (active === inPip) return;
      active = inPip;
      for (const notify of listeners) notify();
    });
  }
  return () => {
    listeners.delete(listener);
    // Kept open while anything is listening; torn down when nothing is, so
    // a Fast Refresh does not leave a stack of them behind.
    if (listeners.size === 0) {
      nativeSubscription?.remove();
      nativeSubscription = undefined;
    }
  };
}

const getActive = () => active;

/**
 * True while the app is drawn as a small floating window.
 *
 * What is on screen then is the app's own view tree, shrunk — so whatever
 * is rendered has to be legible at about an inch tall. That is why the call
 * UI swaps itself for a compact one instead of letting the full screen be
 * scaled down into something unreadable.
 */
export function useCallWindowActive(): boolean {
  return useSyncExternalStore(subscribe, getActive, getActive);
}
