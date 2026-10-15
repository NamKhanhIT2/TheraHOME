// Native and in-app actions use the same signaling mutations and media owner.
import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { router } from 'expo-router';
import { supabase } from '@/lib/supabase';
import {
  bringAppToForeground, dismissCall, drainInitialCallKeepEvents,
  getSystemRingingCalls, isCallDismissed, isCallKeepSupported,
  listenToCallKeep, promptForPhoneAccount, setupCallKeep, wasAnsweredHere,
} from '@/lib/callkeep';
import { getCallSession, setSessionMicOn } from '@/lib/callSession';
import { useAnswerCall, useEndCall, CALL_IS_OVER, RING_TIMEOUT_MS, type CallStatus } from '@/hooks/useCalls';
import { registerCallBackgroundTask } from '@/lib/callBackgroundTask';
import { registerVoipPush } from '@/lib/voipPush';

/**
 * @param enabled   A session exists and the account is not blocked. Deliberately
 *                  NOT the full `inApp`: that waits on a profile fetch, and a
 *                  phone woken by a VoIP push must be able to answer before any
 *                  network round trip has finished.
 * @param settledIn The user is actually inside the app — past onboarding, with
 *                  a profile. Used ONLY to decide whether this is a reasonable
 *                  moment to ask Android for the calling-account permission,
 *                  which must not land on top of the intake questions.
 */
export function useCallKeepBridge(enabled: boolean, settledIn = true) {
  const answer = useAnswerCall();
  const end = useEndCall();
  const actions = useRef({ enabled, settledIn, answer: answer.mutateAsync, end: end.mutateAsync });
  actions.current = { enabled, settledIn, answer: answer.mutateAsync, end: end.mutateAsync };

  useEffect(() => {
    if (!enabled || !isCallKeepSupported()) return;
    let cancelled = false;
    const answering = new Set<string>();
    const pendingNavigation = new Set<{ remove: () => void }>();

    /**
     * Opens the call screen, but never while the app is in the background.
     *
     * Answering on the lock screen gets here with the app not active and the
     * screen still locked, and navigating a React tree that is not on screen
     * left the app showing nothing at all once it was unlocked — a black
     * screen that only killing the app cleared. Reported 2026-10-15, and
     * absent from every call where the phone was never locked, which is what
     * narrowed it to this.
     *
     * So the navigation waits for the app to actually come forward. Nothing
     * is lost by waiting: until then there is no one looking at it, and
     * CallKit is showing the call anyway.
     */
    function openCallScreen(callId: string) {
      const go = () => {
        if (cancelled || isCallDismissed(callId)) return;
        router.navigate({ pathname: '/call/[callId]', params: { callId } });
      };
      if (AppState.currentState === 'active') {
        go();
        return;
      }
      const subscription = AppState.addEventListener('change', (state) => {
        if (state !== 'active') return;
        subscription.remove();
        pendingNavigation.delete(subscription);
        go();
      });
      pendingNavigation.add(subscription);
    }

    const stopVoip = registerVoipPush();
    const handlers = {
      onAnswer: (callId: string) => {
        if (!actions.current.enabled || answering.has(callId) || wasAnsweredHere(callId) || isCallDismissed(callId)) return;
        answering.add(callId);
        void actions.current.answer(callId).then((call) => {
          if (cancelled || !actions.current.enabled || isCallDismissed(callId) || call.status !== 'accepted') return;
          bringAppToForeground();
          openCallScreen(callId);
        }).catch((error: unknown) => {
          dismissCall(callId);
          if (__DEV__) console.warn('Native answer failed:', error);
        }).finally(() => { answering.delete(callId); });
      },
      onSetMuted: (callId: string, muted: boolean) => {
        // Only for the call this device is actually in: a stale action for
        // some other id must not reach into a live conversation.
        if (!actions.current.enabled || getCallSession()?.callId !== callId) return;
        setSessionMicOn(!muted);
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
      if (!cancelled && actions.current.settledIn && !getCallSession()
        && !getSystemRingingCalls().length && !answering.size) {
        await promptForPhoneAccount();
      }
    })().catch((error: unknown) => {
      if (__DEV__) console.warn('CallKeep bridge setup failed:', error);
    });
    return () => {
      cancelled = true;
      for (const subscription of pendingNavigation) subscription.remove();
      pendingNavigation.clear();
      unsubscribe();
      stopVoip();
    };
  }, [enabled]);
}
