import { useEffect, useRef, useState } from 'react';

/**
 * Keeps a loading placeholder on screen long enough to be read.
 *
 * A skeleton that appears and vanishes inside ~100ms reads as a flash, not as
 * feedback — worse than showing nothing. This holds the flag true for at least
 * `minMs` once it has gone true, so the placeholder either does its job or is
 * never seen strobing. It never delays the *start* of the placeholder, only
 * its exit, so a genuinely slow screen still shows something immediately.
 *
 * Deliberately no fade: the app already had to strip animations out of the
 * community feed for costing frames on release builds, and a steady swap reads
 * calmer than a cross-dissolve at this size.
 */
export function useSteadyLoading(loading: boolean, minMs = 350): boolean {
  const [held, setHeld] = useState(loading);
  const shownAt = useRef<number | null>(loading ? Date.now() : null);

  useEffect(() => {
    if (loading) {
      if (shownAt.current === null) shownAt.current = Date.now();
      setHeld(true);
      return;
    }
    if (shownAt.current === null) {
      setHeld(false);
      return;
    }
    const remaining = Math.max(0, minMs - (Date.now() - shownAt.current));
    if (remaining === 0) {
      shownAt.current = null;
      setHeld(false);
      return;
    }
    const timer = setTimeout(() => {
      shownAt.current = null;
      setHeld(false);
    }, remaining);
    return () => clearTimeout(timer);
  }, [loading, minMs]);

  return held;
}
