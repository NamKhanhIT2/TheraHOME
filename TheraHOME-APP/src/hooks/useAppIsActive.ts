// Backgrounded/inactive app state -> video playback (and anything else that
// wants to stop while the app isn't in front) should pause. See
// useVideoPlaybackStore.ts.
import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

export function useAppIsActive(): boolean {
  const [active, setActive] = useState(AppState.currentState === 'active');

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => setActive(state === 'active'));
    return () => sub.remove();
  }, []);

  return active;
}
