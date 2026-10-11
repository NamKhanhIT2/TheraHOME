// Connects the system telecom UI — Android's ConnectionService, iOS's CallKit
// — to this app's call state.
//
// Two systems now know about an incoming call: the OS's (raised from the
// background task on Android, from the PushKit callback on iOS, and the only
// one that can ring a locked phone) and the app's own `calls` row. They have
// to agree, or the user answers on the lock screen and nothing happens, or
// hangs up in the app and the system keeps ringing.
//
// The contract kept here:
//   - answering in the system UI    -> answer_call, then open the call screen
//   - declining in the system UI    -> end_call 'declined'
//   - the app resolving a call      -> clear the system UI for it
//
// Both ends use the call row's id as the telecom UUID, so no mapping table is
// needed and a stale event can always be matched to a real call.
import { useEffect, useRef } from 'react';
import { router } from 'expo-router';
import { supabase } from '@/lib/supabase';
import {
  bringAppToForeground,
  dismissAllCalls,
  dismissCall,
  drainInitialCallKeepEvents,
  isCallKeepSupported,
  listenToCallKeep,
  markCallActive,
  promptForPhoneAccount,
  setupCallKeep,
} from '@/lib/callkeep';
import { registerCallBackgroundTask } from '@/lib/callBackgroundTask';
import { registerVoipPush } from '@/lib/voipPush';

export function useCallKeepBridge(enabled: boolean) {
  // The handlers below are registered once and must not be torn down on every
  // render, so the live value they need is read through a ref.
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;

  useEffect(() => {
    if (!enabled || !isCallKeepSupported()) return;
    let cancelled = false;

    // iOS needs its PushKit token on file before any VoIP push can reach it,
    // and the token can change, so this subscription lives as long as the
    // bridge does. A no-op on Android, which wakes through the background
    // task below instead.
    const stopVoip = registerVoipPush();

    // Named rather than inline, because the SAME two handlers serve both the
    // live subscription and the replay of events that happened before this
    // JS existed.
    const handlers = {
      onAnswer: (callId: string) => {
        if (!enabledRef.current) return;
        // Answer first, navigate second: the call screen refuses to join a
        // room until the row says 'accepted', so arriving before the RPC has
        // landed would show "đang kết nối…" and stall.
        void supabase.rpc('answer_call', { p_call_id: callId })
          .then(({ error }) => {
            if (error) {
              // Someone else took it, or it rang out while the lock screen
              // was still showing. Clear the system UI rather than leaving a
              // call the user cannot get rid of.
              dismissCall(callId);
              if (__DEV__) console.warn('answer_call from CallKeep failed:', error.message);
              return;
            }
            // The system is still showing "ringing" until told otherwise,
            // and this also records that THIS device took the call, which
            // stops the incoming sheet from tearing the system UI down a
            // moment later (see IncomingCallSheet).
            markCallActive(callId);
            bringAppToForeground();
            router.push({ pathname: '/call/[callId]', params: { callId } });
          });
      },
      onEnd: (callId: string) => {
        if (!enabledRef.current) return;
        // Android fires this for a decline AND after a normal hangup. The RPC
        // is idempotent and refuses to re-end a finished call, so the second
        // case costs one no-op round trip rather than needing a flag here.
        void supabase.rpc('end_call', {
          p_call_id: callId,
          p_status: 'declined',
          p_reason: 'declined',
        });
      },
    };

    const unsubscribe = listenToCallKeep(handlers);

    void (async () => {
      await setupCallKeep();
      if (cancelled) return;
      // Android only — iOS is woken by PushKit, which reports to CallKit in
      // native code before any JS task could run.
      await registerCallBackgroundTask();
      // Anything the user did on the lock screen before this JS existed,
      // which is the normal case for a call answered from a cold start:
      // CallKeep buffers those events and nothing was reading them, so such
      // an answer landed the user on the home screen with a live call they
      // could not see. Drained BEFORE the ghost sweep below, or the sweep
      // would cancel the very call just answered.
      const { answered } = await drainInitialCallKeepEvents(handlers);
      if (cancelled) return;
      // A phone account that survived a crash can leave a call ringing in the
      // telecom stack with nothing behind it. Starting clean means the next
      // real call is not blocked by a ghost — unless the reason this app is
      // running at all is a call just answered on the lock screen, in which
      // case the "ghost" is the live call and sweeping it would hang up on
      // the user a second after they picked up.
      if (!answered) dismissAllCalls();
      // Registering the phone account is not the same as it being ON, and
      // Android keeps it off until the user says so in Settings. Asked last
      // so the dialog never lands on top of a call being restored above.
      await promptForPhoneAccount();
    })();

    // There used to be an AppState listener here sweeping every call each
    // time the app became active. It was wrong twice over: on Android the
    // sweep echoes back as a decline (see the echo guard in lib/callkeep),
    // and foregrounding is exactly what answering on the lock screen does —
    // so the sweep hung up on calls the user had just taken. Clearing the
    // system UI for a call the app resolved is now done per call, where the
    // app knows WHICH call ended: useCallTerminator.

    return () => {
      cancelled = true;
      unsubscribe();
      stopVoip();
    };
  }, [enabled]);
}
