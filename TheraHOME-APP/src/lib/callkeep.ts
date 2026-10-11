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
import { Alert, Linking, NativeModules, Platform } from 'react-native';

// Guarded on the exact key the library reads (`NativeModules.RNCallKeep`),
// not on expo-modules-core's lookup. Same lesson as src/lib/voipPush.ts,
// where guarding on a name nothing was registered under disabled the whole
// feature in silence: if this is null, the library itself would not work.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const CALLKEEP = NativeModules.RNCallKeep ? require('react-native-callkeep').default : null;

/** Android's telecom UI is keyed by a UUID of our choosing. Using the call
 * row's own id means every later event — answered, declined — identifies the
 * call without a lookup table. */
export type CallKeepUUID = string;

let setupDone = false;

/** Both platforms now: Android draws the call screen through
 * ConnectionService, iOS through CallKit. The two differ in what WAKES them
 * — a data push handled by a headless task on Android, a PushKit push
 * handled natively on iOS — not in this API. */
export function isCallKeepSupported(): boolean {
  return !!CALLKEEP;
}

/** Android-only pieces: the headless background task and the phone-account
 * prompt have no iOS equivalent, because CallKit needs neither. */
export function isAndroidCallKeep(): boolean {
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
    // CallKeep's own Android helper REJECTS this promise when the user taps
    // "Để sau" on its phone-account alert — a refusal, not a failure. The
    // phone account is still registered; it is only disabled. Returning false
    // here used to abort the caller, which skipped registering the background
    // task, so a user who declined once could never be rung again even after
    // enabling the account in Settings. Treat a rejection as "set up, not
    // enabled" and let `promptForPhoneAccount` deal with the rest.
    if (__DEV__) console.warn('CallKeep setup returned an error (often a declined alert):', error);
    setupDone = true;
    return true;
  }
}

/** Whether the user has actually enabled the phone account. Android will not
 * show the call screen without it, and it is a Settings toggle we cannot flip
 * ourselves — only prompt for. Always true on iOS, which has no equivalent:
 * CallKit needs no permission beyond the VoIP push itself. */
export async function hasCallKeepAccount(): Promise<boolean> {
  if (!isCallKeepSupported()) return false;
  try {
    return await CALLKEEP.hasPhoneAccount();
  } catch {
    return false;
  }
}

let promptedForAccount = false;

/**
 * Asks the user to switch the phone account on, once per app launch.
 *
 * This is the step that decides whether a locked Android phone rings at all.
 * Registering the account (which `setupCallKeep` does) is not enough: Android
 * keeps it DISABLED until the user flips it in Settings → Calling accounts,
 * and an app cannot flip it. Until then `displayIncomingCall` is accepted and
 * then does nothing, which is the worst possible failure — no error, no ring.
 *
 * Nothing called this before, so every Android install was in exactly that
 * state. Once per launch, not once ever: the toggle can be turned back off,
 * and a silent phone is worth one dialog.
 */
export async function promptForPhoneAccount(): Promise<void> {
  if (!isAndroidCallKeep() || promptedForAccount) return;
  if (await hasCallKeepAccount()) return;
  promptedForAccount = true;
  Alert.alert(
    'Bật quyền hiện cuộc gọi',
    'Để cuộc gọi đến hiện ngay trên màn hình khoá như một cuộc gọi điện thoại, '
    + 'hãy bật TheraHOME trong mục "Tài khoản gọi điện" của máy.\n\n'
    + 'Nếu không bật, bạn chỉ nhận được thông báo thường khi đang mở ứng dụng.',
    [
      { text: 'Để sau', style: 'cancel' },
      { text: 'Mở cài đặt', onPress: () => { openPhoneAccountSettings(); } },
    ],
    { cancelable: true },
  );
}

/** Opens Android's calling-accounts page. Falls back to the app's own
 * settings page on the handsets whose ROM hides the telecom screen. */
function openPhoneAccountSettings(): void {
  try {
    CALLKEEP.openPhoneAccounts();
  } catch {
    void Linking.openSettings().catch(() => undefined);
  }
}

/**
 * Events CallKeep buffered before JS was listening.
 *
 * The case this exists for: the phone is locked, a push rings it, the user
 * answers on the lock screen — and only THEN does the app start. By the time
 * `listenToCallKeep` subscribes, the answer has already happened and the
 * event is gone. CallKeep holds those early events for exactly this reason;
 * nothing was reading them, so answering from a cold start left the user
 * looking at the app's home screen with a connected call they could not see.
 */
