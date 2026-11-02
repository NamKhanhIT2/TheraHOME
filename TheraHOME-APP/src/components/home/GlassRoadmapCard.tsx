import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { homeGlassColors, useTheme } from '@/theme';
import { useI18n } from '@/lib/i18n';
import { GlassCard } from './GlassCard';
import { heroFont } from './glass';

/** Only the four states the roadmap itself distinguishes. */
export type RoadmapDotStatus = 'done' | 'current' | 'missed' | 'locked';

const DOTS_PER_ROW = 14;
const DOT_GAP = 7;

function dotColor(status: RoadmapDotStatus): string {
  switch (status) {
    case 'done':
      return homeGlassColors.dotDone;
    case 'current':
      return homeGlassColors.dotCurrent;
    case 'missed':
      return homeGlassColors.dotMissed;
    default:
      return homeGlassColors.dotIdle;
  }
}

export interface GlassRoadmapCardProps {
  statuses: RoadmapDotStatus[];
  onSeeAll: () => void;
}

/**
 * The programme at a glance — one dot per day, 14 to a row.
 *
 * The prototype hardcodes 28 dots, the first 14 green and the rest red, as
 * dummy content. Here they carry the day's real status, which is why `locked`
 * exists at all: a customer whose phase 3 is still an unpurchased lock would
 * otherwise see half their programme painted as missed.
 */
export function GlassRoadmapCard({ statuses, onSeeAll }: GlassRoadmapCardProps) {
  const theme = useTheme();
  const { t } = useI18n();
  const rows: RoadmapDotStatus[][] = [];
  for (let i = 0; i < statuses.length; i += DOTS_PER_ROW) rows.push(statuses.slice(i, i + DOTS_PER_ROW));

  return (
    <GlassCard>
      <View style={styles.header}>
        <Text style={[styles.title, { color: homeGlassColors.text, ...heroFont('600') }]}>
          {t('recoveryRoadmap')}
        </Text>
        <Pressable accessibilityRole="button" onPress={onSeeAll} hitSlop={8}>
          <Text style={[theme.type.caption, heroFont('400'), { color: homeGlassColors.link, ...heroFont('600') }]}>
            {t('seeAll')}
          </Text>
        </Pressable>
      </View>
      <View style={styles.grid}>
        {rows.map((row, rowIndex) => (
          <View key={rowIndex} style={styles.row}>
            {row.map((status, index) => (
              <View key={index} style={[styles.dot, { backgroundColor: dotColor(status) }]} />
            ))}
            {/* A short last row would otherwise stretch its dots wide — the
                fillers hold the remaining columns open so every dot on the
                card is the same size. */}
            {Array.from({ length: DOTS_PER_ROW - row.length }).map((_, index) => (
              <View key={`filler${index}`} style={styles.filler} />
            ))}
          </View>
        ))}
      </View>
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    fontSize: 17,
    lineHeight: 22,
    letterSpacing: -0.3,
  },
  grid: {
    marginTop: 14,
    gap: DOT_GAP,
  },
  row: {
    flexDirection: 'row',
    gap: DOT_GAP,
  },
  dot: {
    flex: 1,
    aspectRatio: 1,
    borderRadius: 999,
  },
  filler: {
    flex: 1,
    aspectRatio: 1,
  },
});
