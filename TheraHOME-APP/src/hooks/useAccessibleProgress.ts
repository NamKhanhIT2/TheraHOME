import { useMemo } from 'react';
import { useProgramDays, type ActivatedProgram } from '@/hooks/usePrograms';
import { usePhaseLockRequirements } from '@/hooks/usePhasePromo';
import { usePhasePurchases } from '@/hooks/usePhasePurchase';

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

  return useMemo(() => {
    const requirements = lockRequirementsQuery.data;
    const purchased = purchasesQuery.data;
    const accessible =
      !requirements || requirements.size === 0
        ? days.length
        : days.filter((d) => !requirements.has(d.phaseId) || purchased?.has(d.phaseId)).length;
    const totalDays = accessible || program?.product.totalDays || 0;
    const day = program && totalDays ? Math.min(program.currentDay, totalDays) : 0;
    return { day, totalDays };
  }, [days, lockRequirementsQuery.data, purchasesQuery.data, program]);
}
