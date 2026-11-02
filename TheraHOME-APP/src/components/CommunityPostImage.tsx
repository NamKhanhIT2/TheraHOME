import React, { useState } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { homeGlassColors, useTheme } from '@/theme';
import { isVideoUri } from '@/lib/mediaKind';
import { CommunityVideoPlayer } from '@/components/community/CommunityVideoPlayer';
import { CommunityMediaViewer } from '@/components/community/CommunityMediaViewer';
import { ResilientCommunityImage } from '@/components/community/ResilientCommunityImage';
import { FEED_MEDIA_RATIO } from '@/components/community/feedMedia';

/** Shows the complete post/comment image or video without stretching or
 * horizontal cropping. `uri` may point to either — decided by file
 * extension. Tapping either opens the immersive viewer.
 *
 * Used two ways: as MediaGrid's 1-item delegate (which passes `itemId`/
 * `shouldAutoplay`/`onOpenViewer` so the tap opens MediaGrid's own viewer
 * at the right post) and standalone for a comment's single attached image
 * (Post Detail — comments never carry video, only `image_url`), where the
 * defaults below make it self-contained: no autoplay, and its own local
 * one-image immersive viewer. */
export function CommunityPostImage({
  uri,
  originalUri = uri,
  posterUri,
  mediaWidth,
  mediaHeight,
  itemId = uri,
  shouldAutoplay = false,
  onOpenViewer,
}: {
  uri: string;
  originalUri?: string;
  posterUri?: string | null;
  mediaWidth?: number | null;
  mediaHeight?: number | null;
  itemId?: string;
  shouldAutoplay?: boolean;
  onOpenViewer?: () => void;
}) {
  const theme = useTheme();
  // Fixed, not measured: see feedMedia.ts. The photo's own dimensions no
  // longer decide anything here — tapping opens the full frame.
  const [localViewerOpen, setLocalViewerOpen] = useState(false);
  const isVideo = isVideoUri(originalUri);
  const openViewer = onOpenViewer ?? (() => setLocalViewerOpen(true));

  if (isVideo) {
    return <CommunityVideoPlayer uri={originalUri} posterUri={posterUri} itemId={itemId} shouldAutoplay={shouldAutoplay} mode="single" onOpenViewer={openViewer} />;
  }

  return (
    <>
      <Pressable onPress={openViewer} style={[styles.frame, { // Light-theme #F6F8FC behind every feed photo: on this screen that is a
      // white rectangle flashing in a dark feed each time one loads.
      backgroundColor: homeGlassColors.surfaceRaised, borderRadius: theme.radius.md, aspectRatio: FEED_MEDIA_RATIO }]}>
        <ResilientCommunityImage uri={uri} fallbackUri={originalUri} contentFit="cover" style={styles.image} />
      </Pressable>
      {/* Full screen must show the ORIGINAL, not the downsized feed copy —
          `uri` is the feed-resolution image. */}
      {localViewerOpen ? <CommunityMediaViewer uris={[originalUri]} initialIndex={0} onClose={() => setLocalViewerOpen(false)} /> : null}
    </>
  );
}

const styles = StyleSheet.create({
  frame: { width: '100%', marginTop: 10, overflow: 'hidden' },
  image: { width: '100%', height: '100%' },
});
