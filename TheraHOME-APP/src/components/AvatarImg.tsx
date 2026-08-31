import React from 'react';
import { Image, Pressable, StyleSheet, View } from 'react-native';
import { useTheme } from '@/theme';
import { Icon } from '@/components/icons/Icon';

export interface AvatarImgProps {
  size?: number;
  editable?: boolean;
  /** Real photo URL (Phase 6, e.g. `profiles.avatar_url`) — falls back to a
   * placeholder icon when absent. */
  uri?: string | null;
  onPress?: () => void;
}

/** Mirrors `AvatarImg` — shows a real photo when `uri` is set (Phase 6),
 * otherwise a placeholder icon. */
export function AvatarImg({ size = 44, editable = false, uri, onPress }: AvatarImgProps) {
  const theme = useTheme();
  const Wrapper = onPress ? Pressable : View;
  return (
    <Wrapper style={{ width: size, height: size }} onPress={onPress}>
      <View
        style={[
          styles.circle,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: theme.colors.bgCardAlt,
            overflow: 'hidden',
          },
        ]}
      >
        {uri ? (
          <Image source={{ uri }} style={{ width: size, height: size }} resizeMode="cover" />
        ) : (
          <Icon name="user" size={size * 0.5} color={theme.colors.textMuted} />
        )}
      </View>
      {editable ? (
        <View
          style={[
            styles.badge,
            {
              width: size * 0.32,
              height: size * 0.32,
              borderRadius: (size * 0.32) / 2,
              backgroundColor: theme.colors.primary,
              borderColor: theme.colors.bgCard,
            },
          ]}
        >
          <Icon name="pencil" size={size * 0.15} color="#fff" />
        </View>
      ) : null}
    </Wrapper>
  );
}

const styles = StyleSheet.create({
  circle: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
  },
});
