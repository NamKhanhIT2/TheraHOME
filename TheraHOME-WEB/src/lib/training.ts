// Data for the customer training area (/luyen-tap) — the web half of what the
// mobile app shows. Same Supabase project, same rows: a day watched here is
// done on the phone and vice versa.
//
// THREE MECHANICS MUST MATCH THE APP EXACTLY. They are subtle and the backend
// docs described the superseded version until 2026-09-15, so they are spelled
// out here rather than left to be rediscovered:
//
//  1. Which day is open is NOT `user_programs.current_day`. It is derived on
//     the client from `activated_at` by LOCAL calendar day — one day unlocks
//     per local midnight. Mirrors daysSinceLocal/deriveDayStatus in
//     TheraHOME-APP/src/hooks/usePrograms.ts.
//  2. Opening a day that has no pain log yet is gated behind the pain scale;
//     confirming inserts that day's pain_logs row. A logging failure must
//     never block the workout.
//  3. There is no "complete" button. Watching the video completes the day via
//     the `mark_day_watched` RPC, which is idempotent and returns true only on
//     the newly-marked transition. `complete_day` still exists in the database
//     and is still granted, but nothing calls it — do not use it.
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
}

export interface TrainingProgram {
  userProgramId: string;
  productId: string;
  productName: string;
  activatedAt: string;
  totalDays: number;
  /** 1-based, capped at totalDays. */
  todayDay: number;
  days: TrainingDay[];
}

/** Local calendar date as YYYY-MM-DD. Never toISOString(), which is UTC and
 * would roll the day over at the wrong moment for anyone east or west of it. */
export function localDateString(d: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Whole local days between two dates, counting the activation day as day 1. */
export function daysSinceLocal(iso: string): number {
  const start = new Date(iso);
  const a = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  const now = new Date();
  const b = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.floor((b.getTime() - a.getTime()) / 86400000);
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
  const [{ data: programs, error: pErr }, { data: profile }] = await Promise.all([
    supabase
      .from("user_programs")
      .select("id, product_id, activated_at")
      .eq("user_id", userId)
      .order("activated_at", { ascending: true }),
    supabase.from("profiles").select("market").eq("id", userId).maybeSingle(),
  ]);
  if (pErr) throw pErr;
  const program = programs?.[0];
  if (!program) return null;

  const market = (profile as { market?: string } | null)?.market ?? null;

  const [{ data: product }, { data: days, error: dErr }, { data: mine }, { data: phases }, { data: pains }] =
    await Promise.all([
      supabase.from("products").select("name, total_days").eq("id", program.product_id).maybeSingle(),
      supabase
        .from("program_days")
        .select("id, day_number, day_type, phase_id, video_url_vn, video_url_us, video_url_malay, support_tools_url_vn, support_tools_url_us, support_tools_url_malay, support_tools_label_vn, support_tools_label_us, support_tools_label_malay")
        .eq("product_id", program.product_id)
        .order("day_number"),
      supabase.from("user_program_days").select("program_day_id, status, completed_at").eq("user_program_id", program.id),
      supabase.from("program_phases").select("id, name, name_en, name_ms").eq("product_id", program.product_id),
      supabase.from("pain_logs").select("program_day_id").eq("user_id", userId),
    ]);
  if (dErr) throw dErr;

  const statusByDay = new Map((mine ?? []).map((r) => [r.program_day_id, r]));
  const phaseById = new Map((phases ?? []).map((p) => [p.id, pickMarket(market, p.name, p.name_en, p.name_ms)]));
  const painDays = new Set((pains ?? []).map((p) => p.program_day_id));

  const totalDays = product?.total_days ?? (days?.length || 14);
  const todayDay = Math.min(Math.max(daysSinceLocal(program.activated_at) + 1, 1), totalDays);

  return {
    userProgramId: program.id,
    productId: program.product_id,
    productName: product?.name ?? program.product_id,
    activatedAt: program.activated_at,
    totalDays,
    todayDay,
    days: (days ?? []).map((d) => {
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
      };
    }),
  };
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
