import React, { Fragment } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useTheme } from '@/theme';
import { Icon } from '@/components/icons/Icon';
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
      <View style={[styles.quizRow, theme.shadows.card, { backgroundColor: theme.colors.bgCard, borderRadius: theme.radius.lg, padding: theme.cardPadding, opacity: 0.62 }]}>
        <View style={[styles.quizIcon, { backgroundColor: theme.colors.bgCardAlt }]}>
          <Icon name="lock" size={18} color={theme.colors.textMuted} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[theme.type.bodyStrong, { color: theme.colors.textSecondary }]}>{t('quizTitle')}</Text>
          <Text style={[theme.type.captionSm, { color: theme.colors.textMuted, marginTop: 2 }]}>
            {t('quizLockedHint', { day: lockedDayNumber })}
          </Text>
        </View>
      </View>
    );
  }

  if (!hasQuiz) return null;

  // Survey not submitted yet: the take-survey prompt (while expanded).
  if (!quizDone) {
    if (collapsed) return null;
    return (
      <Pressable
        onPress={() => router.push({ pathname: '/quiz/[phaseId]', params: { phaseId, productId, phaseName } })}
        style={[styles.quizRow, theme.shadows.card, { backgroundColor: theme.colors.bgCard, borderRadius: theme.radius.lg, padding: theme.cardPadding }]}
      >
        <View style={[styles.quizIcon, { backgroundColor: theme.colors.primaryTint10 }]}>
          <Icon name="clipboard-check" size={19} color={theme.colors.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[theme.type.bodyStrong, { color: theme.colors.textPrimary }]}>{t('quizTitle')}</Text>
          <Text style={[theme.type.captionSm, { color: theme.colors.textMuted, marginTop: 2 }]}>{phaseName}</Text>
        </View>
        <View style={[styles.quizCta, { backgroundColor: theme.colors.primary, borderRadius: theme.radius.md }]}>
          <Text style={[theme.type.captionSm, { color: '#fff', fontFamily: theme.fontFamily.semiBold }]}>{t('quizTakeQuiz')}</Text>
        </View>
      </Pressable>
    );
  }

  if (collapsed) return null;

  return (
    <Fragment>
      {(
        <View style={[styles.quizRow, theme.shadows.card, { backgroundColor: theme.colors.bgCard, borderRadius: theme.radius.lg, padding: theme.cardPadding, marginBottom: 0 }]}>
          <View style={[styles.quizIcon, { backgroundColor: theme.colors.primaryTint10 }]}>
            <Icon name="clipboard-check" size={19} color={theme.colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[theme.type.bodyStrong, { color: theme.colors.textPrimary }]}>{t('quizTitle')}</Text>
            <Text style={[theme.type.captionSm, { color: theme.colors.textMuted, marginTop: 2 }]}>{phaseName}</Text>
          </View>
          <View style={[styles.doneBadge, { backgroundColor: theme.colors.successTint }]}>
            <Icon name="check" size={13} color={theme.colors.success} />
            <Text style={[theme.type.captionSm, { color: theme.colors.success, fontFamily: theme.fontFamily.semiBold }]}>{t('quizCompleted')}</Text>
          </View>
        </View>
      )}
    </Fragment>
  );
}

const styles = StyleSheet.create({
  quizRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  quizIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quizCta: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  doneBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
});
