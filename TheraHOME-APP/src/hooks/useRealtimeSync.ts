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
export function useRealtimeSync({
  channelName,
  bind,
  onSync,
  enabled = true,
}: {
  /** Stable prefix; a random suffix is added so two screens never collide. */
  channelName: string;
  /** Attach the `.on('postgres_changes', ...)` listeners for this channel. */
  bind: (channel: RealtimeChannel) => RealtimeChannel;
  /** Refetch whatever this channel feeds. Called on change and on every join. */
  onSync: () => void;
  enabled?: boolean;
}) {
  const onSyncRef = useRef(onSync);
  onSyncRef.current = onSync;
  const bindRef = useRef(bind);
  bindRef.current = bind;

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    let channel: RealtimeChannel | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let attempt = 0;

    function teardown() {
      if (retryTimer) {
        clearTimeout(retryTimer);
        retryTimer = null;
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
      teardown();
      channel = bindRef.current(supabase.channel(`${channelName}_${Math.random().toString(36).slice(2)}`));
      channel.subscribe((status) => {
        if (cancelled) return;
        if (status === 'SUBSCRIBED') {
          attempt = 0;
          // Covers anything written while this channel was down.
          onSyncRef.current();
          return;
        }
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
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
