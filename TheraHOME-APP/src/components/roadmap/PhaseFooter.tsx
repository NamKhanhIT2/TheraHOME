import React, { Fragment } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useTheme } from '@/theme';
import { Icon } from '@/components/icons/Icon';
import { usePhaseQuiz, useQuizAttempt } from '@/hooks/useQuiz';
import { PhaseUnlockPromo } from '@/components/roadmap/PhaseUnlockPromo';
import { useI18n } from '@/lib/i18n';

export interface PhaseFooterProps {
  userId: string | undefined;
  productId: string;
  /** The phase that was just completed — the quiz (if any) tests knowledge
   * of this phase. */
  phaseId: string;
  phaseName: string;
  /** The phase that follows — `phase_promos`/the unlock paywall belong to
   * *this* phase (it's the one the "Mở khoá Giai đoạn N" card is actually
   * for), even though the card renders right after the previous phase's
   * last day since the next phase hasn't started yet. Null when the
   * completed phase was the product's last one — nothing to unlock. */
  nextPhaseId: string | null;
  nextPhaseName: string | null;
  /** Already verified purchased — hides the unlock card inside the promo. */
  unlocked: boolean;
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

/** Rendered at every phase end (disabled state while days remain). The
 * survey row (if the phase has one) always exists while expanded — either
 * the "take it" prompt or a persistent "Đã hoàn thành" row once submitted.
 * The two promo cards (`PhaseUnlockPromo`: cross-sell + unlock-next-phase)
 * appear ONLY after this phase's survey is submitted (per explicit request
 * — finishing the days alone is not enough; a phase with no survey skips
 * straight to the cards). Once they appear they render regardless of
 * `collapsed`, so they stand apart below the collapsed phase — and by then
 * roadmap.tsx's `currentPhaseId` is null, which collapses phases 1/2 by
 * default. Nothing renders if there is no next phase. */
export function PhaseFooter({ userId, productId, phaseId, phaseName, nextPhaseId, nextPhaseName, unlocked, enabled, lockedDayNumber, collapsed }: PhaseFooterProps) {
  const theme = useTheme();
  const { t } = useI18n();
  const questionsQuery = usePhaseQuiz(phaseId);
  const attemptQuery = useQuizAttempt(userId, phaseId);

  if (questionsQuery.isPending || attemptQuery.isPending) return null;

  const hasQuiz = (questionsQuery.data?.length ?? 0) > 0;
  const quizDone = !hasQuiz || !!attemptQuery.data;
  const promo = nextPhaseId && nextPhaseName ? <PhaseUnlockPromo phaseId={nextPhaseId} phaseName={nextPhaseName} unlocked={unlocked} /> : null;

  // Phase not finished yet: the quiz row shows in a disabled state so the
  // user can see it coming; promos wait until the phase is actually done.
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

  if (!hasQuiz) return promo;

  // Survey not submitted yet: only the take-survey prompt (while expanded)
  // — the promo cards stay hidden until the survey is done.
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

  if (collapsed) return promo;

  return (
    <Fragment>
      {(
        <View style={[styles.quizRow, theme.shadows.card, { backgroundColor: theme.colors.bgCard, borderRadius: theme.radius.lg, padding: theme.cardPadding, marginBottom: promo ? 14 : 0 }]}>
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
      {promo}
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
