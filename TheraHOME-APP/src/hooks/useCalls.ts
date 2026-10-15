// Gọi thoại CSKH — the signaling hooks. LiveKit carries the audio (see
// src/lib/livekit.ts); everything about who is calling whom, and whether
// anyone picked up, is the `calls` table plus Realtime on it.
//
// Realtime is the point, not an optimisation: the free-tier rule is that
// neither side may sit in a LiveKit room while the phone rings, so the ring
// itself has to travel over something that costs nothing. That is this table.
//
// Every write goes through an RPC (`start_call` / `answer_call` / `end_call`)
// because the table has no INSERT or UPDATE policy — a client that could
// write it directly could mark its own call answered, or slip past the
// single-line busy gate. See 202610111000_voice_calls.sql.
import { useCallback, useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useRealtimeSync } from '@/hooks/useRealtimeSync';
import type { Database } from '@/types/database';
import { dismissCall, isCallDismissed, markCallActive } from '@/lib/callkeep';
import { closeCallSession, endCallSession, getCallSession, openCallSession, trackCallSession } from '@/lib/callSession';

export type CallStatus = 'ringing' | 'accepted' | 'declined' | 'missed' | 'busy' | 'ended';

export type CallMedia = 'audio' | 'video';

export interface CallRow {
  id: string;
  roomName: string;
  callerId: string;
  /** Who the call is FOR. null means "the support line" — any staff may
   * answer, which is the customer-initiated direction. Set means that one
   * person, which is how CSKH calls a customer back. */
  calleeId: string | null;
  media: CallMedia;
  answeredBy: string | null;
  threadId: string | null;
  status: CallStatus;
  endReason: string | null;
  createdAt: string;
  answeredAt: string | null;
  endedAt: string | null;
  durationSeconds: number | null;
}

/** A status nothing more will happen from — the screen may close. */
export const CALL_IS_OVER: CallStatus[] = ['declined', 'missed', 'busy', 'ended'];

/** Shared with answer_call/expire_stale_calls in the signaling migration. */
export const RING_TIMEOUT_MS = 45_000;

// Maps one database row onto the camelCase shape the screens read. The same
// mapper serves a plain select and all three RPCs, which return the identical
// row type. `status` is narrowed by hand: the column is a text CHECK, so the
// generated type is a bare string and the union above is the one place the
// allowed values are written down.
function toCallRow(row: Database['public']['Tables']['calls']['Row']): CallRow {
  return {
    id: row.id,
    roomName: row.room_name,
    callerId: row.caller_id,
    calleeId: row.callee_id ?? null,
    media: (row.media === 'video' ? 'video' : 'audio') as CallMedia,
    answeredBy: row.answered_by ?? null,
    threadId: row.thread_id ?? null,
    status: row.status as CallStatus,
    endReason: row.end_reason ?? null,
    createdAt: row.created_at,
    answeredAt: row.answered_at ?? null,
    endedAt: row.ended_at ?? null,
    durationSeconds: row.duration_seconds ?? null,
  };
}

/**
 * One call, kept live.
 *
 * Both sides of a call watch the same row and react to its `status`: the
 * caller waits for 'accepted', CSKH's incoming sheet closes when the caller
 * gives up, and both screens close on a terminal status. `useRealtimeSync`
 * rather than a bare subscribe for the reason documented there — a websocket
 * the OS suspended must be rebuilt AND refetched, or a call that was answered
 * while the screen was briefly backgrounded never connects.
 */
export function useCall(callId: string | undefined) {
  const queryClient = useQueryClient();
  const key = ['call', callId] as const;

  useRealtimeSync({
    enabled: !!callId,
    channelName: `call_${callId}`,
    bind: (channel) =>
      channel.on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'calls', filter: `id=eq.${callId}` },
        () => queryClient.invalidateQueries({ queryKey: key }),
      ),
    onSync: () => queryClient.invalidateQueries({ queryKey: key }),
  });

  return useQuery({
    queryKey: key,
    queryFn: async (): Promise<CallRow | null> => {
      const { data, error } = await supabase.from('calls').select('*').eq('id', callId!).maybeSingle();
      if (error) throw error;
      // A read started before hangup can arrive after the terminal RPC.
      const cached = queryClient.getQueryData<CallRow>(key);
      if (cached && CALL_IS_OVER.includes(cached.status)) return cached;
      return data ? toCallRow(data) : null;
    },
    enabled: !!callId,
    // A safety net, not the mechanism. If Realtime is down the call still
    // connects, a couple of seconds late, instead of ringing forever.
    refetchInterval: (query) => (query.state.data && CALL_IS_OVER.includes(query.state.data.status) ? false : 3000),
  });
}

