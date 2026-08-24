import React, { useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '@/theme';
import { isVideoUri } from '@/lib/mediaKind';
import { CommunityPostImage } from '@/components/CommunityPostImage';
import { CommunityVideoPlayer } from '@/components/community/CommunityVideoPlayer';
import { CommunityMediaViewer } from '@/components/community/CommunityMediaViewer';

function GridCell({ uri, itemId, shouldAutoplay, overlayCount, onOpenViewer }: { uri: string; itemId: string; shouldAutoplay: boolean; overlayCount?: number; onOpenViewer: () => void }) {
  const theme = useTheme();
  const isVideo = isVideoUri(uri);
  return (
    <View style={[styles.cell, { backgroundColor: theme.colors.bgCardAlt }]}>
      {isVideo ? (
        <CommunityVideoPlayer uri={uri} itemId={itemId} shouldAutoplay={shouldAutoplay} mode="grid" onOpenViewer={onOpenViewer} />
      ) : (
        <Pressable onPress={onOpenViewer} style={StyleSheet.absoluteFill}>
          <Image source={{ uri }} resizeMode="cover" style={StyleSheet.absoluteFill} />
        </Pressable>
      )}
      {overlayCount ? (
        <View style={[StyleSheet.absoluteFill, styles.countOverlay]} pointerEvents="none">
          <Text style={[styles.countText, { fontFamily: theme.fontFamily.bold }]}>+{overlayCount}</Text>
        </View>
      ) : null}
    </View>
  );
}

export interface MediaGridProps {
  uris: string[];
  /** Unique per post — item ids for the video-playback coordinator are
   * `${postId}:${index}`. */
  postId: string;
  /** Whether this post's media is eligible to autoplay right now — the
   * caller decides what that means (FlatList viewability in the feed,
   * screen focus in Post Detail, always false in the profile list). */
  shouldAutoplay: boolean;
}

/**
 * Community post media, 1..N images/videos, laid out Facebook/Instagram-style:
 * 1 → full width (delegates to CommunityPostImage for its aspect-ratio
 * handling), 2 → two columns, 3 → one large + two stacked small, 4 → 2×2,
 * 5+ → 2×2 with a "+N" scrim over the last cell. Shared by the Community
 * feed, Post Detail, and the profile post grid — none of them lay out
 * media on their own. Also owns the immersive full-screen viewer — tapping
 * any cell opens it at that item.
 */
export function MediaGrid({ uris, postId, shouldAutoplay }: MediaGridProps) {
  const theme = useTheme();
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);
  if (!uris.length) return null;

  const viewer = viewerIndex != null ? (
    <CommunityMediaViewer uris={uris} initialIndex={viewerIndex} onClose={() => setViewerIndex(null)} />
  ) : null;

  if (uris.length === 1) {
    return (
      <>
        <CommunityPostImage uri={uris[0]} itemId={`${postId}:0`} shouldAutoplay={shouldAutoplay} onOpenViewer={() => setViewerIndex(0)} />
        {viewer}
      </>
    );
  }

  const frame = [styles.frame, { backgroundColor: theme.colors.bgCardAlt, borderRadius: theme.radius.md }];
  const cell = (index: number, overlayCount?: number) => (
    <GridCell
      uri={uris[index]}
      itemId={`${postId}:${index}`}
      shouldAutoplay={shouldAutoplay}
      overlayCount={overlayCount}
      onOpenViewer={() => setViewerIndex(index)}
    />
  );

  if (uris.length === 2) {
    return (
      <>
        <View style={frame}>
          <View style={styles.row}>
            {cell(0)}
            {cell(1)}
          </View>
        </View>
        {viewer}
      </>
    );
  }

  if (uris.length === 3) {
    return (
      <>
        <View style={frame}>
          <View style={styles.row}>
            {cell(0)}
            <View style={styles.column}>
              {cell(1)}
              {cell(2)}
            </View>
          </View>
        </View>
        {viewer}
      </>
    );
  }

  const overlayCount = uris.length > 4 ? uris.length - 4 : undefined;
  return (
    <>
      <View style={frame}>
        <View style={styles.column}>
          <View style={styles.row}>
            {cell(0)}
            {cell(1)}
          </View>
          <View style={styles.row}>
            {cell(2)}
            {cell(3, overlayCount)}
          </View>
        </View>
      </View>
      {viewer}
    </>
  );
}

const styles = StyleSheet.create({
  frame: { width: '100%', marginTop: 10, aspectRatio: 1, overflow: 'hidden' },
  row: { flex: 1, flexDirection: 'row', gap: 2 },
  column: { flex: 1, flexDirection: 'column', gap: 2 },
  cell: { flex: 1, overflow: 'hidden' },
  countOverlay: { backgroundColor: 'rgba(10,20,36,0.55)', alignItems: 'center', justifyContent: 'center' },
  countText: { color: '#fff', fontSize: 24 },
});
