import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '@/theme';
import { useI18n } from '@/lib/i18n';
import { POST_REACTIONS, type PostReaction } from '@/hooks/useCommunity';

export function ReactionSummary({ counts, total }: { counts: Record<PostReaction, number>; total: number }) {
  const theme = useTheme();
  const { t } = useI18n();
  if (!total) return null;
  const icons = POST_REACTIONS.filter((item) => counts[item.key] > 0).sort((a, b) => counts[b.key] - counts[a.key]).slice(0, 2);
  return <View accessibilityLabel={t('reactionsCountLabel', { count: total })} style={styles.row}>{icons.map((item) => <Text key={item.key} style={styles.emoji}>{item.emoji}</Text>)}<Text style={[theme.type.captionSm, { color: theme.colors.textMuted }]}>{total}</Text></View>;
}

const styles = StyleSheet.create({ row: { flexDirection: 'row', alignItems: 'center', gap: 1 }, emoji: { fontSize: 14 } });
