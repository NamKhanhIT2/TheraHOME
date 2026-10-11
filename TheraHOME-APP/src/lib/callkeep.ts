// The system incoming-call screen — the one that shows on a locked phone.
//
// Everything before this rang only inside the app: a modal while TheraHOME
// was open, and an ordinary push notification otherwise. A notification on a
// locked screen is a line of text you have to notice; this is the full-screen
// ring with Answer and Decline that a phone call is supposed to be.
//
// ANDROID ONLY for now, through ConnectionService. That choice is about Play
// policy, not convenience: since Android 14 `USE_FULL_SCREEN_INTENT` — the
// obvious way to do this — is auto-granted only to apps whose CORE function
// is calling or alarms, and Play revokes it at install for everything else.
// TheraHOME is a rehab app with a support line, so it would be revoked, leaving
// a permission prompt users would have to find and grant. ConnectionService
// (`MANAGE_OWN_CALLS`) is the sanctioned API for an app that places calls as
// part of what it does, and it carries no such restriction.
//
// iOS is deliberately NOT wired up here. CallKit needs a PushKit VoIP push,
// and Expo's push service cannot send one — it has no apns-push-type: voip —
// so iOS needs a separate APNs path with its own key before CallKit can do
// anything. Calling setup() on iOS would register a phone account that never
// rings, which is worse than not having one.
import { Platform } from 'react-native';
import { requireOptionalNativeModule } from 'expo-modules-core';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const CALLKEEP = requireOptionalNativeModule('RNCallKeep') ? require('react-native-callkeep').default : null;

/** Android's telecom UI is keyed by a UUID of our choosing. Using the call
 * row's own id means every later event — answered, declined — identifies the
 * call without a lookup table. */
export type CallKeepUUID = string;

let setupDone = false;

export function isCallKeepSupported(): boolean {
  return Platform.OS === 'android' && !!CALLKEEP;
}

/**
 * Registers the phone account. Safe to call repeatedly.
 *
 * `selfManaged: false` on purpose: a self-managed connection means the app
 * draws its own in-call UI and Android shows nothing, which is precisely the
 * thing this exists to avoid.
 */
export async function setupCallKeep(): Promise<boolean> {
  if (!isCallKeepSupported()) return false;
  if (setupDone) return true;
  try {
    await CALLKEEP.setup({
      ios: { appName: 'TheraHOME' },
      android: {
        alertTitle: 'Cần quyền gọi điện',
        alertDescription:
          'TheraHOME cần quyền này để hiện cuộc gọi đến ngay trên màn hình khoá, '
          + 'giống một cuộc gọi thường.',
        cancelButton: 'Để sau',
        okButton: 'Đồng ý',
        additionalPermissions: [],
        selfManaged: false,
        // Keeps the call alive when Android would otherwise reclaim the
        // process mid-conversation.
        foregroundService: {
          channelId: 'calls-v1',
          channelName: 'Cuộc gọi đến',
          notificationTitle: 'TheraHOME đang trong cuộc gọi',
        },
      },
    });
    CALLKEEP.setAvailable(true);
    setupDone = true;
    return true;
  } catch (error) {
    if (__DEV__) console.warn('CallKeep setup failed:', error);
    return false;
  }
}

/** Whether the user has actually enabled the phone account. Android will not
 * show the call screen without it, and it is a Settings toggle we cannot flip
 * ourselves — only prompt for. */
export async function hasCallKeepAccount(): Promise<boolean> {
  if (!isCallKeepSupported()) return false;
  try {
    return await CALLKEEP.hasPhoneAccount();
  } catch {
    return false;
  }
}

/** Rings the phone, lock screen included. */
export async function displayIncomingCall(
  callId: CallKeepUUID,
  callerName: string,
  hasVideo: boolean,
): Promise<void> {
  if (!isCallKeepSupported()) return;
  await setupCallKeep();
  try {
    // `handle` is what Android shows as the "number". There is no phone
    // number here, so the caller's name goes in both slots rather than
    // showing a blank or a raw uuid.
    CALLKEEP.displayIncomingCall(callId, callerName, callerName, 'generic', hasVideo);
  } catch (error) {
    if (__DEV__) console.warn('displayIncomingCall failed:', error);
  }
}

/** Clears the system call UI. Must be called on every ending — answered
 * elsewhere, declined, timed out — or Android leaves a phantom call in the
 * telecom stack and the next one may not ring. */
export function dismissCall(callId: CallKeepUUID): void {
  if (!isCallKeepSupported()) return;
  try {
    CALLKEEP.endCall(callId);
  } catch {
    // Already gone.
  }
}

export function dismissAllCalls(): void {
  if (!isCallKeepSupported()) return;
  try {
    CALLKEEP.endAllCalls();
  } catch {
    // Nothing to clear.
  }
}

/** Tells Android the call is connected, which switches its UI from "ringing"
 * to the in-call state and starts its timer. */
export function markCallActive(callId: CallKeepUUID): void {
  if (!isCallKeepSupported()) return;
  try {
    CALLKEEP.setCurrentCallActive(callId);
  } catch {
    // Not fatal — the call still works, Android's own timer just will not run.
  }
}

/** Brings TheraHOME to the front, which is what has to happen when someone
 * answers from the lock screen. */
export function bringAppToForeground(): void {
  if (!isCallKeepSupported()) return;
  try {
    CALLKEEP.backToForeground();
  } catch {
    // Best effort.
  }
}

export interface CallKeepHandlers {
  onAnswer: (callId: CallKeepUUID) => void;
  onEnd: (callId: CallKeepUUID) => void;
}

/** Subscribes to the two events that matter and returns an unsubscribe. */
export function listenToCallKeep({ onAnswer, onEnd }: CallKeepHandlers): () => void {
  if (!isCallKeepSupported()) return () => undefined;
  const answer = ({ callUUID }: { callUUID: string }) => onAnswer(callUUID);
  const end = ({ callUUID }: { callUUID: string }) => onEnd(callUUID);
  CALLKEEP.addEventListener('answerCall', answer);
  CALLKEEP.addEventListener('endCall', end);
  return () => {
    CALLKEEP.removeEventListener('answerCall');
    CALLKEEP.removeEventListener('endCall');
  };
}