/** The customer taps "Gọi". Resolves to the created row — which may come back
 * with status 'busy' when the single CSKH line is already taken; that is an
 * ordinary outcome, not an error. */
export interface StartCallInput {
  threadId?: string | null;
  /** Omit for a customer calling the support line. Staff pass the customer's
   * id to call them back; the RPC refuses any other value. */
  calleeId?: string | null;
  media?: CallMedia;
}

export function useStartCall() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: StartCallInput = {}): Promise<CallRow> => {
      const current = getCallSession();
      if (current) throw new Error('call_already_active');
      // `undefined`, not null: these arguments are optional in the generated
      // signature (they have SQL defaults), so sending null fails the type
      // while sending nothing lets the default apply.
      const { data, error } = await supabase.rpc('start_call', {
        p_thread_id: input.threadId ?? undefined,
        p_callee_id: input.calleeId ?? undefined,
        p_media: input.media ?? 'audio',
      });
      if (error) throw error;
      const call = toCallRow(data);

      // Ring the staff phone that is NOT currently looking at the app.
      // Realtime covers a foreground CSKH app on its own; this is the other
      // case, and it is fire-and-forget on purpose — a push that fails must
      // not fail the call, which is already ringing in the database by now.
      if (call.status === 'ringing') {
        // TWO pushes, deliberately. The Expo one reaches an Android phone and
        // an iPhone that is merely backgrounded; the VoIP one is the only
        // thing that rings a LOCKED iPhone, and Expo's service cannot send
        // it. Both are fire-and-forget: the call is already ringing in the
        // database, and a failed push must not fail the call.
        void supabase.functions
          .invoke('dispatch-push', { body: { mode: 'call', callId: call.id } })
          .then(({ error: pushError }) => {
            if (pushError && __DEV__) console.warn('call push failed:', pushError);
          });
        void supabase.functions
          .invoke('dispatch-voip-push', { body: { callId: call.id } })
          .then(({ error: voipError }) => {
            // 503 here just means APNs is not configured yet, which is not
            // worth shouting about on every call.
            if (voipError && __DEV__) console.warn('voip push failed:', voipError);
          });
      }
      return call;
    },
    onSuccess: (call) => {
      queryClient.setQueryData(['call', call.id], call);
      if (call.status === 'ringing') trackCallSession(call.id, call.media);
    },
  });
}

const answering = new Map<string, Promise<CallRow>>();

export function useAnswerCall() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (callId: string): Promise<CallRow> => {
      const current = getCallSession();
      if (current && current.callId !== callId) throw new Error('call_already_active');
      const existing = answering.get(callId);
      if (existing) return existing;
      const attempt = (async () => {
        const { data, error } = await supabase.rpc('answer_call', { p_call_id: callId });
        if (error) throw error;
        return toCallRow(data);
      })();
      answering.set(callId, attempt);
      try { return await attempt; } finally { answering.delete(callId); }
    },
    onSuccess: (call) => {
      queryClient.invalidateQueries({ queryKey: ['incoming_call'] });
      // A delayed answer response must not overwrite an end_call response
      // that already closed this call on the same device.
      if (call.status === 'accepted' && isCallDismissed(call.id)) {
        void queryClient.invalidateQueries({ queryKey: ['call', call.id] });
        return;
      }
      queryClient.setQueryData(['call', call.id], call);
      if (CALL_IS_OVER.includes(call.status)) {
        dismissCall(call.id);
        cancelCallPushes(call.id);
        void closeCallSession(call.id);
        return;
      }
      if (call.status !== 'accepted') return;
      // The system may also be ringing for this call — a push raised it while
      // the app happened to be open, so the user saw both our sheet and the
      // telecom screen. Answering in the app has to tell the system too, or
      // Android keeps ringing behind a call that is already connected and
      // iOS leaves CallKit stuck on "connecting". A no-op when the system
      // never knew about this call, which is the common case.
      markCallActive(call.id);
      // Answering from the lock screen must establish media even before a
      // route is mounted (iOS may leave the app behind the lock screen).
      void openCallSession(call.id, call.media);
      // Every OTHER staff phone is still ringing for a call that now has an
      // answer. Nothing else stops them: a locked phone has no app running
      // to hear the Realtime update. The function will not send this back to
      // us, so the call we just took is safe.
      cancelCallPushes(call.id);
    },
    onError: () => {
      void queryClient.invalidateQueries({ queryKey: ['incoming_call'] });
    },
  });
}

