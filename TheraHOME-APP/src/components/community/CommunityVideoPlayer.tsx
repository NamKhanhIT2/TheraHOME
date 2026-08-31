// The one implementation of a Community video item — feed, post detail,
// profile list, and grid cells all render this. Owns: viewport/focus-driven
// autoplay (via `shouldAutoplay`, reconciled against a manual pause/play
// override), the single-active-video-across-the-app coordination
// (useVideoPlaybackStore), the global mute preference, a loading spinner
// while the player buffers, and (mode="single" only) aspect-ratio-aware
// sizing read from the actual video file plus the mute/pause icon overlay.
// See CLAUDE.md's "Community video playback overhaul" section.
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { VideoView, useVideoPlayer } from 'expo-video';
import { useEvent } from 'expo';
import { useTheme } from '@/theme';
import { Icon } from '@/components/icons/Icon';
import { useAppIsActive } from '@/hooks/useAppIsActive';
import { useVideoPlaybackStore } from '@/store/useVideoPlaybackStore';

// In-feed videos narrower than 4:5 (this includes 9:16) are cropped to a
// 4:5 "preview" via `cover` rather than shown at their full tall height —
// the uncropped video is still reachable via the immersive viewer's
// `contain`. Landscape/square/4:5 videos are shown at their true ratio,
// clamped the same way CommunityPostImage clamps images.
const PREVIEW_MIN_RATIO = 4 / 5;
const MAX_RATIO = 1.9;
const DEFAULT_RATIO = 4 / 3;

export interface CommunityVideoPlayerProps {
  uri: string;
  itemId: string;
  shouldAutoplay: boolean;
  mode: 'single' | 'grid';
  onOpenViewer: () => void;
}

export function CommunityVideoPlayer({ uri, itemId, shouldAutoplay, mode, onOpenViewer }: CommunityVideoPlayerProps) {
  const theme = useTheme();
  const appActive = useAppIsActive();
  const soundEnabled = useVideoPlaybackStore((s) => s.soundEnabled);
  const isActive = useVideoPlaybackStore((s) => s.activeId === itemId);
  const player = useVideoPlayer(uri, (instance) => {
    instance.loop = false;
  });
  const { status } = useEvent(player, 'statusChange', { status: player.status });
  const { availableVideoTracks } = useEvent(player, 'sourceLoad', {
    videoSource: null,
    duration: 0,
    availableVideoTracks: [],
    availableSubtitleTracks: [],
    availableAudioTracks: [],
  });

  // null = "no manual override, follow shouldAutoplay" — reset every time
  // eligibility itself changes (entering/leaving viewport, focus change) so
  // re-entering the viewport always autoplays fresh, matching the spec,
  // even if the user had paused it on a previous pass through the feed.
  const [manualOverride, setManualOverride] = useState<boolean | null>(null);
  useEffect(() => setManualOverride(null), [shouldAutoplay]);
  const desiredPlaying = manualOverride ?? shouldAutoplay;
  const shouldPlay = desiredPlaying && appActive;

  useEffect(() => {
    const { claim, release } = useVideoPlaybackStore.getState();
    if (shouldPlay) claim(itemId); else release(itemId);
  }, [shouldPlay, itemId]);

  useEffect(() => {
    return () => useVideoPlaybackStore.getState().release(itemId);
  }, [itemId]);

  useEffect(() => {
    if (isActive) void player.play(); else player.pause();
  }, [isActive, player]);

  useEffect(() => {
    player.muted = mode === 'grid' ? true : !soundEnabled;
  }, [soundEnabled, mode, player]);

  const size = availableVideoTracks[0]?.size;
  const rawRatio = size && size.height > 0 ? size.width / size.height : null;
  const cropped = rawRatio != null && rawRatio < PREVIEW_MIN_RATIO;
  const displayRatio = rawRatio == null ? DEFAULT_RATIO : cropped ? PREVIEW_MIN_RATIO : Math.min(rawRatio, MAX_RATIO);
  const loading = status === 'idle' || status === 'loading';

  const video = (
    <View style={mode === 'single' ? [styles.frame, { backgroundColor: theme.colors.bgCardAlt, borderRadius: theme.radius.md, aspectRatio: displayRatio }] : StyleSheet.absoluteFill}>
      <VideoView player={player} nativeControls={false} contentFit={mode === 'grid' || cropped ? 'cover' : 'contain'} style={styles.media} />
      {loading ? (
        <View style={[StyleSheet.absoluteFill, styles.loadingOverlay]} pointerEvents="none">
          <ActivityIndicator color="#fff" />
        </View>
      ) : null}
    </View>
  );

  if (mode === 'grid') {
    return <Pressable onPress={onOpenViewer} style={StyleSheet.absoluteFill}>{video}</Pressable>;
  }

  return (
    <Pressable onPress={onOpenViewer}>
      {video}
      <View style={styles.controlsRow} pointerEvents="box-none">
        <Pressable
          onPress={() => useVideoPlaybackStore.getState().toggleSound()}
          hitSlop={8}
          style={styles.controlBtn}
        >
          <Icon name={soundEnabled ? 'volume-2' : 'volume-x'} size={16} color="#fff" />
        </Pressable>
        <Pressable
          onPress={() => setManualOverride(!desiredPlaying)}
          hitSlop={8}
          style={styles.controlBtn}
        >
          <Icon name={desiredPlaying ? 'pause' : 'play'} size={16} color="#fff" />
        </Pressable>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  frame: { width: '100%', marginTop: 10, overflow: 'hidden' },
  media: { width: '100%', height: '100%' },
  loadingOverlay: { alignItems: 'center', justifyContent: 'center' },
  controlsRow: {
    position: 'absolute',
    left: 10,
    right: 10,
    bottom: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  controlBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(10,20,36,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
