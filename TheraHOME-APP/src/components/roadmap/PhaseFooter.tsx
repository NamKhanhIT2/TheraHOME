import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { homeGlassColors, useTheme } from '@/theme';
import { heroFont } from '@/components/home/glass';
import { Icon } from '@/components/icons/Icon';
import { RoadmapKnob } from '@/components/roadmap/RoadmapKnob';
import { usePhaseQuiz, useQuizAttempt } from '@/hooks/useQuiz';
import { useI18n } from '@/lib/i18n';

export interface PhaseFooterProps {
  userId: string | undefined;
  productId: string;
  /** The phase that was just completed — the quiz (if any) tests knowledge
   * of this phase. */
  phaseId: string;
  phaseName: string;
  /** Whether the phase's own days have all run their course (done/missed).
   * When false the quiz row still renders — visibly DISABLED with a
   * "complete Day N to unlock" hint (per explicit request: the quiz after
   * day 7/14 should be discoverable before it's reachable) — and the promo
   * cards stay hidden. */
  enabled: boolean;
  /** The phase's last day number — used in the disabled row's hint. */
  lockedDayNumber: number;
  /** Whether the phase this footer belongs to is currently collapsed — hides
   * the quiz row (whether it's the "take it" prompt or the "completed"
   * state) since that's this phase's own content; the promo cards below
   * always render regardless, since they're the next step, not tied to any
   * one phase's collapse state. */
  collapsed: boolean;
}

/** The phase-end SURVEY row only (the two promo cards moved to the bottom
 * of the roadmap list — see roadmap.tsx's bottom-promo block, per explicit
 * request 2026-09-02): disabled with a "complete Day N" hint while days
 * remain, the take-survey prompt once they're done, and a persistent "Đã
 * hoàn thành" row after submitting. Hidden entirely while the phase is
 * collapsed. */
export function PhaseFooter({ userId, productId, phaseId, phaseName, enabled, lockedDayNumber, collapsed }: PhaseFooterProps) {
  const theme = useTheme();
  const { t } = useI18n();
  const questionsQuery = usePhaseQuiz(phaseId);
  const attemptQuery = useQuizAttempt(userId, phaseId);

  if (questionsQuery.isPending || attemptQuery.isPending) return null;

  const hasQuiz = (questionsQuery.data?.length ?? 0) > 0;
  const quizDone = !hasQuiz || !!attemptQuery.data;

  // Phase not finished yet: the survey row shows in a disabled state so
  // the user can see it coming.
  if (!enabled) {
    if (!hasQuiz || collapsed) return null;
    return (
      <View style={styles.quizRow}>
        <RoadmapKnob size={44}>
          <Icon name="lock" size={17} color={homeGlassColors.textFaint} />
        </RoadmapKnob>
        <View style={{ flex: 1, gap: 1 }}>
          <Text style={[styles.quizTitle, heroFont('600'), { color: homeGlassColors.textMuted }]}>{t('quizTitle')}</Text>
          <Text style={[theme.type.caption, heroFont('400'), { color: homeGlassColors.textFaint }]}>
            {t('quizLockedHint', { day: lockedDayNumber })}
          </Text>
        </View>
        <RoadmapKnob size={38}>
          <Icon name="lock" size={16} color={homeGlassColors.roadmapKnobIcon} strokeWidth={2.2} />
        </RoadmapKnob>
      </View>
    );
  }

  if (!hasQuiz) return null;

  // Survey not submitted yet: available. No "take survey" label — just a
  // brightened, bordered card that invites the tap (per explicit request).
  if (!quizDone) {
    if (collapsed) return null;
    return (
      <Pressable
        onPress={() => router.push({ pathname: '/quiz/[phaseId]', params: { phaseId, productId, phaseName } })}
        style={({ pressed }) => [
          styles.quizRow,
          { backgroundColor: homeGlassColors.surfaceRaised, borderColor: 'rgba(95,184,245,0.38)', borderWidth: 1, borderRadius: 18 },
          pressed ? { opacity: 0.65 } : null,
        ]}
      >
        <RoadmapKnob size={44}>
          <Icon name="clipboard-check" size={18} color={homeGlassColors.accent} />
        </RoadmapKnob>
        <View style={{ flex: 1 }}>
          <Text style={[styles.quizTitle, heroFont('600'), { color: homeGlassColors.text }]}>{t('quizTitle')}</Text>
        </View>
        <RoadmapKnob size={38}>
          <Icon name="chevron-right" size={16} color={homeGlassColors.accent} strokeWidth={2.2} />
        </RoadmapKnob>
      </Pressable>
    );
  }

  if (collapsed) return null;

  // Already answered: the survey is done once, so tapping this row re-opens
  // the "Gợi ý từ TheraHOME" screen (the quiz screen shows the suggestion,
  // not the questions, once an attempt exists). Plain resting card — no
  // "Đã hoàn thành" label, no phase name (per explicit request).
  return (
    <Pressable
      onPress={() => router.push({ pathname: '/quiz/[phaseId]', params: { phaseId, productId, phaseName } })}
      style={({ pressed }) => [styles.quizRow, pressed ? { opacity: 0.65 } : null]}
    >
      <RoadmapKnob size={44}>
        <Icon name="check" size={19} color={homeGlassColors.tick} strokeWidth={2.6} />
      </RoadmapKnob>
      <View style={{ flex: 1 }}>
        <Text style={[styles.quizTitle, heroFont('600'), { color: homeGlassColors.text }]}>{t('quizTitle')}</Text>
      </View>
      <RoadmapKnob size={38}>
        <Icon name="chevron-right" size={16} color={homeGlassColors.roadmapKnobIcon} strokeWidth={2.2} />
      </RoadmapKnob>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  // Deliberately the same geometry as a day row (see PathNode): the survey
  // is the last stop of a phase, not a card bolted under it.
  quizRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 9,
    paddingHorizontal: 10,
  },
  quizTitle: {
    fontSize: 17.5,
    lineHeight: 23,
    letterSpacing: -0.2,
  },
});
