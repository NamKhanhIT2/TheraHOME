import { create } from 'zustand';

/**
 * A tiny, non-persisted bridge between the day screen and the live training
 * screen. The glow is rendered above the root Stack, so keeping its phase
 * here lets it survive the native navigation transition instead of being
 * clipped to (or disappearing with) the card that launched it.
 */
type EdgeGlowPhase = 'idle' | 'ignite' | 'settle';

interface EdgeGlowTransitionState {
  phase: EdgeGlowPhase;
  ignite: () => void;
  settle: () => void;
  reset: () => void;
}

export const useEdgeGlowTransition = create<EdgeGlowTransitionState>((set) => ({
  phase: 'idle',
  ignite: () => set({ phase: 'ignite' }),
  settle: () => set((state) => (state.phase === 'idle' || state.phase === 'settle' ? state : { phase: 'settle' })),
  // A finished fade can queue this on JS just as a new training session
  // starts. Only the phase that actually finished may be cleared.
  reset: () => set((state) => (state.phase === 'settle' ? { phase: 'idle' } : state)),
}));
