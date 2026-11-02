import { useSyncExternalStore } from 'react';

/**
 * Whether the water dial has reached the middle of the screen — the cue for
 * its needle to sweep up from zero.
 *
 * Outside React for the same reason as the glance point: this is written from
 * the scroll listener, and as `useState` on HomeScreen it re-rendered the
 * whole screen in the middle of a drag. Once per session, but the drag it
 * lands in is precisely the one the owner filmed stuttering (2026-10-24).
 */
let arrived = false;
const listeners = new Set<() => void>();

export function markWaterArrived() {
  if (arrived) return;
  arrived = true;
  for (const listener of listeners) listener();
}

/** Home calls this as it unmounts, so the dial animates again next visit. */
export function resetWaterArrival() {
  arrived = false;
}

export function useWaterArrived(): boolean {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    () => arrived,
    () => arrived,
  );
}
