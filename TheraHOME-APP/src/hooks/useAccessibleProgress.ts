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
  /** True once the day/lock/purchase queries have all settled — until then
   * `day` may briefly be the UNCAPPED calendar day. Side-effectful
   * consumers (the reminder scheduling/inbox backfill in app/_layout.tsx,
   * which writes a permanent inbox row) must wait for this; pure display
   * can render the provisional value. */
  isReady: boolean;
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
    // Readiness means "the queries have settled", NOT "there is data". A
    // published roadmap with no program_days yet yields zero days, and the
    // old `days.length > 0` test then left this false forever: Home's hero
    // span an ActivityIndicator that never resolved, and _layout.tsx's
    // reminder scheduling — which waits on isReady — silently never ran for
    // that account. `usePhaseLockRequirements` is itself disabled when there
    // are no phase ids, so it can never report isFetched in that case.
    const lockSettled = phaseIds.length === 0 || lockRequirementsQuery.isFetched;
    const isReady =
      !program || (daysQuery.isFetched && lockSettled && (!userId || purchasesQuery.isFetched));
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
    return { day, totalDays, isReady };
  }, [days, phaseIds.length, daysQuery.isFetched, lockRequirementsQuery.data, lockRequirementsQuery.isFetched, purchasesQuery.data, purchasesQuery.isFetched, program, isReviewAccount, painLogsQuery.data, userId]);
}
