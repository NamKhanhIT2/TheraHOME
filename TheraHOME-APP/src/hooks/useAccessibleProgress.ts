import { useMemo } from 'react';
import { usePainLogs, useProgramDays, type ActivatedProgram } from '@/hooks/usePrograms';
import { usePhaseLockRequirements } from '@/hooks/usePhasePromo';
import { usePhasePurchases } from '@/hooks/usePhasePurchase';
import { useProfile } from '@/hooks/useProfile';

export interface AccessibleProgress {
  /** Calendar day capped at `totalDays` (0 when no program). */
  day: number;
  /** Days the user can actually reach: an IAP-locked, not-yet-purchased
   * phase's days are excluded (e.g. 14 while phase 3 is locked, 28 once
   * unlocked) — the same phase-hiding rule the Roadmap applies. Falls back
   * to the product's nominal total while day data loads. */
  totalDays: number;
}

/** One shared "Ngày N/X" source for Home's hero, the Profile header and the
 * community share snapshot, so every surface stays in sync with the phases
 * the selected program can actually reach. */
export function useAccessibleProgress(
  userId: string | undefined,
  program: ActivatedProgram | undefined,
): AccessibleProgress {
  const daysQuery = useProgramDays(program?.userProgramId, program?.productId, program?.activatedAt);
  const days = useMemo(() => daysQuery.data ?? [], [daysQuery.data]);
  const phaseIds = useMemo(() => Array.from(new Set(days.map((d) => d.phaseId))), [days]);
  const lockRequirementsQuery = usePhaseLockRequirements(phaseIds);
  const purchasesQuery = usePhasePurchases(userId);
  // App Review accounts aren't calendar-gated, so their "Ngày N" follows
  // actual activity instead of days-since-activation — see below.
  const isReviewAccount = useProfile(userId).data?.accountType === 'review';
  const painLogsQuery = usePainLogs(program?.userProgramId);

  return useMemo(() => {
    const requirements = lockRequirementsQuery.data;
    const purchased = purchasesQuery.data;
    const accessible =
      !requirements || requirements.size === 0
        ? days.length
        : days.filter((d) => !requirements.has(d.phaseId) || purchased?.has(d.phaseId)).length;
    const totalDays = accessible || program?.product.totalDays || 0;
    let day = program && totalDays ? Math.min(program.currentDay, totalDays) : 0;
    if (isReviewAccount && program && totalDays) {
      // The furthest day the reviewer actually touched (watched OR did the
      // discomfort check-in) drives the hero/profile "Ngày N/X" — showing
      // "Ngày 1" while the chart already has N9's log reads as out of sync.
      const doneMax = days.reduce((max, d) => (d.status === 'done' && d.id > max ? d.id : max), 0);
      const logMax = (painLogsQuery.data ?? []).reduce((max, p) => (p.day > max ? p.day : max), 0);
      const activity = Math.max(doneMax, logMax);
      day = Math.min(totalDays, Math.max(day, activity + 1));
    }
    return { day, totalDays };
  }, [days, lockRequirementsQuery.data, purchasesQuery.data, program, isReviewAccount, painLogsQuery.data]);
}
