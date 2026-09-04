// Full-screen immersive viewer for a post's media — styled after
// ChatMediaViewer.tsx's dark-backdrop Modal pattern, extended to page
// horizontally across a whole post's media list (not just one item) and to
// autoplay/unmute video with real controls. Opened from a tap anywhere in
// MediaGrid, which owns this component and its open/closed state. See
// CLAUDE.md's "Community video playback overhaul" section.
import React, { useRef, useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, Text, View, type NativeSyntheticEvent, type NativeScrollEvent } from 'react-native';
import { VideoView, useVideoPlayer } from 'expo-video';
import { useWindowDimensions } from 'react-native';
import { Icon } from '@/components/icons/Icon';
import { isVideoUri } from '@/lib/mediaKind';
import { useVideoPlaybackStore } from '@/store/useVideoPlaybackStore';
import { RemoteImage } from '@/components/ui/RemoteImage';

const IMMERSIVE_VIDEO_ID = 'immersive-video';

function ImmersiveVideoPage({ uri, isCurrent }: { uri: string; isCurrent: boolean }) {
  const player = useVideoPlayer(uri, (instance) => {
    instance.loop = false;
  });
  const isActive = useVideoPlaybackStore((s) => s.activeId === IMMERSIVE_VIDEO_ID);

  React.useEffect(() => {
    const { claim, release } = useVideoPlaybackStore.getState();
    if (isCurrent) claim(IMMERSIVE_VIDEO_ID); else release(IMMERSIVE_VIDEO_ID);
  }, [isCurrent]);
  React.useEffect(() => {
    return () => useVideoPlaybackStore.getState().release(IMMERSIVE_VIDEO_ID);
  }, []);
  React.useEffect(() => {
    if (isActive) void player.play(); else player.pause();
  }, [isActive, player]);
  React.useEffect(() => {
    player.muted = false;
  }, [player]);

  return <VideoView player={player} nativeControls contentFit="contain" style={styles.media} />;
}

export interface CommunityMediaViewerProps {
  uris: string[];
  initialIndex: number;
  onClose: () => void;
}

export function CommunityMediaViewer({ uris, initialIndex, onClose }: CommunityMediaViewerProps) {
  const { width } = useWindowDimensions();
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const listRef = useRef<FlatList<string>>(null);

  function handleMomentumEnd(event: NativeSyntheticEvent<NativeScrollEvent>) {
    setCurrentIndex(Math.round(event.nativeEvent.contentOffset.x / width));
  }

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
    <View style={styles.backdrop}>
      <FlatList
        ref={listRef}
        data={uris}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        keyExtractor={(uri, index) => `${index}:${uri}`}
        initialScrollIndex={initialIndex}
        getItemLayout={(_data, index) => ({ length: width, offset: width * index, index })}
        onMomentumScrollEnd={handleMomentumEnd}
        renderItem={({ item, index }) =>
          isVideoUri(item) ? (
            <View style={{ width }}>
              <ImmersiveVideoPage uri={item} isCurrent={index === currentIndex} />
            </View>
          ) : (
            <View style={{ width }}>
              <RemoteImage uri={item} contentFit="contain" priority="high" style={styles.media} />
            </View>
          )
        }
      />
      {uris.length > 1 ? (
        <View style={styles.pageIndicator} pointerEvents="none">
          <Text style={styles.pageIndicatorText}>{currentIndex + 1}/{uris.length}</Text>
        </View>
      ) : null}
      <Pressable onPress={onClose} style={styles.close} hitSlop={10}>
        <Icon name="x" size={24} color="#fff" />
      </Pressable>
    </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: '#000', alignItems: 'center', justifyContent: 'center' },
  media: { width: '100%', height: '82%' },
  close: { position: 'absolute', top: 58, right: 22, width: 42, height: 42, borderRadius: 21, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center' },
  pageIndicator: { position: 'absolute', top: 66, alignSelf: 'center', paddingHorizontal: 12, paddingVertical: 5, borderRadius: 999, backgroundColor: 'rgba(0,0,0,0.55)' },
  pageIndicatorText: { color: '#fff', fontSize: 13, fontWeight: '600' },
});