/**
 * Tells every other phone that was ringing for this call to stop.
 *
 * Realtime already tells any RUNNING app that the call is over. The case it
 * cannot reach is the one that needs reaching: the app closed, the phone
 * locked, and a system call screen raised by a push with nothing alive
 * behind it. It rings on until someone answers a call that ended minutes
 * ago. A second push is the only way to take that screen down, so both push
 * channels get a cancel — Expo's for Android, APNs/PushKit for iOS.
 *
 * Two channels, same as starting a call: `dispatch-call-cancel` carries the
 * Android half over Expo, `dispatch-voip-push` the iOS half over PushKit.
 * They are separate services with separate device tokens; neither can do
 * the other's job.
 *
 * Fire-and-forget on purpose. The call is already resolved in the database;
 * a failed cancel must never fail the thing that resolved it. Both functions
 * refuse a call that is still ringing and never send back to the caller of
 * THIS function, so neither can be used to silence a live conversation.
 */
function cancelCallPushes(callId: string): void {
  void supabase.functions
    .invoke('dispatch-call-cancel', { body: { callId } })
    .then(({ error }) => {
      if (error && __DEV__) console.warn('call cancel push failed:', error);
    });
  void supabase.functions
    .invoke('dispatch-voip-push', { body: { callId, cancel: true } })
    .then(({ error }) => {
      if (error && __DEV__) console.warn('voip cancel push failed:', error);
    });
}

/**
 * Hang up, decline, or report a ring-out.
 *
 * Idempotent on the server: native actions, timeouts and either participant
 * can race to resolve a call. Leaving the screen never ends it.
 */
export function useEndCall() {
  const queryClient = useQueryClient();
  return useMutation({
    retry: 2,
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 5000),
    onMutate: async ({ callId, reason }) => {
      // A timeout can race an answer. Only the server may decide that race;
      // an explicit hangup, however, stops local audio immediately.
      if (reason === 'timeout') return;
      dismissCall(callId);
      endCallSession(callId);
      await queryClient.cancelQueries({ queryKey: ['call', callId] });
    },
    mutationFn: async ({ callId, status = 'ended', reason = 'hangup' }: {
      callId: string;
      status?: 'ended' | 'declined' | 'missed';
      reason?: string;
    }): Promise<CallRow> => {
      const { data, error } = await supabase.rpc('end_call', { p_call_id: callId, p_status: status, p_reason: reason });
      if (error) throw error;
      return toCallRow(data);
    },
    onSuccess: (call) => {
      const cached = queryClient.getQueryData<CallRow>(['call', call.id]);
      if (cached && CALL_IS_OVER.includes(cached.status) && !CALL_IS_OVER.includes(call.status)) return;
      queryClient.setQueryData(['call', call.id], call);
      queryClient.invalidateQueries({ queryKey: ['incoming_call'] });
      queryClient.invalidateQueries({ queryKey: ['call_history'] });
      if (!CALL_IS_OVER.includes(call.status)) return;
      dismissCall(call.id);
      void closeCallSession(call.id);
      // A call that was never answered was, by definition, still ringing
      // somewhere when it ended — on phones that may have nothing running
      // to notice. `answered_at` is the server's own record of that, which
      // is why the condition reads off the returned row rather than off
      // whatever the client thought the status was.
      if (!call.answeredAt) cancelCallPushes(call.id);
    },
  });
}

/** Explicit hangup only. Navigation and backgrounding never end a call. */
export function useCallTerminator(callId: string | undefined) {
  const endCall = useEndCall();
  // Keyed by call id, not a bare boolean. The call screen unmounts between
  // calls so a boolean would do there, but the incoming-call sheet stays
  // mounted for the staff's whole session: a flag latched by declining one
  // call would silently swallow the decline of every call after it.
  const endedForRef = useRef<string | null>(null);
  const callIdRef = useRef(callId);
  callIdRef.current = callId;
  const mutateRef = useRef(endCall.mutateAsync);
  mutateRef.current = endCall.mutateAsync;

  const terminate = useCallback(async (status: 'ended' | 'declined' | 'missed' = 'ended', reason = 'hangup') => {
    const id = callIdRef.current;
    if (!id || endedForRef.current === id) return;
    endedForRef.current = id;
    try {
      const call = await mutateRef.current({ callId: id, status, reason });
      if (!CALL_IS_OVER.includes(call.status)) endedForRef.current = null;
    } catch {
      // Released so a retry is possible. The janitor in `expire_stale_calls`
      // is the backstop behind that: a call this failed to end is cleared on
      // the next attempt by anyone, so the line cannot stay held because one
      // hangup did not reach the server.
      if (endedForRef.current === id) endedForRef.current = null;
    }
  }, []);

  return terminate;
}