export async function drainInitialCallKeepEvents(
  { onAnswer, onEnd }: CallKeepHandlers,
): Promise<{ answered: boolean }> {
  if (!isCallKeepSupported()) return { answered: false };
  let answered = false;
  try {
    // Native-side this is a Promise on both platforms, even though its name
    // reads like a getter.
    const events = await CALLKEEP.getInitialEvents() as { name: string; data: { callUUID?: string } }[] | null;
    for (const event of events ?? []) {
      const callId = event?.data?.callUUID;
      if (!callId) continue;
      if (event.name === 'RNCallKeepPerformAnswerCallAction') {
        answered = true;
        onAnswer(callId);
      }
      if (event.name === 'RNCallKeepPerformEndCallAction') onEnd(callId);
    }
    CALLKEEP.clearInitialEvents();
  } catch (error) {
    if (__DEV__) console.warn('could not read CallKeep initial events:', error);
  }
  return { answered };
}

// Calls the SYSTEM is currently ringing for, so the app does not ring a
// second time over the top of it. Only meaningful while the app is alive —
// which is exactly when the double ring would happen.
const systemRinging = new Set<CallKeepUUID>();

/** Whether the telecom stack is already ringing for this call. The in-app
 * sheet uses it to stay quiet rather than playing its own ringtone against
 * the system's. */
export function isSystemRinging(callId: CallKeepUUID): boolean {
  return systemRinging.has(callId);
}

/** Rings the phone, lock screen included. */
export async function displayIncomingCall(
  callId: CallKeepUUID,
  callerName: string,
  hasVideo: boolean,
): Promise<void> {
  if (!isCallKeepSupported()) return;
  systemRinging.add(callId);
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

// ------------------------------------------------------------- echo guard
//
// Ending a call from here comes back as an event.
//
// On Android `endCall`/`endAllCalls` call Connection.onDisconnect(), which
// emits RNCallKeepPerformEndCallAction to JS — the same event a user tapping
// Decline produces. Nothing distinguished the two, so the app declining its
// own call was indistinguishable from the user declining it, and the
// consequences were severe: answering on the lock screen brought the app to
// the foreground, the foreground handler swept "ghost" calls, the sweep
// echoed back as a decline, and the call that had just been answered was
// ended one round trip later.
//
// So every dismissal issued from this file is recorded, and the echo it
// produces is swallowed. Time-boxed rather than permanent: if the echo never
// arrives, a REAL decline for the same call a few seconds later must still
// get through.
const ECHO_WINDOW_MS = 4000;
const selfEnded = new Map<CallKeepUUID, number>();
let suppressAllEndsUntil = 0;

function isOurOwnEcho(callId: CallKeepUUID): boolean {
  const now = Date.now();
  if (now < suppressAllEndsUntil) return true;
  const at = selfEnded.get(callId);
  if (at === undefined) return false;
  if (now - at > ECHO_WINDOW_MS) {
    selfEnded.delete(callId);
    return false;
  }
  selfEnded.delete(callId);
  return true;
}

/** Clears the system call UI. Must be called on every ending — answered
 * elsewhere, declined, timed out — or Android leaves a phantom call in the
 * telecom stack and the next one may not ring. */
export function dismissCall(callId: CallKeepUUID): void {
  systemRinging.delete(callId);
  if (!isCallKeepSupported()) return;
  selfEnded.set(callId, Date.now());
  try {
    CALLKEEP.endCall(callId);
  } catch {
    // Already gone.
  }
}

export function dismissAllCalls(): void {
  systemRinging.clear();
  if (!isCallKeepSupported()) return;
  // No ids to record, so the whole window is suppressed instead.
  suppressAllEndsUntil = Date.now() + ECHO_WINDOW_MS;
  try {
    CALLKEEP.endAllCalls();
  } catch {
    // Nothing to clear.
  }
}

// Calls this device answered. Read by `wasAnsweredHere`, below.
const answeredHere = new Set<CallKeepUUID>();

/** Tells the system the call is connected, which switches Android's UI from
 * "ringing" to the in-call state (and starts its timer), and moves CallKit
 * off "connecting". */
export function markCallActive(callId: CallKeepUUID): void {
  answeredHere.add(callId);
  systemRinging.delete(callId);
  if (!isCallKeepSupported()) return;
  try {
    CALLKEEP.setCurrentCallActive(callId);
  } catch {
    // Not fatal — the call still works, Android's own timer just will not run.
  }
}

/**
 * Whether this device answered that call.
 *
 * Needed because "the call stopped ringing" and "the call was answered here"
 * look identical from the outside, and the right response is opposite:
 * a call that stopped ringing because the caller gave up must have its
 * system UI torn down, while one that stopped because this phone answered it
 * must NOT — tearing that down hangs up on a live conversation.
 */
export function wasAnsweredHere(callId: CallKeepUUID): boolean {
  return answeredHere.has(callId);
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
  const end = ({ callUUID }: { callUUID: string }) => {
    // See the echo guard above: a dismissal we issued ourselves comes back
    // here looking exactly like the user pressing Decline.
    if (isOurOwnEcho(callUUID)) return;
    onEnd(callUUID);
  };
  CALLKEEP.addEventListener('answerCall', answer);
  CALLKEEP.addEventListener('endCall', end);
  return () => {
    CALLKEEP.removeEventListener('answerCall');
    CALLKEEP.removeEventListener('endCall');
  };
}
