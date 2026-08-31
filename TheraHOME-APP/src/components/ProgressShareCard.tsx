import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '@/theme';
import { useI18n } from '@/lib/i18n';
import { Icon } from '@/components/icons/Icon';
import type { PostType, ProgressSnapshot } from '@/hooks/useCommunity';

/** Renders a frozen progress/exercise snapshot shared to Community — same
 * component in the feed and post detail. `progress_snapshot` is computed
 * once at share time (see useCreatePost), never live, so this only ever
 * displays what's already in the row. */
export function ProgressShareCard({ postType, snapshot }: { postType: PostType; snapshot: ProgressSnapshot }) {
  const theme = useTheme();
  const { t } = useI18n();
  const showPain = snapshot.painBefore != null && snapshot.painAfter != null;

  return (
    <View style={[styles.card, { backgroundColor: theme.colors.primaryTint05, borderColor: theme.colors.primary, borderRadius: theme.radius.md }]}>
      <Text style={[theme.type.bodyStrong, { color: theme.colors.primaryDark }]}>
        {postType === 'exercise' ? snapshot.productName : t('daysWithTheraHOME', { count: snapshot.dayNumber })}
      </Text>
      {postType === 'exercise' ? (
        <Text style={[theme.type.caption, { color: theme.colors.textSecondary, marginTop: 2 }]}>
          {t('dayProgress', { current: snapshot.dayNumber, total: snapshot.totalDays })}
        </Text>
      ) : null}
      <View style={styles.rows}>
        {showPain ? (
          <View style={styles.row}>
            <Icon name="activity" size={14} color={theme.colors.primary} />
            <Text style={[theme.type.caption, { color: theme.colors.textPrimary }]}>
              {t('discomfortLevelChange', { before: snapshot.painBefore ?? '', after: snapshot.painAfter ?? '' })}
            </Text>
          </View>
        ) : null}
        <View style={styles.row}>
          <Icon name="check" size={14} color={theme.colors.primary} />
          <Text style={[theme.type.caption, { color: theme.colors.textPrimary }]}>
            {t('completedDaysOf', { completed: snapshot.daysCompleted, total: snapshot.dayNumber })}
          </Text>
        </View>
        {snapshot.streak > 0 ? (
          <View style={styles.row}>
            <Text style={{ fontSize: 14 }}>🔥</Text>
            <Text style={[theme.type.caption, { color: theme.colors.textPrimary }]}>
              {t('currentStreakDays', { count: snapshot.streak })}
            </Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1.5,
    padding: 14,
    marginTop: 10,
  },
  rows: {
    marginTop: 10,
    gap: 6,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
});
