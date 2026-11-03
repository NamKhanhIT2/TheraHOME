import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

/**
 * Subscribes to Postgres changes and keeps that subscription honest.
 *
 * The bare `supabase.channel(...).on(...).subscribe()` calls this replaces did
 * three things wrong, and every one of them ends the same way: the screen sits
 * on stale rows until the user navigates away and back, which is what
 * refetches it (owner report, 2026-09-07: "khi có tin nhắn mới thì hiện lên
 * luôn chứ ko phải thoát ra rồi vào lại mới thấy").
 *
 *  1. The subscribe status was thrown away. CHANNEL_ERROR, TIMED_OUT and
 *     CLOSED all looked exactly like success, so a channel that never joined —
 *     or that died later — was never noticed, let alone retried.
 *  2. Nothing reacted to the app being backgrounded. iOS and Android suspend
 *     the websocket; whatever is written while it is down is simply never
 *     delivered, because postgres_changes has no replay.
 *  3. Even a healthy rejoin left that gap open. Reconnecting tells you about
 *     the NEXT change, never the ones you missed, so the fix has to be a
 *     refetch on every (re)join, not just on the first one.
 *
 * `onSync` is therefore called on each change AND once per successful join.
 * It is read through a ref so a caller can pass an inline closure without
 * tearing the channel down on every render.
 *
 * The realtime server itself was verified working from this project's anon
 * key on 2026-09-07 (a `chat_messages` channel reaches SUBSCRIBED), so this
 * is purely about the client side surviving a real phone's lifecycle.
 */
/** How long a channel has to stay joined before its join counts as proof
 * that the connection is healthy. See `attempt` below. */
const STEADY_MS = 30000;

export function useRealtimeSync({
  channelName,
  bind,
  onSync,
  onConnectionChange,
  enabled = true,
}: {
  /** Stable prefix; a random suffix is added so two screens never collide. */
  channelName: string;
  /** Attach the `.on('postgres_changes', ...)` listeners for this channel. */
  bind: (channel: RealtimeChannel) => RealtimeChannel;
  /** Refetch whatever this channel feeds. Called on change and on every join. */
  onSync: () => void;
  /** Joined or not, on every status change. Lets a screen tell the user the
   * thread has gone quiet because the socket dropped, not because nobody
   * replied. Read through a ref, same as `onSync`. */
  onConnectionChange?: (joined: boolean) => void;
  enabled?: boolean;
}) {
  const onSyncRef = useRef(onSync);
  onSyncRef.current = onSync;
  const onConnectionChangeRef = useRef(onConnectionChange);
  onConnectionChangeRef.current = onConnectionChange;
  const bindRef = useRef(bind);
  bindRef.current = bind;

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    let channel: RealtimeChannel | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let steadyTimer: ReturnType<typeof setTimeout> | null = null;
    let attempt = 0;
    // Which connect() attempt owns the channel right now. A status callback
    // belonging to an older one is a ghost and must not act — see connect().
    let generation = 0;
    let joinedOnce = false;

    function teardown() {
      if (retryTimer) {
        clearTimeout(retryTimer);
        retryTimer = null;
      }
      if (steadyTimer) {
        clearTimeout(steadyTimer);
        steadyTimer = null;
      }
      if (channel) {
        // Fire and forget: the channel is being discarded either way, and a
        // failed unsubscribe must not stop the replacement from connecting.
        void supabase.removeChannel(channel);
        channel = null;
      }
    }

    function connect() {
      if (cancelled) return;
      // Claimed BEFORE teardown, because teardown is what produces the ghost
      // this guards against: `removeChannel` makes the channel being
      // discarded report CLOSED, and that report arrives at the callback
      // registered below for the PREVIOUS attempt. Untagged, that dead
      // channel schedules a reconnect, which tears down again, which reports
      // CLOSED again — a cycle that feeds itself and never stops.
      //
      // It ran at exactly one refetch per second on every screen that uses
      // this hook, around the clock, because `attempt` was also reset on each
      // successful join so the backoff never left its 1000ms floor. One idle
      // phone was making ~180 requests a minute and the project reached 99%
      // of its monthly egress in twenty days (measured 2026-11-03).
      const mine = ++generation;
      teardown();
      channel = bindRef.current(supabase.channel(`${channelName}_${Math.random().toString(36).slice(2)}`));
      channel.subscribe((status) => {
        if (cancelled || mine !== generation) return;
        if (status === 'SUBSCRIBED') {
          onConnectionChangeRef.current?.(true);
          // Only a REJOIN has a gap behind it. The first join happens while
          // the query it feeds is already fetching on mount, so syncing there
          // only asks for the same rows twice.
          if (joinedOnce) onSyncRef.current();
          joinedOnce = true;
          // The backoff resets once the channel has PROVED it can hold, not
          // the instant it joins: a channel that joins and immediately drops
          // is exactly the case the backoff exists for.
          if (steadyTimer) clearTimeout(steadyTimer);
          steadyTimer = setTimeout(() => { attempt = 0; }, STEADY_MS);
          return;
        }
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          onConnectionChangeRef.current?.(false);
          // Backoff so a server that is genuinely unavailable is not hammered:
          // 1s, 2s, 4s, 8s, then every 15s.
          const delay = Math.min(1000 * 2 ** attempt, 15000);
          attempt += 1;
          if (retryTimer) clearTimeout(retryTimer);
          retryTimer = setTimeout(connect, delay);
        }
      });
    }

    connect();

    const appStateSub = AppState.addEventListener('change', (state) => {
      if (state !== 'active' || cancelled) return;
      // Coming back from the background. If the socket survived, the channel
      // is still joined and TanStack's own focus refetch has it covered; if it
      // did not, nothing else will ever rebuild it.
      if (!channel || channel.state !== 'joined') {
        attempt = 0;
        connect();
      }
    });

    return () => {
      cancelled = true;
      appStateSub.remove();
      teardown();
    };
  }, [channelName, enabled]);
}
