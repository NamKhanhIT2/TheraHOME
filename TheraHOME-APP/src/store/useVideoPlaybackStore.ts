// Ephemeral (not persisted) single-source-of-truth for "which video is
// allowed to actually play" across the whole app — Community feed, Post
// Detail, the profile's own-posts list, and the immersive viewer all share
// this one store. Every video item derives its own `playing` state purely
// from `activeId === myId`, so claiming a new active id automatically
// reconciles every other subscriber's playback with no imperative
// pause-callback registry needed. See CLAUDE.md's "Community video
// playback overhaul" section.
import { create } from 'zustand';

interface VideoPlaybackState {
  activeId: string | null;
  soundEnabled: boolean;
  claim: (id: string) => void;
  release: (id: string) => void;
  toggleSound: () => void;
}

export const useVideoPlaybackStore = create<VideoPlaybackState>((set, get) => ({
  activeId: null,
  soundEnabled: false,
  claim: (id) => {
    if (get().activeId !== id) set({ activeId: id });
  },
  release: (id) => {
    if (get().activeId === id) set({ activeId: null });
  },
  toggleSound: () => set((state) => ({ soundEnabled: !state.soundEnabled })),
}));