/**
 * The one call currently ringing FOR THIS USER, if any.
 *
 * Serves both directions, which is why it needs to know who is asking:
 *   staff    → calls addressed to the support line (`callee_id is null`).
 *   customer → calls addressed to them by name (`callee_id = me`).
 *
 * A customer must never be shown a call ringing on the support line, and
 * staff must never be shown a private call between two other people, so this
 * filters rather than relying on RLS alone — RLS admits staff to every row.
 *
 * Watches INSERT as well as UPDATE: an INSERT is a new call arriving, an
 * UPDATE is the other side giving up while the sheet is open.
 */
export function useIncomingCall({ enabled, userId, isStaff }: {
  enabled: boolean;
  userId: string | undefined;
  isStaff: boolean;
}) {
  const queryClient = useQueryClient();
  const key = ['incoming_call', userId, isStaff] as const;
  const armed = enabled && !!userId;

  useRealtimeSync({
    enabled: armed,
    channelName: `incoming_call_${isStaff ? 'line' : userId}`,
    bind: (channel) =>
      channel.on('postgres_changes', { event: '*', schema: 'public', table: 'calls' }, () =>
        queryClient.invalidateQueries({ queryKey: key }),
      ),
    onSync: () => queryClient.invalidateQueries({ queryKey: key }),
  });

  return useQuery({
    queryKey: key,
    queryFn: async (): Promise<CallRow | null> => {
      // Only genuinely fresh rings. A row older than the ring timeout is one
      // the janitor has not swept yet; showing it would ring a phone for a
      // caller who gave up minutes ago.
      const since = new Date(Date.now() - RING_TIMEOUT_MS).toISOString();
      let query = supabase
        .from('calls')
        .select('*')
        .eq('status', 'ringing')
        .neq('caller_id', userId!)
        .gte('created_at', since);
      query = isStaff ? query.or(`callee_id.is.null,callee_id.eq.${userId!}`) : query.eq('callee_id', userId!);
      const { data, error } = await query
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      const call = data ? toCallRow(data) : null;
      // Never ring someone for their own outgoing call. Staff placing a call
      // to a customer would otherwise match their own row the moment the
      // customer's side is also staff (a dual-role admin testing on two
      // accounts), and the sheet would open over their own call screen.
      return call && call.callerId !== userId ? call : null;
    },
    enabled: armed,
    refetchInterval: armed ? 5000 : false,
  });
}

/** The caller who is ringing, for the incoming sheet's header. */
export function useCallerProfile(userId: string | undefined) {
  return useQuery({
    queryKey: ['call_caller', userId],
    queryFn: async (): Promise<{ fullName: string; avatarUrl: string | null; phone: string | null }> => {
      const { data, error } = await supabase
        .from('profiles')
        .select('full_name, avatar_url, phone')
        .eq('id', userId!)
        .maybeSingle();
      if (error) throw error;
      return {
        fullName: data?.full_name?.trim() || 'Khách hàng',
        avatarUrl: data?.avatar_url ?? null,
        phone: data?.phone ?? null,
      };
    },
    enabled: !!userId,
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Elapsed seconds of a connected call, ticking once a second.
 *
 * Counts from the server's `answered_at` rather than from when this screen
 * connected, so both sides show the same duration and a reconnect does not
 * restart the clock.
 */
export function useCallDuration(answeredAt: string | null | undefined): number {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    if (!answeredAt) {
      setSeconds(0);
      return;
    }
    const startedAt = new Date(answeredAt).getTime();
    const tick = () => setSeconds(Math.max(0, Math.floor((Date.now() - startedAt) / 1000)));
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [answeredAt]);
  return seconds;
}

export function formatCallDuration(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(rest).padStart(2, '0')}`;
}
