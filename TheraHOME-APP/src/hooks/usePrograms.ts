// Phase 3: real per-user program data, replacing the Phase 1 mock store's
// activatedProductIds/productPainLevels/loggedDays. See CLAUDE.md.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { ThemeColors } from '@/theme/colors';
import type { DayStatus, DayType } from '@/lib/mockData';
import { useAppStore, type AppLanguage } from '@/store/useAppStore';
import { localizePhaseName, localizeProductName } from '@/lib/adminContent';
import { marketForLanguage } from '@/hooks/useStore';

/** Resolves a day's market-specific video/support-tools link, falling back
 * to the VN value if the viewer's own market hasn't been filled in yet —
 * mirrors `translate()`'s vi-fallback shape. Shared by both queries below
 * since they read the same 6 market columns. */
function resolveMarketDayContent(
  language: AppLanguage,
  day: { video_url_vn: string | null; video_url_us: string | null; video_url_malay: string | null; support_tools_url_vn: string | null; support_tools_url_us: string | null; support_tools_url_malay: string | null },
): { video: string; supportToolsUrl: string } {
  const market = marketForLanguage(language);
  const video = market === 'US' ? day.video_url_us : market === 'MALAY' ? day.video_url_malay : day.video_url_vn;
  const supportToolsUrl = market === 'US' ? day.support_tools_url_us : market === 'MALAY' ? day.support_tools_url_malay : day.support_tools_url_vn;
  return { video: video ?? day.video_url_vn ?? '', supportToolsUrl: supportToolsUrl ?? day.support_tools_url_vn ?? '' };
}

export interface ProductInfo {
  id: string;
  name: string;
  accent: keyof ThemeColors;
  totalDays: number;
}

const FALLBACK_PRODUCT = (id: string): ProductInfo => ({ id, name: id, accent: 'primary', totalDays: 28 });

// Reference data — 4 rows, admin-managed, effectively static.
export function useProducts() {
  const language = useAppStore((state) => state.language);
  return useQuery({
    queryKey: ['products', language],
    queryFn: async (): Promise<ProductInfo[]> => {
      const { data, error } = await supabase.from('products').select('id, name, accent_color_key, total_days');
      if (error) throw error;
      return data.map((p) => ({
        id: p.id,
        name: localizeProductName(p.id, p.name, language),
        accent: p.accent_color_key as keyof ThemeColors,
        totalDays: p.total_days,
      }));
    },
    staleTime: Infinity,
  });
}

export interface PrimaryProductsInfo {
  /** Product ids that belong to a PRIMARY store group ("nhóm sản phẩm
   * chính", admin-managed on store_categories.is_primary). Any market's
   * row counts, so a device stays listed while its UK/ML store content is
   * still being filled in. */
  ids: string[];
  /** Display name per product for the VIEWER'S market, straight from the
   * store item row admin filled for that market in the Sản Phẩm tab (VN
   * row as fallback) — so the device dropdown shows the market's own
   * wording instead of the single-language products.name. */
  nameById: Record<string, string>;
}

/** The devices the Home/Roadmap dropdowns list, with per-market names —
 * see PrimaryProductsInfo. */
export function usePrimaryProducts() {
  const language = useAppStore((state) => state.language);
  const market = marketForLanguage(language);
  return useQuery({
    queryKey: ['primary_products', market],
    queryFn: async (): Promise<PrimaryProductsInfo> => {
      const { data, error } = await supabase
        .from('store_items')
        .select('product_id, name, market, store_categories!inner(is_primary)')
        .eq('store_categories.is_primary', true)
        .not('product_id', 'is', null);
      if (error) throw error;
      const rows = data ?? [];
      const ids = [...new Set(rows.map((row) => row.product_id as string))];
      const nameById: Record<string, string> = {};
      // VN names first, then the viewer's market rows override them.
      for (const row of rows) {
        if (row.market === 'VN' && row.name?.trim()) nameById[row.product_id as string] = row.name.trim();
      }
      if (market !== 'VN') {
        for (const row of rows) {
          if (row.market === market && row.name?.trim()) nameById[row.product_id as string] = row.name.trim();
        }
      }
      return { ids, nameById };
    },
    staleTime: 5 * 60 * 1000,
  });
}

export interface ActivatedProgram {
  userProgramId: string;
  productId: string;
  /** Calendar-derived "today's day" (1-based, capped at totalDays) — days
   * unlock automatically one per local calendar day since `activatedAt`;
   * the DB's `current_day` column is no longer what drives this. */
  currentDay: number;
  activatedAt: string;
  streak: number;
  adherencePct: number;
  product: ProductInfo;
}

/** Whole local calendar days elapsed since `iso` (0 on the activation day
 * itself) — local midnight is the unlock boundary ("Mở khoá sau 0h"). */
export function daysSinceLocal(iso: string): number {
  const start = new Date(iso);
  start.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.max(0, Math.round((today.getTime() - start.getTime()) / 86_400_000));
}

/** Derives a day's display status from the calendar (see DayStatus). The
 * DB row's own status only matters for 'done' (= video watched). */
