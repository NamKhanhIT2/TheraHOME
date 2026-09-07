import { useSyncExternalStore } from 'react';

/**
 * Whether the chat thread is currently live.
 *
 * The app ships no network module, and adding one would mean a native
 * rebuild for a banner. It does not need one: `useRealtimeSync` already
 * knows whether the thread's Postgres-changes channel is joined, and that
 * is the state the user actually cares about here — a chat whose socket is
 * down will not show incoming replies, whatever the Wi-Fi icon says.
 *
 * Reported "down" is deliberately slow and "up" is instant. A channel is
 * not joined for the first second of every screen, and it blips on any
 * rejoin; announcing that as lost connection would make the banner flash on
 * a perfectly healthy thread. Four seconds is past every rejoin measured on
 * device and still well inside the window where a person is waiting to know
 * why nothing is arriving.
 */
const DOWN_GRACE_MS = 4000;

let connected = true;
let downTimer: ReturnType<typeof setTimeout> | null = null;
const listeners = new Set<() => void>();

function publish(next: boolean) {
  if (next === connected) return;
  connected = next;
  for (const listener of listeners) listener();
}

/** Called by the chat message subscription on every channel status change. */
export function reportChatChannelStatus(joined: boolean) {
  if (joined) {
    if (downTimer) {
      clearTimeout(downTimer);
      downTimer = null;
    }
    publish(true);
    return;
  }
  if (downTimer) return;
  downTimer = setTimeout(() => {
    downTimer = null;
    publish(false);
  }, DOWN_GRACE_MS);
}

/** Leaving the chat must not leave a stale "offline" banner armed for the
 * next screen that mounts. */
export function resetChatChannelStatus() {
  if (downTimer) {
    clearTimeout(downTimer);
    downTimer = null;
  }
  publish(true);
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useChatConnected(): boolean {
  return useSyncExternalStore(subscribe, () => connected, () => connected);
}
