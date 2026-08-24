import React, { useEffect, useState } from 'react';
import { Image, Pressable, StyleSheet } from 'react-native';
import { useTheme } from '@/theme';
import { isVideoUri } from '@/lib/mediaKind';
import { CommunityVideoPlayer } from '@/components/community/CommunityVideoPlayer';
import { CommunityMediaViewer } from '@/components/community/CommunityMediaViewer';

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
  itemId = uri,
  shouldAutoplay = false,
  onOpenViewer,
}: {
  uri: string;
  itemId?: string;
  shouldAutoplay?: boolean;
  onOpenViewer?: () => void;
}) {
  const theme = useTheme();
  const [aspectRatio, setAspectRatio] = useState(4 / 3);
  const [localViewerOpen, setLocalViewerOpen] = useState(false);
  const isVideo = isVideoUri(uri);
  const openViewer = onOpenViewer ?? (() => setLocalViewerOpen(true));

  useEffect(() => {
    if (isVideo) return;
    let active = true;
    Image.getSize(uri, (width, height) => {
      if (active && width > 0 && height > 0) setAspectRatio(Math.max(0.62, Math.min(1.9, width / height)));
    });
    return () => { active = false; };
  }, [uri, isVideo]);

  if (isVideo) {
    return <CommunityVideoPlayer uri={uri} itemId={itemId} shouldAutoplay={shouldAutoplay} mode="single" onOpenViewer={openViewer} />;
  }

  return (
    <>
      <Pressable onPress={openViewer} style={[styles.frame, { backgroundColor: theme.colors.bgCardAlt, borderRadius: theme.radius.md, aspectRatio }]}>
        <Image source={{ uri }} resizeMode="contain" style={styles.image} />
      </Pressable>
      {localViewerOpen ? <CommunityMediaViewer uris={[uri]} initialIndex={0} onClose={() => setLocalViewerOpen(false)} /> : null}
    </>
  );
}

const styles = StyleSheet.create({
  frame: { width: '100%', marginTop: 10, overflow: 'hidden' },
  image: { width: '100%', height: '100%' },
});
