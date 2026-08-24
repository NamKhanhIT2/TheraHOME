import React from 'react';
import { Image, Modal, Pressable, StyleSheet, View } from 'react-native';
import { VideoView, useVideoPlayer } from 'expo-video';
import { Icon } from '@/components/icons/Icon';

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
      <View style={styles.backdrop}>
        {kind === 'video' ? <VideoViewer uri={uri} /> : <Image source={{ uri }} resizeMode="contain" style={styles.media} />}
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
});
