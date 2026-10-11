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
import { dismissCall, markCallActive } from '@/lib/callkeep';

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

/** How long the caller lets it ring before giving up. Kept a little under the
 * database janitor's 90s so the UI gives up first and the row is reported as
 * missed by the person who was actually waiting. */
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
  return useMutation({
    mutationFn: async (input: StartCallInput = {}): Promise<CallRow> => {
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
  });
}

export function useAnswerCall() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (callId: string): Promise<CallRow> => {
      const { data, error } = await supabase.rpc('answer_call', { p_call_id: callId });
      if (error) throw error;
      return toCallRow(data);
    },
    onSuccess: (call) => {
      queryClient.setQueryData(['call', call.id], call);
      queryClient.invalidateQueries({ queryKey: ['incoming_call'] });
      // The system may also be ringing for this call — a push raised it while
      // the app happened to be open, so the user saw both our sheet and the
      // telecom screen. Answering in the app has to tell the system too, or
      // Android keeps ringing behind a call that is already connected and
      // iOS leaves CallKit stuck on "connecting". A no-op when the system
      // never knew about this call, which is the common case.
      markCallActive(call.id);
    },
  });
}

/**
 * Hang up, decline, or report a ring-out.
 *
 * Idempotent on the server, which matters because both sides race to end
 * every call: one presses the red button, the other's screen unmounts and
 * ends it too.
 */
export function useEndCall() {
  const queryClient = useQueryClient();
  return useMutation({
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
      queryClient.setQueryData(['call', call.id], call);
      queryClient.invalidateQueries({ queryKey: ['incoming_call'] });
      queryClient.invalidateQueries({ queryKey: ['call_history'] });
    },
  });
}

/**
 * Ends a call exactly once, whatever happens to the screen.
 *
 * A call must be ended on the way out even when the component unmounts
 * because the user swiped back, hit the hardware back button, or was
 * navigated away — and in every one of those paths React has already thrown
 * away the state a `useEffect` cleanup would read. So the id and the mutation
 * live in refs, and the guard flag makes a second attempt a no-op rather than
 * a second RPC.
 */
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
    // Clear the system call UI for THIS call, whichever way the app is
    // ending it — declined in the sheet, hung up on the call screen, rung
    // out. Android will otherwise keep a connection (and its notification)
    // alive for a call that no longer exists, and the next call may not ring
    // at all. Done first, so a failed round trip below still leaves a phone
    // that has stopped ringing.
    dismissCall(id);
    try {
      await mutateRef.current({ callId: id, status, reason });
    } catch {
      // Released so a retry is possible. The janitor in `expire_stale_calls`
      // is the backstop behind that: a call this failed to end is cleared on
      // the next attempt by anyone, so the line cannot stay held because one
      // hangup did not reach the server.
      endedForRef.current = null;
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
  const key = ['incoming_call', isStaff ? 'line' : userId] as const;
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
        .gte('created_at', since);
      query = isStaff ? query.is('callee_id', null) : query.eq('callee_id', userId!);
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
