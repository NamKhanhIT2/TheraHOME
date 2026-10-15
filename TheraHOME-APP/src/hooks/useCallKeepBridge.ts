// Native and in-app actions use the same signaling mutations and media owner.
import { useEffect, useRef } from 'react';
import { router } from 'expo-router';
import { supabase } from '@/lib/supabase';
import {
  bringAppToForeground, dismissCall, drainInitialCallKeepEvents,
  getSystemRingingCalls, isCallDismissed, isCallKeepSupported,
  listenToCallKeep, promptForPhoneAccount, setupCallKeep, wasAnsweredHere,
} from '@/lib/callkeep';
import { getCallSession } from '@/lib/callSession';
import { useAnswerCall, useEndCall, CALL_IS_OVER, RING_TIMEOUT_MS, type CallStatus } from '@/hooks/useCalls';
import { registerCallBackgroundTask } from '@/lib/callBackgroundTask';
import { registerVoipPush } from '@/lib/voipPush';

export function useCallKeepBridge(enabled: boolean) {
  const answer = useAnswerCall();
  const end = useEndCall();
  const actions = useRef({ enabled, answer: answer.mutateAsync, end: end.mutateAsync });
  actions.current = { enabled, answer: answer.mutateAsync, end: end.mutateAsync };

  useEffect(() => {
    if (!enabled || !isCallKeepSupported()) return;
    let cancelled = false;
    const answering = new Set<string>();
    const stopVoip = registerVoipPush();
    const handlers = {
      onAnswer: (callId: string) => {
        if (!actions.current.enabled || answering.has(callId) || wasAnsweredHere(callId) || isCallDismissed(callId)) return;
        answering.add(callId);
        void actions.current.answer(callId).then((call) => {
          if (cancelled || !actions.current.enabled || isCallDismissed(callId) || call.status !== 'accepted') return;
          bringAppToForeground();
          router.navigate({ pathname: '/call/[callId]', params: { callId } });
        }).catch((error: unknown) => {
          dismissCall(callId);
          if (__DEV__) console.warn('Native answer failed:', error);
        }).finally(() => { answering.delete(callId); });
      },
      onEnd: (callId: string) => {
        if (!actions.current.enabled) return;
        const connected = wasAnsweredHere(callId) || getCallSession()?.callId === callId;
        // Also cancels an answer still awaiting the server. Its late result
        // cannot open media or navigate after this tombstone is recorded.
        dismissCall(callId);
        void actions.current.end({ callId, status: connected ? 'ended' : 'declined',
          reason: connected ? 'hangup' : 'declined' }).catch((error: unknown) => {
          if (__DEV__) console.warn('Native hangup failed:', error);
        });
      },
    };
    const unsubscribe = listenToCallKeep(handlers);
    void (async () => {
      await setupCallKeep();
      if (cancelled) return;
      await registerCallBackgroundTask();
      if (cancelled) return;
      await drainInitialCallKeepEvents(handlers);
      if (cancelled) return;
      // Do not sweep all calls on startup: a ringing push is a valid reason
      // to cold-start the app. Reconcile only the specific rows we know.
      const ids = getSystemRingingCalls();
      if (ids.length) {
        const { data, error } = await supabase.from('calls').select('id, status, created_at').in('id', ids);
        if (!cancelled && !error) for (const id of ids) {
          if (answering.has(id) || wasAnsweredHere(id)) continue;
          const call = data?.find((row) => row.id === id);
          if (!call || CALL_IS_OVER.includes(call.status as CallStatus) || call.status === 'accepted') dismissCall(id);
          else if (Date.now() - Date.parse(call.created_at) >= RING_TIMEOUT_MS) {
            void actions.current.end({ callId: id, status: 'missed', reason: 'timeout' }).catch(() => undefined);
          }
        }
      }
      if (!cancelled && !getCallSession() && !getSystemRingingCalls().length && !answering.size) {
        await promptForPhoneAccount();
      }
    })().catch((error: unknown) => {
      if (__DEV__) console.warn('CallKeep bridge setup failed:', error);
    });
    return () => { cancelled = true; unsubscribe(); stopVoip(); };
  }, [enabled]);
}
