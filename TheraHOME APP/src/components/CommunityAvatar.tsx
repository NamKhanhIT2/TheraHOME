import React from 'react';
import { Image, Text, View } from 'react-native';
import { avatarColorFor } from '@/lib/avatarColor';

/** Shared post/comment author avatar: real photo when `avatarUrl` is set
 * (community_posts.author_avatar_url / post_comments.author_avatar_url —
 * denormalized at insert time since profiles RLS only allows selecting
 * your own row), colored-initial fallback otherwise. Official TheraHOME
 * posts use the same icon shown for the mobile application. */
const THERAHOME_APP_ICON = require('../../assets/icon.png');

/** Shared avatar for a Community post, comment, or profile. */
export function CommunityAvatar({
  name,
  authorId,
  avatarUrl,
  size = 34,
  isOfficial = false,
}: {
  name: string;
  authorId?: string | null;
  avatarUrl?: string | null;
  size?: number;
  isOfficial?: boolean;
}) {
  if (isOfficial) {
    return (
      <Image
        source={THERAHOME_APP_ICON}
        style={{ width: size, height: size, borderRadius: size * 0.28 }}
        resizeMode="cover"
      />
    );
  }
  if (avatarUrl) {
    return (
      <Image
        source={{ uri: avatarUrl }}
        style={{ width: size, height: size, borderRadius: size / 2 }}
        resizeMode="cover"
      />
    );
  }
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: avatarColorFor(authorId ?? name),
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text style={{ fontWeight: '700', fontSize: size * 0.4 }}>{name.charAt(0)}</Text>
    </View>
  );
}
