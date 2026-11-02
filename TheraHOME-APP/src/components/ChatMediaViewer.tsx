import React from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { VideoView, useVideoPlayer } from 'expo-video';
import { Icon } from '@/components/icons/Icon';
import { RemoteImage } from '@/components/ui/RemoteImage';
import { StatusBar } from 'expo-status-bar';

export interface ChatMediaViewerProps {
  uri: string;
  kind: 'image' | 'video';
  onClose: () => void;
}

function VideoViewer({ uri }: { uri: string }) {
  const player = useVideoPlayer(uri, (instance) => {
    instance.loop = false;
    void instance.play();
  });
  return <VideoView player={player} nativeControls contentFit="contain" style={styles.media} />;
}

/** Full-screen viewer for chat images and videos. */
export function ChatMediaViewer({ uri, kind, onClose }: ChatMediaViewerProps) {
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      {/* The lightbox is always black, so the clock and battery must always be
          light. Without this the global StatusBar stayed `dark` in light mode
          and they were dark-on-black — unreadable. */}
      <StatusBar style="light" />
      <View style={styles.backdrop}>
        {kind === 'video' ? <VideoViewer uri={uri} /> : <RemoteImage uri={uri} cacheKey={uri.split('?')[0]} contentFit="contain" priority="high" style={styles.media} />}
        <Pressable accessibilityRole="button" onPress={onClose} style={({ pressed }) => [styles.close, pressed ? { opacity: 0.6 } : null]} hitSlop={14}>
          <Icon name="x" size={26} color="#fff" strokeWidth={2.2} />
        </Pressable>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: '#000', alignItems: 'center', justifyContent: 'center' },
  media: { width: '100%', height: '82%' },
  close: { position: 'absolute', top: 58, right: 22, width: 46, height: 46, borderRadius: 23, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center' },
});