export function deriveDayStatus(dayNumber: number, dbStatus: string | undefined, todayDay: number): DayStatus {
  if (dbStatus === 'done') return 'done';
  if (dayNumber < todayDay) return 'missed';
  if (dayNumber === todayDay) return 'current';
  if (dayNumber === todayDay + 1) return 'upcoming';
  return 'locked';
}

/** The user's activated devices (supports multiple at once — one row per
 * product). Root layout uses `.length > 0` as the real activation gate. */
export function useActivatedPrograms(userId: string | undefined) {
  const language = useAppStore((state) => state.language);
  const productsQuery = useProducts();

  return useQuery({
    queryKey: ['user_programs', userId, language],
    queryFn: async (): Promise<ActivatedProgram[]> => {
      // Deterministic order — roadmap/home fall back to the first program
      // when nothing is selected yet, and an unordered result made that
      // fallback effectively random per fetch.
      const { data, error } = await supabase
        .from('user_programs')
        .select('id, product_id, current_day, streak, adherence_pct, activated_at')
        .eq('user_id', userId!)
        .order('activated_at', { ascending: true })
        .order('id', { ascending: true });
      if (error) throw error;
      const products = productsQuery.data ?? [];
      return data.map((row) => {
        const product = products.find((p) => p.id === row.product_id) ?? FALLBACK_PRODUCT(row.product_id);
        return {
          userProgramId: row.id,
          productId: row.product_id,
          // Calendar-based, not the stored current_day: one day unlocks per
          // local calendar day since activation, capped at the program end.
          currentDay: Math.min(daysSinceLocal(row.activated_at) + 1, product.totalDays),
          activatedAt: row.activated_at,
          streak: row.streak,
          adherencePct: row.adherence_pct,
          product,
        };
      });
    },
    enabled: !!userId && productsQuery.isSuccess,
  });
}

/** The product tied to whichever order the user's claimed contact actually
 * matched (claim_user_access_contact grants the whole catalog at once, so
 * `user_programs` alone can't tell which one they ordered) — used to default
 * Home/Roadmap's product selection to the roadmap they actually bought
 * instead of just "first in the list". Null when there's nothing claimed yet
 * or no matching order (falls through to the existing fallback chain). */
export function useDefaultProductId(userId: string | undefined) {
  return useQuery({
    queryKey: ['default_product_for_contact', userId],
    queryFn: async (): Promise<string | null> => {
      const { data, error } = await supabase.rpc('get_default_product_for_contact');
      if (error) throw error;
      return data;
    },
    enabled: !!userId,
  });
}

export interface DayRow {
  /** day_number (1..totalDays) — kept as `id` for parity with the old mock
   * shape, since routing/display key off the human day number. */
  id: number;
  /** program_days.id (uuid) — needed for the complete_day RPC. */
  programDayId: string;
  phase: string;
  phaseId: string;
  status: DayStatus;
  video: string;
  /** Optional admin-managed link opened by "Dụng cụ hỗ trợ tập luyện". */
  supportToolsUrl: string;
  type: DayType;
}

interface RawUserProgramDay {
  status: string;
  program_days: {
    id: string;
    day_number: number;
    day_type: string;
    video_url_vn: string | null;
    video_url_us: string | null;
    video_url_malay: string | null;
    support_tools_url_vn: string | null;
    support_tools_url_us: string | null;
    support_tools_url_malay: string | null;
    phase_id: string;
  } | null;
}

/** A product's day-by-day template for a specific user_program, joined with
 * that program's per-day status. `productId` is only needed to resolve phase
 * names (kept as a separate small query so the join stays one level deep).
 * `activatedAt` (the program's activation timestamp) switches statuses to
 * the calendar-based derivation — pass it whenever you have the program. */
export function useProgramDays(userProgramId: string | undefined, productId: string | undefined, activatedAt?: string | null) {
  const language = useAppStore((state) => state.language);
  const phasesQuery = useQuery({
    queryKey: ['program_phases', productId, language],
    queryFn: async () => {
      const { data, error } = await supabase.from('program_phases').select('id, name').eq('product_id', productId!);
      if (error) throw error;
      return data.map((phase) => ({ ...phase, name: localizePhaseName(phase.name, language) }));
    },
    enabled: !!productId,
    staleTime: Infinity,
  });

  return useQuery({
    queryKey: ['user_program_days', userProgramId, activatedAt ?? null],
    queryFn: async (): Promise<DayRow[]> => {
      const { data, error } = await supabase
        .from('user_program_days')
        .select('status, program_days(id, day_number, day_type, video_url_vn, video_url_us, video_url_malay, support_tools_url_vn, support_tools_url_us, support_tools_url_malay, phase_id)')
        .eq('user_program_id', userProgramId!);
      if (error) throw error;
      const phases = phasesQuery.data ?? [];
      const todayDay = activatedAt ? daysSinceLocal(activatedAt) + 1 : null;
      const rows = (data as unknown as RawUserProgramDay[])
        .filter((r): r is RawUserProgramDay & { program_days: NonNullable<RawUserProgramDay['program_days']> } => !!r.program_days)
        .map((r) => ({
          id: r.program_days.day_number,
          programDayId: r.program_days.id,
          phase: phases.find((ph) => ph.id === r.program_days.phase_id)?.name ?? '',
          phaseId: r.program_days.phase_id,
          status: todayDay != null ? deriveDayStatus(r.program_days.day_number, r.status, todayDay) : (r.status as DayStatus),
          ...resolveMarketDayContent(language, r.program_days),
          type: r.program_days.day_type as DayType,
        }));
      return rows.sort((a, b) => a.id - b.id);
    },
    enabled: !!userProgramId && phasesQuery.isSuccess,
  });
}

