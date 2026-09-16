// Data for the customer training area (/luyen-tap) — the web half of what the
// mobile app shows. Same Supabase project, same rows: a day watched here is
// done on the phone and vice versa.
//
// EVERY RULE HERE MUST MATCH THE APP. They are subtle, the backend docs
// described a superseded version until 2026-09-15, and a mismatch shows up as
// the web and the phone disagreeing about the same customer. Audited against
// TheraHOME-APP on 2026-09-15; the app file each rule comes from is named.
//
//  1. Which day is open is NOT `user_programs.current_day`. It is derived from
//     `activated_at` by LOCAL calendar day (usePrograms.ts daysSinceLocal /
//     deriveDayStatus). Math.ROUND, not floor — see daysSinceLocal below.
//  2. Opening a day with no pain log is gated behind the pain scale
//     (useRequestDay.ts); a logging failure must never block the workout, and
//     a second tap must not write a second row.
//  3. No "complete" button: completion is `mark_day_watched`, fired when the
//     video actually STARTS PLAYING (app/day/[dayId].tsx, `state === 'playing'`)
//     — not when the player loads — and only for a 'current' or 'missed' day.
//     `complete_day` still exists in the database and is still granted, but
//     nothing calls it. Do not use it.
//  4. An App Review account (`account_type = 'review'`) bypasses every day
//     lock (useRequestDay.ts), matching mark_day_watched's own server-side
//     exemption.
//  5. A paid, unpurchased phase's days are excluded from "Ngày N / X" and
//     cannot be opened (useAccessibleProgress.ts). A phase is paid when
//     phase_promos carries a store product id — today none do.
//  6. An unpublished roadmap (`products.roadmap_published = false`) shows a
//     "đang hoàn thiện" notice instead of openable days.
//  7. The programme shown is the one `get_default_product_for_contact` names
//     — what they actually bought — with the first row (ordered by
//     activated_at THEN id, for determinism) as the fallback.
import { supabase } from "./supabase";

export type DayStatus = "done" | "current" | "missed" | "upcoming" | "locked";

export interface TrainingDay {
  programDayId: string;
  dayNumber: number;
  dayType: string;
  videoUrl: string | null;
  supportToolsUrl: string | null;
  supportToolsLabel: string | null;
  phaseName: string | null;
  /** From user_program_days — the stored side of completion. */
  dbStatus: string | null;
  completedAt: string | null;
  /** dbStatus reconciled with the calendar. This is what the UI shows. */
  status: DayStatus;
  hasPainLog: boolean;
  /** This day sits in a paid phase the customer has not unlocked. */
  phaseLocked: boolean;
}

export interface TrainingProgram {
  userProgramId: string;
  productId: string;
  productName: string;
  activatedAt: string;
  /** Days the customer can actually reach: a paid, unpurchased phase's days
   * are excluded, the same rule the app's useAccessibleProgress applies. */
  totalDays: number;
  /** 1-based, capped at totalDays. */
  todayDay: number;
  days: TrainingDay[];
  /** account_type === 'review'. App Review accounts bypass every day lock —
   * the app does this, and mark_day_watched has a matching server exemption. */
  isReviewAccount: boolean;
  /** False = the roadmap is still a draft; the app refuses to open days. */
  roadmapPublished: boolean;
}

/** Local calendar date as YYYY-MM-DD. Never toISOString(), which is UTC and
 * would roll the day over at the wrong moment for anyone east or west of it. */
