import React from 'react';
import { Image, type ImageProps } from 'expo-image';

type RemoteImageProps = Omit<ImageProps, 'source'> & {
  uri: string;
  /** Stable disk-cache key for URLs whose query string changes between
   * fetches (e.g. Supabase signed URLs regenerate their token every load —
   * without this the cache misses every time). Pass the path part only. */
  cacheKey?: string;
};

/** Remote image with persistent memory/disk caching and a short fade-in. */
export function RemoteImage({ uri, cacheKey, transition = 140, ...props }: RemoteImageProps) {
  return <Image {...props} source={{ uri, cacheKey }} cachePolicy="memory-disk" recyclingKey={cacheKey ?? uri} transition={transition} />;
}
