import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View, type ImageStyle, type StyleProp } from 'react-native';
import type { ImageProps } from 'expo-image';
import { useTheme } from '@/theme';
import { RemoteImage } from '@/components/ui/RemoteImage';
import { Icon } from '@/components/icons/Icon';

export function ResilientCommunityImage({
  uri,
  fallbackUri,
  style,
  contentFit = 'cover',
  onLoad,
}: {
  uri: string;
  fallbackUri?: string;
  style: StyleProp<ImageStyle>;
  contentFit?: ImageProps['contentFit'];
  onLoad?: ImageProps['onLoad'];
}) {
  const theme = useTheme();
  const [source, setSource] = useState(uri);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    setSource(uri);
    setLoading(true);
    setFailed(false);
    setAttempt(0);
  }, [uri]);

  function retry() {
    setFailed(false);
    setLoading(true);
    setSource(uri);
    setAttempt((value) => value + 1);
  }

  return (
    <View style={[style, styles.host]}>
      <RemoteImage
        key={`${source}:${attempt}`}
        uri={source}
        cacheKey={source.split('?')[0]}
        contentFit={contentFit}
        style={StyleSheet.absoluteFill}
        onLoad={(event) => {
          setLoading(false);
          setFailed(false);
          onLoad?.(event);
        }}
        onError={() => {
          if (fallbackUri && source !== fallbackUri) {
            setSource(fallbackUri);
            setLoading(true);
            return;
          }
          setLoading(false);
          setFailed(true);
        }}
      />
      {loading ? <View pointerEvents="none" style={styles.status}><ActivityIndicator color={theme.colors.primary} /></View> : null}
      {failed ? (
        <Pressable accessibilityRole="button" accessibilityLabel="Tải lại ảnh" onPress={retry} style={styles.status}>
          <Icon name="rotate-ccw" size={20} color={theme.colors.textSecondary} />
          <Text style={[theme.type.captionSm, { color: theme.colors.textSecondary }]}>Chạm để tải lại ảnh</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  host: { overflow: 'hidden' },
  status: { position: 'absolute', inset: 0, alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: 'rgba(127,127,127,0.06)' },
});
