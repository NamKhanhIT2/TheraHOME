// What rings the phone when TheraHOME is not running.
//
// The in-app sheet needs the app alive; the push notification needs someone
// to read it. Neither covers the case this is for: screen locked, app killed,
// a customer calling. For that, something has to run OUTSIDE the app's normal
// lifecycle and put the system call screen up.
//
// `expo-notifications` can do it: a push whose payload carries data runs this
// task in a headless context, with no UI and no React. The task's only job is
// to hand the call to Android's telecom stack and get out of the way —
// everything else (joining the room, the RPCs) happens later, in the app
// proper, once someone answers.
//
// It must be registered at MODULE scope, not inside a component: when Android
// starts the app headless there is no React tree, and a task defined in a
// hook would never exist by the time the notification arrives. That is why
// this file is imported for its side effect from app/_layout.tsx.
import * as Notifications from 'expo-notifications';
import * as TaskManager from 'expo-task-manager';
import { displayIncomingCall, dismissCall, hasCallKeepAccount, isAndroidCallKeep } from '@/lib/callkeep';

export const CALL_BACKGROUND_TASK = 'therahome-incoming-call';

interface CallPushData {
  /** 'call' to start ringing, 'call_cancel' to stop. */
  type?: string;
  callId?: string;
  callerName?: string;
  media?: string;
}

/** Digs the data payload out of whatever shape the platform delivered.
 * Android headless delivery and a foreground remote message do not agree on
 * where it sits, and getting this wrong means the task runs and silently
 * does nothing. */
function readCallData(payload: unknown): CallPushData | null {
  const shape = payload as {
    notification?: { request?: { content?: { data?: unknown } }; data?: unknown };
    data?: unknown;
  } | null;
  const data =
    shape?.notification?.request?.content?.data
    ?? shape?.notification?.data
    ?? shape?.data
    ?? payload;
  if (!data || typeof data !== 'object') return null;
  return data as CallPushData;
}

TaskManager.defineTask(CALL_BACKGROUND_TASK, async ({ data, error }) => {
  if (error) {
    if (__DEV__) console.warn('call background task error:', error);
    return;
  }
  if (!isAndroidCallKeep()) return;

  const call = readCallData(data);
  if (!call?.callId) return;

  // The counterpart of the ringing push: the caller gave up, or another CSKH
  // answered first, and this phone is still showing a system call screen for
  // a call that is over. Nothing in the app can take it down — the app is
  // not running, which is the only reason that screen exists. So the server
  // sends a silent push and the only job here is to dismiss.
  //
  // `dispatch-push` never sends this back to whoever resolved the call, so
  // this cannot arrive on the phone holding the live conversation.
  if (call.type === 'call_cancel') {
    dismissCall(call.callId);
    return;
  }

  if (call.type !== 'call') return;

  // A push for a call that is already over — answered on another device, or
  // cancelled while the push was in flight — must not raise a ringing screen
  // nobody can dismiss. `dispatch-push` already refuses to send for a
  // non-ringing call, so this is the second line of defence rather than the
  // first, and it is deliberately NOT a database read: this context is
  // short-lived and unauthenticated, and a network round trip here is the
  // difference between ringing and not.
  const callerName = call.callerName?.trim() || 'Khách hàng';
  const isVideo = call.media === 'video';
  await displayIncomingCall(call.callId, callerName, isVideo);

  // The call push carries no title or body any more, so that an incoming
  // call shows ONE thing — the telecom call screen — the way Messenger and
  // Zalo do, rather than a banner next to it.
  //
  // That leaves one hole worth covering. Android keeps the app's calling
  // account DISABLED until the user switches it on in Settings, and while it
  // is off `displayIncomingCall` is accepted and then silently draws
  // nothing. Measured on the test handset 2026-10-14: the push arrived, the
  // task ran, and the only thing that appeared was the banner. Take the
  // banner away without this and that phone shows nothing at all for an
  // incoming call, which is far worse than showing two things.
  //
  // So the notification becomes the FALLBACK rather than the default: posted
  // only when the system has no call screen to give.
  if (await hasCallKeepAccount()) return;
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: isVideo ? 'Cuộc gọi video đến' : 'Cuộc gọi đến',
        body: `${callerName} đang gọi — mở ứng dụng để trả lời`,
        data: { type: 'call', callId: call.callId },
        sound: 'ting.wav',
      },
      trigger: null,
    });
  } catch (error) {
    if (__DEV__) console.warn('could not post the incoming-call fallback:', error);
  }
});

/** Registers the task with the notification system. Idempotent; safe on every
 * launch. Does nothing on iOS, where CallKit is not wired up. */
export async function registerCallBackgroundTask(): Promise<void> {
  if (!isAndroidCallKeep()) return;
  try {
    await Notifications.registerTaskAsync(CALL_BACKGROUND_TASK);
  } catch (error) {
    if (__DEV__) console.warn('could not register the call background task:', error);
  }
}

/** Clears a system call screen raised by the task — used when the app is
 * running and has resolved the call by other means. */
export function dismissBackgroundCall(callId: string): void {
  dismissCall(callId);
}