/** Admin-managed roadmap template. Every published product roadmap remains
 * visible even when the user has not started it yet. If personal progress
 * exists, its statuses are merged onto the template; otherwise days are
 * marked as preview and remain open for read-only viewing. */
export function useCatalogProgramDays(productId: string | undefined, userProgramId?: string, activatedAt?: string | null) {
  const language = useAppStore((state) => state.language);
  return useQuery({
    queryKey: ['catalog_program_days', productId, userProgramId, activatedAt ?? null, language],
    queryFn: async (): Promise<DayRow[]> => {
      const [phasesRes, daysRes, progressRes] = await Promise.all([
        supabase
          .from('program_phases')
          .select('id, name')
          .eq('product_id', productId!)
          .order('sort_order'),
        supabase
          .from('program_days')
          .select('id, day_number, day_type, video_url_vn, video_url_us, video_url_malay, support_tools_url_vn, support_tools_url_us, support_tools_url_malay, phase_id')
          .eq('product_id', productId!)
          .order('day_number'),
        userProgramId
          ? supabase
              .from('user_program_days')
              .select('program_day_id, status')
              .eq('user_program_id', userProgramId)
          : Promise.resolve({ data: [], error: null }),
      ]);
      if (phasesRes.error) throw phasesRes.error;
      if (daysRes.error) throw daysRes.error;
      if (progressRes.error) throw progressRes.error;

      const phaseNames = new Map(phasesRes.data.map((phase) => [phase.id, localizePhaseName(phase.name, language)]));
      const statuses = new Map(progressRes.data.map((row) => [row.program_day_id, row.status]));
      const todayDay = userProgramId && activatedAt ? daysSinceLocal(activatedAt) + 1 : null;
      return daysRes.data.map((day) => ({
        id: day.day_number,
        programDayId: day.id,
        phase: phaseNames.get(day.phase_id) ?? '',
        phaseId: day.phase_id,
        status:
          todayDay != null
            ? deriveDayStatus(day.day_number, statuses.get(day.id), todayDay)
            : ((statuses.get(day.id) ?? 'preview') as DayStatus),
        ...resolveMarketDayContent(language, day),
        type: day.day_type as DayType,
      }));
    },
    enabled: !!productId,
  });
}

interface RawPainLog {
  score: number;
  program_days: { day_number: number } | null;
}

/** Pain scores for a program, oldest-first — feeds `PainChart`'s `data` prop
 * the same way the mock's `painLevels` array did. */
/** One logged check-in, tied to its ACTUAL program day — the chart labels
 * points by `day`, so a user who first answers on day 2 sees "N2", not a
 * point renumbered to N1 (which is what the old plain-scores array did). */
export interface PainLogPoint {
  day: number;
  score: number;
}

export function usePainLogs(userProgramId: string | undefined) {
  return useQuery({
    queryKey: ['pain_logs', userProgramId],
    queryFn: async (): Promise<PainLogPoint[]> => {
      const { data, error } = await supabase
        .from('pain_logs')
        .select('score, program_days(day_number)')
        .eq('user_program_id', userProgramId!);
      if (error) throw error;
      return (data as unknown as RawPainLog[])
        .slice()
        .sort((a, b) => (a.program_days?.day_number ?? 0) - (b.program_days?.day_number ?? 0))
        .map((r) => ({ day: r.program_days?.day_number ?? 0, score: r.score }));
    },
    enabled: !!userProgramId,
  });
}

/** Records that the user watched a day's video — the only thing that marks
 * a day completed under the calendar-unlock mechanic (2026-08-31). Wraps the
 * `mark_day_watched` RPC: sets that day's status to 'done' and refreshes
 * streak/adherence, but never advances/unlocks anything (unlocking is pure
 * calendar time). Resolves `true` when the day was newly marked (false when
 * it was already done — callers use this to only celebrate once). */
export function useMarkDayWatched() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { userProgramId: string; programDayId: string }): Promise<boolean> => {
      const { data, error } = await supabase.rpc('mark_day_watched', {
        p_user_program_id: vars.userProgramId,
        p_program_day_id: vars.programDayId,
      });
      if (error) throw error;
      return !!data;
    },
    onSuccess: (_newly, vars) => {
      queryClient.invalidateQueries({ queryKey: ['user_program_days', vars.userProgramId] });
      queryClient.invalidateQueries({ queryKey: ['catalog_program_days'] });
      queryClient.invalidateQueries({ queryKey: ['user_programs'] });
    },
  });
}
