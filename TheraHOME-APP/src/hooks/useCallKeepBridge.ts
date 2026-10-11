// Connects Android's telecom UI to this app's call state.
//
// Two systems now know about an incoming call: Android's (raised from the
// background task, and the only one that can ring a locked phone) and the
// app's own `calls` row. They have to agree, or the user answers on the lock
// screen and nothing happens, or hangs up in the app and the system keeps
// ringing.
//
// The contract kept here:
//   - answering in the system UI    -> answer_call, then open the call screen
//   - declining in the system UI    -> end_call 'declined'
//   - the app resolving a call      -> clear the system UI for it
//
// Both ends use the call row's id as the telecom UUID, so no mapping table is
// needed and a stale event can always be matched to a real call.
import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { router } from 'expo-router';
import { supabase } from '@/lib/supabase';
import {
  bringAppToForeground,
  dismissAllCalls,
  dismissCall,
  isCallKeepSupported,
  listenToCallKeep,
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

    void (async () => {
      const ready = await setupCallKeep();
      if (!ready || cancelled) return;
      // Android only — iOS is woken by PushKit, which reports to CallKit in
      // native code before any JS task could run.
      await registerCallBackgroundTask();
      // A phone account that survived a crash can leave a call ringing in the
      // telecom stack with nothing behind it. Starting clean means the next
      // real call is not blocked by a ghost.
      dismissAllCalls();
    })();

    const unsubscribe = listenToCallKeep({
      onAnswer: (callId) => {
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
            bringAppToForeground();
            router.push({ pathname: '/call/[callId]', params: { callId } });
          });
      },
      onEnd: (callId) => {
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
    });

    // A call the app resolved on its own — answered in the in-app sheet,
    // cancelled by the caller — must not leave the system still ringing.
    const appState = AppState.addEventListener('change', (state) => {
      if (state === 'active') dismissAllCalls();
    });

    return () => {
      cancelled = true;
      unsubscribe();
      stopVoip();
      appState.remove();
    };
  }, [enabled]);
}
