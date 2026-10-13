// Chương trình tặng xu — the client half.
//
// Everything that decides anything lives in the database: whether this
// account takes part, which days still have xu on them, whether a claim has
// already happened, whether the gift is reachable. This file asks and
// renders. That split matters more here than anywhere else in the app,
// because xu are worth a physical parcel, so a client that could decide
// would be a client that could mint.
//
// One RPC answers the whole screen (`coin_overview`) rather than five, since
// every number on it has to agree with every other one and a set of separate
// reads can disagree halfway through a claim.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { errorMessage } from '@/lib/errorMessage';

export interface ClaimableDay {
  programDayId: string;
  dayNumber: number;
}

export interface CoinOverview {
  active: boolean;
  /** Plus and above, or App Review. Everything else on the screen is moot
   * when this is false. */
  eligible: boolean;
  balance: number;
  coinsPerDay: number;
  coinsPerStreak: number;
  giftThreshold: number;
  streakMilestones: number[];
  /** Days finished in this programme — what the milestones are measured
   * against. NOT user_programs.streak, which counts something else; see
   * 202610132500. */
  daysDone: number;
  claimableDays: ClaimableDay[];
  claimableStreaks: number[];
  gift: {
    threshold: number;
    reached: boolean;
    claimedAt: string | null;
    fulfilledAt: string | null;
  };
}

const EMPTY: CoinOverview = {
  active: false, eligible: false, balance: 0, coinsPerDay: 0, coinsPerStreak: 0,
  giftThreshold: 0, streakMilestones: [], daysDone: 0, claimableDays: [], claimableStreaks: [],
  gift: { threshold: 0, reached: false, claimedAt: null, fulfilledAt: null },
};

function toOverview(raw: unknown): CoinOverview {
  const row = (raw ?? {}) as Record<string, unknown>;
  const gift = (row.gift ?? {}) as Record<string, unknown>;
  const num = (value: unknown) => Number(value ?? 0) || 0;
  return {
    active: !!row.active,
    eligible: !!row.eligible,
    balance: num(row.balance),
    coinsPerDay: num(row.coinsPerDay),
    coinsPerStreak: num(row.coinsPerStreak),
    giftThreshold: num(row.giftThreshold),
    streakMilestones: Array.isArray(row.streakMilestones) ? (row.streakMilestones as number[]) : [],
    daysDone: num(row.daysDone),
    claimableDays: Array.isArray(row.claimableDays)
      ? (row.claimableDays as Record<string, unknown>[]).map((d) => ({
          programDayId: String(d.programDayId ?? ''),
          dayNumber: num(d.dayNumber),
        }))
      : [],
    claimableStreaks: Array.isArray(row.claimableStreaks) ? (row.claimableStreaks as number[]) : [],
    gift: {
      threshold: num(gift.threshold),
      reached: !!gift.reached,
      claimedAt: (gift.claimedAt as string) ?? null,
      fulfilledAt: (gift.fulfilledAt as string) ?? null,
    },
  };
}

export function coinKey(userProgramId?: string | null) {
  return ['coin_overview', userProgramId ?? 'none'] as const;
}

export function useCoinOverview(userProgramId: string | undefined, enabled = true) {
  const query = useQuery({
    queryKey: coinKey(userProgramId),
    queryFn: async (): Promise<CoinOverview> => {
      const { data, error } = await supabase.rpc('coin_overview', {
        p_user_program_id: userProgramId ?? undefined,
      });
      if (error) throw error;
      return toOverview(data);
    },
    enabled,
    staleTime: 30_000,
  });
  return { ...query, overview: query.data ?? EMPTY };
}

/** Invalidates every variant, because a claim changes the balance that the
 * programme-less overview also shows. */
function useInvalidateCoins() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: ['coin_overview'] });
}

export function useClaimDayCoins() {
  const invalidate = useInvalidateCoins();
  return useMutation({
    mutationFn: async ({ userProgramId, programDayId }: { userProgramId: string; programDayId: string }) => {
      const { data, error } = await supabase.rpc('claim_day_coins', {
        p_user_program_id: userProgramId,
        p_program_day_id: programDayId,
      });
      if (error) throw error;
      return Number(data ?? 0);
    },
    onSuccess: invalidate,
  });
}

export function useClaimStreakCoins() {
  const invalidate = useInvalidateCoins();
  return useMutation({
    mutationFn: async ({ userProgramId, milestone }: { userProgramId: string; milestone: number }) => {
      const { data, error } = await supabase.rpc('claim_streak_coins', {
        p_user_program_id: userProgramId,
        p_milestone: milestone,
      });
      if (error) throw error;
      return Number(data ?? 0);
    },
    onSuccess: invalidate,
  });
}

export function useClaimGift() {
  const invalidate = useInvalidateCoins();
  return useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('claim_coin_gift');
      if (error) throw error;
    },
    onSuccess: invalidate,
  });
}

export interface CoinEntry {
  id: string;
  amount: number;
  kind: 'day' | 'streak' | 'admin';
  dayNumber: number | null;
  streakMilestone: number | null;
  createdAt: string;
}

/** The history the xu screen lists. Reads the ledger directly — RLS already
 * limits it to the caller's own rows. */
export function useCoinHistory(enabled = true) {
  return useQuery({
    queryKey: ['coin_history'],
    queryFn: async (): Promise<CoinEntry[]> => {
      const { data, error } = await supabase
        .from('coin_entries')
        .select('id, amount, kind, streak_milestone, created_at, program_days(day_number)')
        .order('created_at', { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data ?? []).map((row) => ({
        id: row.id,
        amount: row.amount,
        kind: (row.kind === 'streak' || row.kind === 'admin' ? row.kind : 'day') as CoinEntry['kind'],
        dayNumber: (row.program_days as { day_number: number } | null)?.day_number ?? null,
        streakMilestone: row.streak_milestone ?? null,
        createdAt: row.created_at,
      }));
    },
    enabled,
    staleTime: 30_000,
  });
}

/** Turns the server's refusal into a translation key. Uses errorMessage, not
 * `instanceof Error`: a PostgREST failure is a plain object, and reading it
 * with the instanceof guard is exactly the bug that made the paywall blame
 * the network for a decision the server had made on purpose. */
export function explainCoinError(error: unknown): string {
  const message = errorMessage(error);
  if (message.includes('plan_required')) return 'coinErrPlan';
  if (message.includes('already_claimed')) return 'coinErrAlready';
  if (message.includes('gift_already_claimed')) return 'coinErrGiftTaken';
  if (message.includes('not_enough_coins')) return 'coinErrNotEnough';
  if (message.includes('day_not_done')) return 'coinErrDayNotDone';
  if (message.includes('milestone_not_reached')) return 'coinErrMilestone';
  return 'coinErrGeneric';
}
