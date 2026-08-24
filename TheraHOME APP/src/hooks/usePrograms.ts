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

export interface ActivatedProgram {
  userProgramId: string;
  productId: string;
  currentDay: number;
  streak: number;
  adherencePct: number;
  product: ProductInfo;
}

/** The user's activated devices (supports multiple at once — one row per
 * product). Root layout uses `.length > 0` as the real activation gate. */
export function useActivatedPrograms(userId: string | undefined) {
  const language = useAppStore((state) => state.language);
  const productsQuery = useProducts();

  return useQuery({
    queryKey: ['user_programs', userId, language],
    queryFn: async (): Promise<ActivatedProgram[]> => {
      const { data, error } = await supabase
        .from('user_programs')
        .select('id, product_id, current_day, streak, adherence_pct')
        .eq('user_id', userId!);
      if (error) throw error;
      const products = productsQuery.data ?? [];
      return data.map((row) => ({
        userProgramId: row.id,
        productId: row.product_id,
        currentDay: row.current_day,
        streak: row.streak,
        adherencePct: row.adherence_pct,
        product: products.find((p) => p.id === row.product_id) ?? FALLBACK_PRODUCT(row.product_id),
      }));
    },
    enabled: !!userId && productsQuery.isSuccess,
  });
}

export interface DayRow {
  /** day_number (1..totalDays) — kept as `id` for parity with the old mock
   * shape, since routing/display key off the human day number. */
  id: number;
  /** program_days.id (uuid) — needed for the complete_day RPC. */
  programDayId: string;
  phase: string;
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
 * names (kept as a separate small query so the join stays one level deep). */
export function useProgramDays(userProgramId: string | undefined, productId: string | undefined) {
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
    queryKey: ['user_program_days', userProgramId],
    queryFn: async (): Promise<DayRow[]> => {
      const { data, error } = await supabase
        .from('user_program_days')
        .select('status, program_days(id, day_number, day_type, video_url_vn, video_url_us, video_url_malay, support_tools_url_vn, support_tools_url_us, support_tools_url_malay, phase_id)')
        .eq('user_program_id', userProgramId!);
      if (error) throw error;
      const phases = phasesQuery.data ?? [];
      const rows = (data as unknown as RawUserProgramDay[])
        .filter((r): r is RawUserProgramDay & { program_days: NonNullable<RawUserProgramDay['program_days']> } => !!r.program_days)
        .map((r) => ({
          id: r.program_days.day_number,
          programDayId: r.program_days.id,
          phase: phases.find((ph) => ph.id === r.program_days.phase_id)?.name ?? '',
          status: r.status as DayStatus,
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
export function useCatalogProgramDays(productId: string | undefined, userProgramId?: string) {
  const language = useAppStore((state) => state.language);
  return useQuery({
    queryKey: ['catalog_program_days', productId, userProgramId, language],
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
      return daysRes.data.map((day) => ({
        id: day.day_number,
        programDayId: day.id,
        phase: phaseNames.get(day.phase_id) ?? '',
        status: (statuses.get(day.id) ?? 'preview') as DayStatus,
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
export function usePainLogs(userProgramId: string | undefined) {
  return useQuery({
    queryKey: ['pain_logs', userProgramId],
    queryFn: async (): Promise<number[]> => {
      const { data, error } = await supabase
        .from('pain_logs')
        .select('score, program_days(day_number)')
        .eq('user_program_id', userProgramId!);
      if (error) throw error;
      return (data as unknown as RawPainLog[])
        .slice()
        .sort((a, b) => (a.program_days?.day_number ?? 0) - (b.program_days?.day_number ?? 0))
        .map((r) => r.score);
    },
    enabled: !!userProgramId,
  });
}

/** Latest pain check-in for one program day. Used to avoid prompting twice
 * and to carry the pre-session score into the explicit completion step. */
export function useDayPainScore(userProgramId: string | undefined, programDayId: string | undefined) {
  return useQuery({
    queryKey: ['pain_log', userProgramId, programDayId],
    queryFn: async (): Promise<number | null> => {
      const { data, error } = await supabase
        .from('pain_logs')
        .select('score')
        .eq('user_program_id', userProgramId!)
        .eq('program_day_id', programDayId!)
        .order('logged_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data?.score ?? null;
    },
    enabled: !!userProgramId && !!programDayId,
  });
}

/** Logs today's pain score, marks the day done, and unlocks the next one —
 * wraps the `complete_day` RPC (see the `program_progress` migration). */
export function useCompleteDay() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { userProgramId: string; programDayId: string; score: number }) => {
      // The score may already exist as the pre-session check-in. Capture
      // those ids before the RPC; after the RPC creates the canonical final
      // row, remove the earlier check-in so charts keep one value per day.
      const { data: priorLogs, error: priorError } = await supabase
        .from('pain_logs')
        .select('id')
        .eq('user_program_id', vars.userProgramId)
        .eq('program_day_id', vars.programDayId);
      if (priorError) throw priorError;

      const { error } = await supabase.rpc('complete_day', {
        p_user_program_id: vars.userProgramId,
        p_program_day_id: vars.programDayId,
        p_pain_score: vars.score,
      });
      if (error) throw error;

      const priorIds = priorLogs.map((log) => log.id);
      if (priorIds.length > 0) {
        const { error: cleanupError } = await supabase.from('pain_logs').delete().in('id', priorIds);
        if (cleanupError) throw cleanupError;
      }
    },
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: ['user_program_days', vars.userProgramId] });
      queryClient.invalidateQueries({ queryKey: ['pain_logs', vars.userProgramId] });
      queryClient.invalidateQueries({ queryKey: ['pain_log', vars.userProgramId, vars.programDayId] });
      queryClient.invalidateQueries({ queryKey: ['user_programs'] });
    },
  });
}
