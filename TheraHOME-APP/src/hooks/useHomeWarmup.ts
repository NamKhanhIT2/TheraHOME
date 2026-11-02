import { useEffect, useState } from 'react';
import { useActivatedPrograms, useDefaultProductId, useProducts, useProgramDays } from '@/hooks/usePrograms';
import { usePhaseLockRequirements } from '@/hooks/usePhasePromo';
import { usePhasePurchases } from '@/hooks/usePhasePurchase';

/** How long the splash may be held waiting for Home's data. Past this it
 * gives up and lets the app through — a slow network must not look like a
 * hang. */
const WARM_CAP_MS = 3000;

/**
 * Starts Home's data during the splash, and says when it has arrived.
 *
 * Two problems, one cause: nothing fetched until the tabs mounted, so after
 * the splash you got Home's own loading state, and before even that a flash
 * of the app shell's near-white `bgApp` while Home — a mask, several SVGs and
 * two photographs — built itself. Both are covered by keeping the splash up
 * until Home can actually draw.
 *
 * It calls the HOOKS rather than re-implementing their fetches: a hand-copied
 * `prefetchQuery` would drift from the real query key the first time anyone
 * changed one, and warm a cache entry nobody reads.
 *
 * `program_days` is warmed too, because without it the splash hands over to a
 * hero full of placeholders — which is what the owner saw on 2026-10-24 and
 * is the whole thing this hook exists to prevent. It is two more serial round
 * trips (the phase names, then the days), so it is by far the longest part of
 * the chain and the one most worth starting early.
 *
 * It warms the FIRST activated programme rather than re-deriving Home's
 * choice: that choice reads the persisted selection, the default product, the
 * publish flags and the review-account rules, and a second copy of it here
 * would eventually disagree with the first. Everyone with one programme —
 * which is nearly everyone — gets the right one. Someone with two may still
 * see the hero's placeholders briefly, exactly as before.
 */
export function useHomeWarmup(userId: string | undefined): boolean {
  const products = useProducts();
  const programs = useActivatedPrograms(userId);
  useDefaultProductId(userId);
  usePhaseLockRequirements();
  usePhasePurchases(userId);
  const first = programs.data?.[0];
  const days = useProgramDays(first?.userProgramId, first?.productId, first?.activatedAt);

  const [capExpired, setCapExpired] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setCapExpired(true), WARM_CAP_MS);
    return () => clearTimeout(timer);
  }, []);

  // Settled, not just "not loading": there is a render between the programme
  // list arriving and the days query starting in which nothing is in flight,
  // and releasing the splash on that frame would defeat the point.
  const daysSettled = !first || days.isSuccess || days.isError;
  return capExpired || (!products.isLoading && !programs.isLoading && daysSettled);
}
