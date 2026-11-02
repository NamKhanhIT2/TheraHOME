import { useSyncExternalStore } from 'react';

export interface GlancePoint {
  x: number;
  y: number;
}

/**
 * Where the mascot is looking, kept OUTSIDE React's tree.
 *
 * It used to be `useState` on HomeScreen, which meant every touch — and the
 * first touch of every scroll gesture is a touch — re-rendered the whole of
 * Home: the hero, the chart, the dial, the roadmap, the article card. In a
 * debug build that lands squarely on the frame the drag starts, which is
 * exactly where the screen was judged to stutter (owner's video,
 * 2026-10-24). Only the mascot needs to know, so only the mascot subscribes.
 *
 * Deliberately module state rather than a context: a context value still
 * re-renders every consumer under the provider, and the provider would have
 * to live above Home.
 */
let point: GlancePoint | null = null;
let timer: ReturnType<typeof setTimeout> | null = null;
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

/** How long the head holds its angle before drifting back to centre. */
const GLANCE_MS = 1600;

export function glanceAt(x: number, y: number) {
  point = { x, y };
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    point = null;
    timer = null;
    emit();
  }, GLANCE_MS);
  emit();
}

/** Call when the host screen unmounts, so a pending reset cannot fire into a
 * screen that is gone. */
export function endGlance() {
  if (timer) clearTimeout(timer);
  timer = null;
  point = null;
}

export function useGlance(): GlancePoint | null {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    () => point,
    () => point,
  );
}
