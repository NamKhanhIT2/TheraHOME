import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { homeGlassColors, useTheme } from '@/theme';
import { Icon } from '@/components/icons/Icon';
import { RemoteImage } from '@/components/ui/RemoteImage';

export interface AvatarImgProps {
  size?: number;
  editable?: boolean;
  /** Real photo URL (Phase 6, e.g. `profiles.avatar_url`) — falls back to a
   * placeholder icon when absent. */
  uri?: string | null;
  onPress?: () => void;
  /** 'glass' for the dark screens. The staff console and the call screen are
   * still light, so this cannot simply be switched over. */
  tone?: 'app' | 'glass';
}

/** Mirrors `AvatarImg` — shows a real photo when `uri` is set (Phase 6),
 * otherwise a placeholder icon. */
export function AvatarImg({ size = 44, editable = false, uri, onPress, tone = 'app' }: AvatarImgProps) {
  const theme = useTheme();
  // The disc behind the photo. It was always `bgCardAlt`, and the app's theme
  // is still the LIGHT one even on the redrawn screens (they paint themselves
  // from `homeGlassColors`), so that resolves to #F6F8FC — a white circle in
  // the top-left of Home and in Cộng đồng's composer for anyone who has not
  // set a photo, which is most new accounts (QA on device, 2026-11-02). Not a
  // flash while loading: it sits there.
  const glass = tone === 'glass';
  const disc = glass ? homeGlassColors.surfaceRaised : theme.colors.bgCardAlt;
  const placeholderInk = glass ? homeGlassColors.textMuted : theme.colors.textMuted;
  const badgeRim = glass ? homeGlassColors.sky[4] : theme.colors.bgCard;
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
            backgroundColor: disc,
            overflow: 'hidden',
          },
        ]}
      >
        {uri ? (
          <RemoteImage uri={uri} priority="high" style={{ width: size, height: size }} contentFit="cover" />
        ) : (
          <Icon name="user" size={size * 0.5} color={placeholderInk} />
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
              borderColor: badgeRim,
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
