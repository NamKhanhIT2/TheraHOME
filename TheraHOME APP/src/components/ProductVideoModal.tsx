import React, { useState } from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import YoutubePlayer from 'react-native-youtube-iframe';
import { useTheme } from '@/theme';
import { Icon } from '@/components/icons/Icon';

interface ProductVideoModalProps {
  title: string;
  url: string | null;
  onClose: () => void;
}

function youtubeVideoId(url: string): string {
  return url.match(/youtu\.be\/([^?&/]+)/)?.[1]
    ?? url.match(/[?&]v=([^?&/]+)/)?.[1]
    ?? url.match(/youtube\.com\/embed\/([^?&/]+)/)?.[1]
    ?? '';
}

function normalizedUrl(url: string | null): string {
  const value = url?.trim() ?? '';
  if (!value) return '';
  return /^https?:\/\//i.test(value) ? value : `https://${value}`;
}

export function ProductVideoModal({ title, url, onClose }: ProductVideoModalProps) {
  const theme = useTheme();
  const [width, setWidth] = useState(0);
  const [failed, setFailed] = useState(false);
  const previewUrl = normalizedUrl(url);
  const videoId = youtubeVideoId(previewUrl);

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable
          onPress={(event) => event.stopPropagation()}
          style={[styles.card, theme.shadows.card, { backgroundColor: theme.colors.bgCard, borderRadius: theme.radius.lg }]}
        >
          <View style={styles.header}>
            <Text numberOfLines={2} style={[theme.type.h2, { color: theme.colors.textPrimary, flex: 1 }]}>{title}</Text>
            <Pressable onPress={onClose} hitSlop={10}>
              <Icon name="x" size={20} color={theme.colors.textSecondary} />
            </Pressable>
          </View>
          <View
            onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
            style={[styles.video, { backgroundColor: theme.colors.bgCardAlt }]}
          >
            {videoId && width > 0 && !failed ? (
              <YoutubePlayer
                height={width * 9 / 16}
                width={width}
                videoId={videoId}
                onError={() => setFailed(true)}
                initialPlayerParams={{ playsinline: true, controls: true, rel: false }}
                webViewProps={{ allowsFullscreenVideo: true, allowsInlineMediaPlayback: true }}
              />
            ) : videoId && !failed ? (
              <ActivityIndicator color={theme.colors.primary} />
            ) : previewUrl ? (
              <View style={styles.empty}>
                <Icon name="external-link" size={28} color={theme.colors.primary} />
                <Text style={[theme.type.caption, { color: theme.colors.textSecondary, textAlign: 'center' }]}>Link xem thử này sẽ được mở trong trình duyệt an toàn.</Text>
                <Pressable onPress={() => void WebBrowser.openBrowserAsync(previewUrl)} style={[styles.openLink, { backgroundColor: theme.colors.primary }]}> 
                  <Text style={[theme.type.bodyStrong, { color: '#fff' }]}>Mở link xem thử</Text>
                </Pressable>
              </View>
            ) : (
              <View style={styles.empty}>
                <Icon name="film" size={28} color={theme.colors.textMuted} />
                <Text style={[theme.type.caption, { color: theme.colors.textSecondary, textAlign: 'center' }]}>Video xem thử chưa được cập nhật.</Text>
              </View>
            )}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(20,24,34,0.55)', alignItems: 'center', justifyContent: 'center', padding: 20 },
  card: { width: '100%', maxWidth: 520, padding: 16, overflow: 'hidden' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 },
  video: { width: '100%', aspectRatio: 16 / 9, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', borderRadius: 12 },
  empty: { alignItems: 'center', justifyContent: 'center', gap: 10, padding: 20 },
  openLink: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10 },
});
