// Native incoming-call UI: CallKit on iOS, ConnectionService on Android.
// PushKit / the background task raises the call; the shared bridge resolves it.
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
    const events = await CALLKEEP.getInitialEvents() as { name: string; data: { callUUID?: string; error?: string } }[] | null;
    const ended = new Set((events ?? []).filter((event) => event.name === 'RNCallKeepPerformEndCallAction')
      .map((event) => event.data?.callUUID?.toLowerCase()));
    const replayed = new Set<string>();
    for (const event of events ?? []) {
      const callId = event?.data?.callUUID?.toLowerCase();
      if (!callId) continue;
      const key = `${event.name}:${callId}`;
      if (replayed.has(key)) continue;
      replayed.add(key);
      if (event.name === 'RNCallKeepPerformAnswerCallAction') {
        if (ended.has(callId) || isCallDismissed(callId)) continue;
        nativeAnswered.add(callId);
        answered = true;
        onAnswer(callId);
      }
      if (event.name === 'RNCallKeepPerformEndCallAction') {
        setSystemRinging(callId, false);
        if (!isOurOwnEcho(callId)) onEnd(callId);
      }
      // A call still ringing in CallKit while this app was cold-starting —
      // the usual shape of a VoIP push waking a killed app. Recording it
      // keeps the in-app sheet from drawing itself over a live system call
      // screen a moment after launch.
      if (event.name === 'RNCallKeepDidDisplayIncomingCall' && !event.data.error && !ended.has(callId)) {
        setSystemRinging(callId, true);
      }
    }
    CALLKEEP.clearInitialEvents();
  } catch (error) {
    if (__DEV__) console.warn('could not read CallKeep initial events:', error);
  }
  return { answered };
}

// ---------------------------------------------------- who is ringing what
//
// Calls the SYSTEM is currently ringing for.
//
// This decides whether the app shows its own incoming-call sheet. On iOS the
// VoIP push makes CallKit ring in native code, before any JS exists, and the
// app had no idea — so a call arrived as TWO screens with two Decline
// buttons, and the owner had to press both. Reported from the device.
//
// The answer is not to drop the in-app sheet: it is the only UI there is
// when CallKit cannot ring (no VoIP token yet, or an Android phone account
// the user has not enabled). So the sheet asks this instead, and steps
// aside exactly when the system has it covered.
const systemRinging = new Set<string>();
const nativeAnswered = new Set<string>();
const ringingListeners = new Set<() => void>();

function setSystemRinging(callId: CallKeepUUID, ringing: boolean): void {
  const key = callId.toLowerCase();
  if (ringing && (isCallDismissed(key) || wasAnsweredHere(key))) return;
  const had = systemRinging.has(key);
  if (ringing) systemRinging.add(key); else systemRinging.delete(key);
  if (had !== ringing) for (const listener of ringingListeners) listener();
}

/** Whether the telecom stack is already showing a call screen for this call. */
export function isSystemRinging(callId: CallKeepUUID): boolean {
  return systemRinging.has(callId.toLowerCase());
}

/** Subscribe for `useSyncExternalStore`, so a sheet already on screen
 * disappears the moment CallKit catches up rather than sitting there next
 * to it. */
export function subscribeSystemRinging(listener: () => void): () => void {
  ringingListeners.add(listener);
  return () => { ringingListeners.delete(listener); };
}