export function localDateString(d: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Whole local calendar days elapsed since `iso` (0 on the activation day
 * itself) — local midnight is the unlock boundary.
 *
 * Byte-for-byte the app's daysSinceLocal, including `Math.round`. Round, not
 * floor: both ends are normalised to local midnight, so the gap is an exact
 * multiple of 24h EXCEPT across a DST change, where it is 23h or 25h. Floor
 * would swallow a whole day for a US customer every spring, unlocking their
 * day late and disagreeing with their phone. */
export function daysSinceLocal(iso: string): number {
  const start = new Date(iso);
  start.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.max(0, Math.round((today.getTime() - start.getTime()) / 86_400_000));
}

export function deriveDayStatus(dayNumber: number, dbStatus: string | null, todayDay: number): DayStatus {
  if (dbStatus === "done") return "done";
  if (dayNumber < todayDay) return "missed";
  if (dayNumber === todayDay) return "current";
  if (dayNumber === todayDay + 1) return "upcoming";
  return "locked";
}

/** Which market's video to play. Mirrors resolveMarketDayContent in the app:
 * US/Malay fall back to the Vietnamese asset when they have none of their own. */
function pickMarket<T>(market: string | null, vn: T, us: T, ms: T): T {
  if (market === "US") return us ?? vn;
  if (market === "MALAY") return ms ?? vn;
  return vn;
}

export async function fetchTrainingProgram(userId: string): Promise<TrainingProgram | null> {
  const [{ data: programs, error: pErr }, { data: profile }, { data: defaultProductId }] = await Promise.all([
    supabase
      .from("user_programs")
      .select("id, product_id, activated_at")
      .eq("user_id", userId)
      // Both keys, like the app: an unordered result made "first programme"
      // effectively random per fetch for a customer with two devices.
      .order("activated_at", { ascending: true })
      .order("id", { ascending: true }),
    // `country`, not `market`. The column is named country and already holds
    // the market code ('VN' | 'US' | 'MALAY') — see the app's useMarket().
    // Selecting a column that does not exist makes PostgREST fail the whole
    // row, which silently cost every customer their market AND every App
    // Review account its bypass, so the error is logged rather than dropped.
    supabase
      .from("profiles")
      .select("country, account_type")
      .eq("id", userId)
      .maybeSingle()
      .then((r) => {
        if (r.error) console.error("Unable to read the profile row", r.error);
        return r;
      }),
    // Which roadmap they actually bought. claim_user_access_contact grants the
    // whole catalog, so user_programs alone cannot tell — same RPC the app uses.
    supabase.rpc("get_default_product_for_contact").then((r) => ({ data: r.data as string | null })),
  ]);
  if (pErr) throw pErr;
  if (!programs?.length) return null;
  const program = programs.find((p) => p.product_id === defaultProductId) ?? programs[0];

  const market = (profile as { country?: string } | null)?.country ?? null;
  const isReviewAccount = (profile as { account_type?: string } | null)?.account_type === "review";

  const [{ data: product }, { data: days, error: dErr }, { data: mine }, { data: phases }, { data: pains }] =
    await Promise.all([
      supabase.from("products").select("name, total_days, roadmap_published").eq("id", program.product_id).maybeSingle(),
      supabase
        .from("program_days")
        .select("id, day_number, day_type, phase_id, video_url_vn, video_url_us, video_url_malay, support_tools_url_vn, support_tools_url_us, support_tools_url_malay, support_tools_label_vn, support_tools_label_us, support_tools_label_malay")
        .eq("product_id", program.product_id)
        .order("day_number"),
      supabase.from("user_program_days").select("program_day_id, status, completed_at").eq("user_program_id", program.id),
      supabase.from("program_phases").select("id, name, name_en, name_ms").eq("product_id", program.product_id),
      // Scoped to this programme, like the app's check — not to the whole user.
      supabase.from("pain_logs").select("program_day_id").eq("user_program_id", program.id),
    ]);
  if (dErr) throw dErr;

  const phaseIds = [...new Set((days ?? []).map((d) => d.phase_id).filter(Boolean))] as string[];

  // A phase is PAID only when it carries a store product id. The app reads the
  // column for its own platform; the web has no store at all, so either one
  // marks the phase as something this client cannot sell — the days are hidden
  // and the customer is pointed at the app, rather than being shown a day they
  // have not bought. Today both columns are null (Phase 3 is not built yet), so
  // this is inert — but it must not leak the moment that changes.
  const [{ data: promos }, { data: purchases }] = await Promise.all([
    phaseIds.length
      ? supabase.from("phase_promos").select("phase_id, apple_product_id, google_product_id").in("phase_id", phaseIds)
      : Promise.resolve({ data: [] as { phase_id: string; apple_product_id: string | null; google_product_id: string | null }[] }),
    supabase.from("phase_purchases").select("phase_id").eq("user_id", userId),
  ]);
  const paidPhases = new Set(
    (promos ?? []).filter((p) => p.apple_product_id !== null || p.google_product_id !== null).map((p) => p.phase_id),
  );
  const purchasedPhases = new Set((purchases ?? []).map((p) => p.phase_id));
  const phaseIsLocked = (phaseId: string | null) =>
    !isReviewAccount && !!phaseId && paidPhases.has(phaseId) && !purchasedPhases.has(phaseId);

  const statusByDay = new Map((mine ?? []).map((r) => [r.program_day_id, r]));
  const phaseById = new Map((phases ?? []).map((p) => [p.id, pickMarket(market, p.name, p.name_en, p.name_ms)]));
  const painDays = new Set((pains ?? []).map((p) => p.program_day_id));

  const allDays = days ?? [];
  // Reachable days only — an unpurchased paid phase does not count toward
  // "Ngày N / X", exactly as useAccessibleProgress computes it.
  const reachable = allDays.filter((d) => !phaseIsLocked(d.phase_id));
  const totalDays = reachable.length || product?.total_days || allDays.length || 14;
  const todayDay = Math.min(daysSinceLocal(program.activated_at) + 1, totalDays);

  return {
    userProgramId: program.id,
    productId: program.product_id,
    productName: product?.name ?? program.product_id,
    activatedAt: program.activated_at,
    totalDays,
    todayDay,
    isReviewAccount,
    roadmapPublished: product?.roadmap_published !== false,
    days: allDays.map((d) => {
      const own = statusByDay.get(d.id);
      return {
        programDayId: d.id,
        dayNumber: d.day_number,
        dayType: d.day_type,
        videoUrl: pickMarket(market, d.video_url_vn, d.video_url_us, d.video_url_malay),
        supportToolsUrl: pickMarket(market, d.support_tools_url_vn, d.support_tools_url_us, d.support_tools_url_malay),
        supportToolsLabel: pickMarket(market, d.support_tools_label_vn, d.support_tools_label_us, d.support_tools_label_malay),
        phaseName: phaseById.get(d.phase_id) ?? null,
        dbStatus: own?.status ?? null,
        completedAt: own?.completed_at ?? null,
        status: deriveDayStatus(d.day_number, own?.status ?? null, todayDay),
        hasPainLog: painDays.has(d.id),
        phaseLocked: phaseIsLocked(d.phase_id),
      };
    }),
  };
}

/** Can this day be opened? Mirrors useRequestDay: locked/upcoming are closed,
 * a paid-unpurchased phase is closed, and an App Review account opens anything
 * (the server's mark_day_watched carries the same exemption). */
export function canOpenDay(day: TrainingDay, isReviewAccount: boolean): boolean {
  if (isReviewAccount) return true;
  if (day.phaseLocked) return false;
  return day.status !== "locked" && day.status !== "upcoming";
}

/** Can watching this day record completion? The app restricts it to today and
 * missed days — a finished day is already done, and nothing else is openable. */
export function canRecordWatch(day: TrainingDay): boolean {
  return day.status === "current" || day.status === "missed";
}

/** Mechanic 3. Idempotent; true only when this call is what marked it. */
export async function markDayWatched(userProgramId: string, programDayId: string): Promise<boolean> {
  const { data, error } = await supabase.rpc("mark_day_watched", {
    p_user_program_id: userProgramId,
    p_program_day_id: programDayId,
  });
  if (error) throw error;
  return data === true;
}

/** Mechanic 2. Swallows its own failure by design — see the header note. */
export async function logPain(userId: string, userProgramId: string, programDayId: string, score: number): Promise<void> {
  try {
    await supabase.from("pain_logs").insert({
      user_id: userId,
      user_program_id: userProgramId,
      program_day_id: programDayId,
      score,
    });
  } catch (error) {
    console.error("Unable to record the discomfort log; opening the day anyway", error);
  }
}

export async function fetchPainTrend(userId: string): Promise<{ score: number; loggedAt: string }[]> {
  const { data, error } = await supabase
    .from("pain_logs")
    .select("score, logged_at")
    .eq("user_id", userId)
    .order("logged_at", { ascending: false })
    .limit(7);
  if (error) throw error;
  return (data ?? []).map((r) => ({ score: r.score, loggedAt: r.logged_at })).reverse();
}

export async function fetchWaterToday(userId: string): Promise<number> {
  const { data, error } = await supabase
    .from("water_logs")
    .select("cups_logged")
    .eq("user_id", userId)
    .eq("log_date", localDateString())
    .maybeSingle();
  if (error) throw error;
  return data?.cups_logged ?? 0;
}

export async function setWaterToday(userId: string, cups: number): Promise<void> {
  const { error } = await supabase
    .from("water_logs")
    .upsert({ user_id: userId, log_date: localDateString(), cups_logged: cups }, { onConflict: "user_id,log_date" });
  if (error) throw error;
}

/** YouTube id out of any of the shapes an admin might paste. Ported from
 * TheraHOME-APP/app/day/[dayId].tsx so both clients accept the same input. */
export function youtubeVideoId(url: string): string {
  return (
    url.match(/youtu\.be\/([^?&/]+)/)?.[1] ??
    url.match(/[?&]v=([^?&/]+)/)?.[1] ??
    url.match(/youtube\.com\/embed\/([^?&/]+)/)?.[1] ??
    ""
  );
}
