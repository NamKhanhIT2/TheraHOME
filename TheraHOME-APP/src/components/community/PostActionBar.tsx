import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { homeGlassColors } from '@/theme';
import { useI18n } from '@/lib/i18n';
import type { PostReaction } from '@/hooks/useCommunity';
import { Icon } from '@/components/icons/Icon';
import { ReactionButton, type ReactionGesturePoint } from './ReactionButton';

export interface PostActionBarProps {
  currentReaction: PostReaction | null;
  reactionCounts: Record<PostReaction, number>;
  likesCount: number;
  commentsCount: number;
  savesCount: number;
  saved: boolean;
  onQuickReact: () => void;
  onReactionLongPress: (point: ReactionGesturePoint) => void;
  onReactionLongPressMove: (point: ReactionGesturePoint) => void;
  onReactionLongPressRelease: () => void;
  onCommentPress: () => void;
  onSavePress: () => void;
}

/** Compact counts, rounded to the thousand — "2.2K" in the reference. */
function short(value: number): string {
  if (value < 1000) return String(value);
  const thousands = value / 1000;
  return `${thousands >= 10 ? Math.round(thousands) : Math.round(thousands * 10) / 10}K`;
}

/**
 * One row: react and comment on the left, saving on the right — the owner's
 * reference for Cộng đồng (2026-10-25), replacing the stats-row-plus-
 * button-row this had before.
 *
 * The reference's third item is a share count. There is no sharing here and
 * the owner does not want one, so the row is two actions and the bookmark.
 *
 * Only the heart carries a number (owner, 2026-10-26). The count lives
 * INSIDE the heart's own pressable so it sits 5pt from the icon instead of
 * across a 44pt box's worth of air, and so the number is part of the target
 * rather than dead space beside it.
 */
export function PostActionBar({
  currentReaction,
  likesCount,
  commentsCount,
  saved,
  onQuickReact,
  onReactionLongPress,
  onReactionLongPressMove,
  onReactionLongPressRelease,
  onCommentPress,
  onSavePress,
}: PostActionBarProps) {
  const { t } = useI18n();

  return (
    <View style={styles.row}>
      <View style={styles.left}>
        <ReactionButton
          currentReaction={currentReaction}
          label={short(likesCount)}
          onQuickPress={onQuickReact}
          onLongPress={onReactionLongPress}
          onLongPressMove={onReactionLongPressMove}
          onLongPressRelease={onReactionLongPressRelease}
        />

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${t('commentAction')}, ${commentsCount} ${t('comments')}`}
          onPress={onCommentPress}
          hitSlop={8}
          style={styles.iconHit}
        >
          <Icon name="message-circle" size={21} color={homeGlassColors.textMuted} strokeWidth={1.9} />
        </Pressable>
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityState={{ selected: saved }}
        accessibilityLabel={saved ? t('savedShort') : t('savePostShort')}
        onPress={onSavePress}
        hitSlop={8}
        style={styles.saveHit}
      >
        <Icon
          name="bookmark"
          size={21}
          color={saved ? homeGlassColors.purple : homeGlassColors.textMuted}
          strokeWidth={saved ? 2.4 : 1.9}
        />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  // marginTop was 12 on top of the 44pt targets' own built-in air, which
  // pushed the row a long way from the photo/text it belongs to (owner,
  // 2026-10-26, twice). The targets stay 44pt so they stay easy to hit —
  // the negative margin cancels the ~11pt of padding a 21pt icon centred in
  // a 44pt box carries at its top edge, which is the air that was actually
  // being seen.
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: -4,
  },
  left: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  // Left-aligned for the same reason the bookmark is right-aligned: the
  // 44pt target grows away from the icon, not around it, so the gap between
  // the heart's number and the comment icon stays the ~22pt that says "new
  // pair" without the box inflating it.
  iconHit: {
    width: 40,
    height: 44,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  // Right-aligned inside its own target so the icon stays flush with the
  // card's padding while the tappable area reaches back into the row.
  saveHit: {
    width: 44,
    height: 44,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
});
