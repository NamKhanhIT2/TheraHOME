import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '@/theme';
import { useI18n } from '@/lib/i18n';
import { reactionLabel, type PostReaction } from '@/hooks/useCommunity';
import { Icon } from '@/components/icons/Icon';
import { ReactionButton, type ReactionGesturePoint } from './ReactionButton';
import { ReactionSummary } from './ReactionSummary';

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

/** Facebook-style stats row (reaction icons + count, comments, saves) plus a
 * Thích / Bình luận / Lưu bài row — shared by the feed card and post detail
 * so both stay in sync. */
export function PostActionBar({
  currentReaction,
  reactionCounts,
  likesCount,
  commentsCount,
  savesCount,
  saved,
  onQuickReact,
  onReactionLongPress,
  onReactionLongPressMove,
  onReactionLongPressRelease,
  onCommentPress,
  onSavePress,
}: PostActionBarProps) {
  const theme = useTheme();
  const { t, language } = useI18n();
  const currentReactionLabel = reactionLabel(currentReaction ?? 'like', language);

  return (
    <View>
      <View style={[styles.stats, { borderTopColor: theme.colors.divider, borderBottomColor: theme.colors.divider }]}>
        {likesCount > 0 ? <ReactionSummary counts={reactionCounts} total={likesCount} /> : <Text style={[theme.type.caption, { color: theme.colors.textSecondary }]}>{t('noLikesYet')}</Text>}
        <View style={styles.statsRight}>
          <Text style={[theme.type.caption, { color: theme.colors.textSecondary }]}>{commentsCount} {t('comments')}</Text>
          {savesCount > 0 ? <Text style={[theme.type.caption, { color: theme.colors.textSecondary }]}>{savesCount} {t('saves')}</Text> : null}
        </View>
      </View>
      <View style={styles.actions}>
        <ReactionButton
          currentReaction={currentReaction}
          onQuickPress={onQuickReact}
          onLongPress={onReactionLongPress}
          onLongPressMove={onReactionLongPressMove}
          onLongPressRelease={onReactionLongPressRelease}
          label={currentReactionLabel}
          labelColor={currentReaction ? theme.colors.primary : theme.colors.textSecondary}
        />
        <Pressable onPress={onCommentPress} style={styles.actionBtn}>
          <Icon name="message-circle" size={18} color={theme.colors.textMuted} />
          <Text style={[theme.type.caption, { color: theme.colors.textSecondary, fontFamily: theme.fontFamily.semiBold }]}>{t('commentAction')}</Text>
        </Pressable>
        <Pressable onPress={onSavePress} style={styles.actionBtn}>
          <Icon name="bookmark" size={18} color={saved ? theme.colors.primary : theme.colors.textMuted} />
          <Text style={[theme.type.caption, { color: saved ? theme.colors.primary : theme.colors.textSecondary, fontFamily: theme.fontFamily.semiBold }]}>{saved ? t('savedShort') : t('savePostShort')}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  stats: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, marginTop: 12, borderTopWidth: 1, borderBottomWidth: 1 },
  statsRight: { flexDirection: 'row', gap: 12 },
  actions: { flexDirection: 'row', alignItems: 'center', paddingVertical: 2 },
  actionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 9 },
});