/** Rings the phone, lock screen included. */
export async function displayIncomingCall(
  callId: CallKeepUUID,
  callerName: string,
  hasVideo: boolean,
): Promise<void> {
  if (!isCallKeepSupported()) return;
  if (isCallDismissed(callId) || wasAnsweredHere(callId)) return;
  await setupCallKeep();
  if (isCallDismissed(callId) || wasAnsweredHere(callId)) return;
  // Marked here, not from the `didDisplayIncomingCall` event: Android fires
  // that event only from its own native reportNewIncomingCall, never from
  // the JS method this calls. iOS is the other way round, which is why both
  // paths exist.
  //
  // Conditional on the phone account, because CallKeep's Android
  // displayIncomingCall silently returns when the account is disabled. Mark
  // it ringing then and the in-app sheet would stand aside for a call
  // screen that never appeared, leaving the user with nothing at all —
  // which is worse than the two screens this whole change is fixing.
  const hasAccount = await hasCallKeepAccount();
  if (isCallDismissed(callId) || wasAnsweredHere(callId)) return;
  if (hasAccount) setSystemRinging(callId, true);
  try {
    // `handle` is what Android shows as the "number". There is no phone
    // number here, so the caller's name goes in both slots rather than
    // showing a blank or a raw uuid.
    CALLKEEP.displayIncomingCall(callId, callerName, callerName, 'generic', hasVideo);
  } catch (error) {
    setSystemRinging(callId, false);
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
const dismissed = new Map<CallKeepUUID, number>();
let suppressAllEndsUntil = 0;

/** Ignore delayed ring/answer pushes for a call this device already ended. */
export function isCallDismissed(callId: string): boolean {
  const now = Date.now();
  for (const [id, at] of dismissed) if (now - at > 5 * 60_000) dismissed.delete(id);
  return dismissed.has(callId.toLowerCase());
}

export function getSystemRingingCalls(): string[] { return [...systemRinging]; }

function isOurOwnEcho(callId: CallKeepUUID): boolean {
  callId = callId.toLowerCase();
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
  callId = callId.toLowerCase();
  dismissed.set(callId, Date.now());
  setSystemRinging(callId, false);
  answeredHere.delete(callId);
  nativeAnswered.delete(callId);
  if (!isCallKeepSupported()) return;
  selfEnded.set(callId, Date.now());
  try {
    CALLKEEP.endCall(callId);
  } catch {
    // Already gone.
  }
}

export function dismissAllCalls(): void {
  for (const id of [...systemRinging]) setSystemRinging(id, false);
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
  callId = callId.toLowerCase();
  if (isCallDismissed(callId)) return;
  const needsAnswer = isSystemRinging(callId) && !nativeAnswered.has(callId);
  answeredHere.add(callId);
  setSystemRinging(callId, false);
  if (!isCallKeepSupported()) return;
  try {
    if (needsAnswer) CALLKEEP.answerIncomingCall(callId);
    if (Platform.OS === 'android') CALLKEEP.setCurrentCallActive(callId);
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
  return answeredHere.has(callId.toLowerCase());
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
  // Fired once the system has actually PUT A CALL SCREEN UP — including the
  // iOS case where native code did it from a VoIP push with no JS involved.
  // `error` is a non-empty string when CallKit refused, in which case
  // nothing is on screen and the in-app sheet must still show.
  const displayed = ({ callUUID, error }: { callUUID: string; error?: string }) => {
    if (error) return;
    // PushKit can display natively before JS gets to inspect a delayed push.
    if (isCallDismissed(callUUID)) {
      dismissCall(callUUID);
      return;
    }
    setSystemRinging(callUUID, true);
  };
  const answer = ({ callUUID }: { callUUID: string }) => {
    const id = callUUID.toLowerCase();
    if (wasAnsweredHere(id) || isCallDismissed(id)) return;
    // Native has already accepted; do not send answerIncomingCall back.
    nativeAnswered.add(id);
    onAnswer(id);
  };
  const end = ({ callUUID }: { callUUID: string }) => {
    // See the echo guard above: a dismissal we issued ourselves comes back
    // here looking exactly like the user pressing Decline.
    setSystemRinging(callUUID, false);
    if (isOurOwnEcho(callUUID)) return;
    onEnd(callUUID.toLowerCase());
  };
  CALLKEEP.addEventListener('didDisplayIncomingCall', displayed);
  CALLKEEP.addEventListener('answerCall', answer);
  CALLKEEP.addEventListener('endCall', end);
  return () => {
    CALLKEEP.removeEventListener('didDisplayIncomingCall');
    CALLKEEP.removeEventListener('answerCall');
    CALLKEEP.removeEventListener('endCall');
  };
}
