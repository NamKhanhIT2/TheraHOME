import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Pressable, StyleSheet, View } from 'react-native';
import * as VideoThumbnails from 'expo-video-thumbnails';
import { RemoteImage } from '@/components/ui/RemoteImage';
import { Icon } from '@/components/icons/Icon';

/**
 * The picture or video inside a chat bubble.
 *
 * Two things this replaces. Images were drawn into a fixed 228x171 box, so a
 * portrait photo — most of what people send from a phone — was cropped to a
 * landscape letterbox and the person could not see what they had sent
 * without opening it. And a video was a flat dark rectangle with a film
 * glyph: identical for every clip, so a thread with several was unreadable.
 *
 * The aspect ratio comes from the image itself on load, clamped so that a
 * panorama still has enough height to see and a very tall screenshot cannot
 * push the rest of the conversation off screen. Until it loads the box holds
 * a neutral 4:3, which is also what a failed load keeps.
 */
const MEDIA_WIDTH = 232;
const MIN_RATIO = 0.62; // tallest allowed (a portrait screenshot)
const MAX_RATIO = 1.9; // widest allowed (a panorama)
const DEFAULT_RATIO = 4 / 3;

/** Generated thumbnails are kept for the life of the process: scrolling a
 * thread back and forth must not re-decode the same video every time. */
const thumbnailCache = new Map<string, string | null>();

function clampRatio(width: number, height: number): number {
  if (!width || !height) return DEFAULT_RATIO;
  return Math.min(MAX_RATIO, Math.max(MIN_RATIO, width / height));
}

export function ChatMedia({
  uri,
  kind,
  cacheKey,
  pending,
  onPress,
}: {
  uri: string;
  kind: 'image' | 'video';
  /** Stable key for signed URLs whose token changes on every fetch. */
  cacheKey?: string;
  /** Still uploading — the local copy is on screen with a progress veil. */
  pending?: boolean;
  onPress?: () => void;
}) {
  const [ratio, setRatio] = useState(DEFAULT_RATIO);
  const [thumbnail, setThumbnail] = useState<string | null>(() => thumbnailCache.get(uri) ?? null);

  useEffect(() => {
    if (kind !== 'video') return;
    if (thumbnailCache.has(uri)) {
      setThumbnail(thumbnailCache.get(uri) ?? null);
      return;
    }
    let cancelled = false;
    VideoThumbnails.getThumbnailAsync(uri, { time: 800 })
      .then((result) => {
        thumbnailCache.set(uri, result.uri);
        if (!cancelled) {
          setThumbnail(result.uri);
          setRatio(clampRatio(result.width, result.height));
        }
      })
      .catch(() => {
        // A clip whose first frame cannot be decoded (an unsupported codec, or
        // a remote file that will not range-request) still has to render as a
        // video, so remember the failure and fall back to the plain tile.
        thumbnailCache.set(uri, null);
        if (!cancelled) setThumbnail(null);
      });
    return () => { cancelled = true; };
  }, [uri, kind]);

  const height = Math.round(MEDIA_WIDTH / ratio);
  const frame = { width: MEDIA_WIDTH, height };

  return (
    <Pressable disabled={pending || !onPress} onPress={onPress} style={[styles.frame, frame]}>
      {kind === 'video' ? (
        thumbnail ? (
          <Image source={{ uri: thumbnail }} style={[styles.media, frame]} resizeMode="cover" />
        ) : (
          <View style={[styles.media, styles.videoFallback, frame]}>
            <Icon name="film" size={34} color="#ffffffcc" />
          </View>
        )
      ) : (
        <RemoteImage
          uri={uri}
          cacheKey={cacheKey}
          transition={pending ? 0 : 140}
          contentFit="cover"
          style={[styles.media, frame]}
          onLoad={(event) => setRatio(clampRatio(event.source.width, event.source.height))}
        />
      )}

      {kind === 'video' && !pending ? (
        <View style={styles.playBadge}>
          <Icon name="play" size={22} color="#fff" />
        </View>
      ) : null}

      {pending ? (
        <View style={[styles.veil, frame]}>
          <ActivityIndicator color="#fff" />
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  frame: {
    borderRadius: 13,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  media: {
    borderRadius: 13,
    backgroundColor: 'rgba(127,127,127,0.18)',
  },
  videoFallback: {
    backgroundColor: '#202838',
    alignItems: 'center',
    justifyContent: 'center',
  },
  playBadge: {
    position: 'absolute',
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingLeft: 3,
  },
  veil: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.22)',
    borderRadius: 13,
  },
});
