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

/** Mirrors TheraHOME-APP's src/lib/features.ts IAP_ENABLED. Both app flags are
 * false, so no phase is locked anywhere; flip this only alongside them. */
const PHASE_LOCK_ENABLED = true;

export type DayStatus = "done" | "current" | "missed" | "upcoming" | "locked";

export interface TrainingDay {
  programDayId: string;
  dayNumber: number;
  phaseId: string;
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
  /** 'VN' | 'US' | 'MALAY' from profiles.country — exposed so callers pick the
   * same market's copy as the day content, instead of re-deriving it. */
  market: string | null;
  productId: string;
  productName: string;
  activatedAt: string;
  /** Days the customer can actually reach: a paid, unpurchased phase's days
   * are excluded, the same rule the app's useAccessibleProgress applies. */
  totalDays: number;
  /** Real elapsed day, 1-based and UNCAPPED — what day statuses derive from,
   * matching the app. Capping it made the final day read "Hôm nay" forever. */
  todayDay: number;
  /** todayDay clamped to totalDays — the number shown as "Ngày N / X". */
  displayDay: number;
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
    // `revoked_at is null` matters as much here as in the app: a refunded or
    // revoked purchase must stop unlocking the phase.
    supabase.from("phase_purchases").select("phase_id").eq("user_id", userId).is("revoked_at", null),
  ]);
  const paidPhases = new Set(
    (promos ?? []).filter((p) => p.apple_product_id !== null || p.google_product_id !== null).map((p) => p.phase_id),
  );
  const purchasedPhases = new Set((purchases ?? []).map((p) => p.phase_id));
  // PHASE_LOCK_ENABLED is the web's half of the app's IAP_ENABLED kill switch.
  // Without it the two clients disagreed the moment a phase got a product id:
  // the app never locks anything while its flags are false, but the web locked
  // immediately — so the same customer would see a different day count, a
  // different percentage, and days present on the phone but missing here. Flip
  // this only together with the app's flags.
  const phaseIsLocked = (phaseId: string | null) =>
    PHASE_LOCK_ENABLED && !isReviewAccount && !!phaseId && paidPhases.has(phaseId) && !purchasedPhases.has(phaseId);

  const statusByDay = new Map((mine ?? []).map((r) => [r.program_day_id, r]));
  const phaseById = new Map((phases ?? []).map((p) => [p.id, pickMarket(market, p.name, p.name_en, p.name_ms)]));
  const painDays = new Set((pains ?? []).map((p) => p.program_day_id));

  const allDays = days ?? [];
  // Reachable days only — an unpurchased paid phase does not count toward
  // "Ngày N / X", exactly as useAccessibleProgress computes it.
  const reachable = allDays.filter((d) => !phaseIsLocked(d.phase_id));
  const totalDays = reachable.length || product?.total_days || allDays.length || 14;
  // UNCAPPED, like the app: day status is derived from the real elapsed day,
  // so once the programme is over the last day reads as finished/missed rather
  // than sitting on "Hôm nay" forever. The capped number is only for display.
  const todayDay = daysSinceLocal(program.activated_at) + 1;
  const displayDay = Math.min(todayDay, totalDays);

  return {
    userProgramId: program.id,
    market,
    productId: program.product_id,
    productName: product?.name ?? program.product_id,
    activatedAt: program.activated_at,
    totalDays,
    todayDay,
    displayDay,
    isReviewAccount,
    roadmapPublished: product?.roadmap_published !== false,
    days: allDays.map((d) => {
      const own = statusByDay.get(d.id);
      return {
        programDayId: d.id,
        dayNumber: d.day_number,
        phaseId: d.phase_id,
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
export function isRestDay(day: TrainingDay): boolean {
  return day.dayType === "rest";
}

export function canOpenDay(day: TrainingDay, isReviewAccount: boolean): boolean {
  // A rest day has no session to open — the app renders it as a non-tappable
  // "Ngày nghỉ" row. The web fetched day_type and then ignored it, so a rest
  // day looked and behaved like an ordinary workout.
  if (isRestDay(day)) return false;
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

// ---------------------------------------------------------------------------
// End-of-phase survey — ported from the app's useQuiz.ts / PhaseFooter.tsx.
//
// The web had no survey at all: a customer who trained here was never asked,
// one who answered on the phone saw no trace of it, and CSKH simply lost the
// response (audit 2026-09-16). Same tables, same upsert key, same gate as the
// app, so an answer given on either side shows on both.
// ---------------------------------------------------------------------------

export interface SurveyQuestion {
  id: string;
  question: string;
  options: string[];
}

export interface PhaseSurvey {
  phaseId: string;
  phaseName: string;
  /** The phase's last day — the survey opens when that day unlocks on the
   * calendar, exactly as roadmap.tsx gates PhaseFooter. */
  lastDayNumber: number;
  questions: SurveyQuestion[];
  answered: boolean;
}

interface QuizContentEntry {
  question?: string;
  options?: string[];
}

/** Every phase in this programme that HAS questions, with whether the customer
 * has already answered. Phases without questions are omitted, matching the app
 * (PhaseFooter renders nothing when the phase has no quiz). */
export async function fetchPhaseSurveys(userId: string, days: TrainingDay[], market: string | null): Promise<PhaseSurvey[]> {
  const phaseIds = Array.from(new Set(days.map((d) => d.phaseId)));
  if (phaseIds.length === 0) return [];

  const [{ data: questions, error: qErr }, { data: attempts, error: aErr }] = await Promise.all([
    supabase.from("quiz_questions").select("id, phase_id, sort_order, content").in("phase_id", phaseIds).order("sort_order"),
    supabase.from("user_quiz_attempts").select("phase_id").eq("user_id", userId).in("phase_id", phaseIds),
  ]);
  if (qErr) throw qErr;
  if (aErr) throw aErr;

  const answered = new Set((attempts ?? []).map((a) => a.phase_id));
  // Admin authors `content` as { vi: {...}, en: {...}, ms: {...} }. Fall back
  // the way usePhaseQuiz does: viewer's language, then Vietnamese, then any
  // language that has a question at all — skip the row only if none does.
  const language = market === "US" ? "en" : market === "MALAY" ? "ms" : "vi";
  const byPhase = new Map<string, SurveyQuestion[]>();
  for (const row of questions ?? []) {
    const content = (row.content ?? {}) as unknown as Record<string, QuizContentEntry | undefined>;
    const localized = content[language] ?? content.vi ?? Object.values(content).find((e) => e?.question);
    if (!localized?.question) continue;
    const list = byPhase.get(row.phase_id) ?? [];
    list.push({ id: row.id, question: localized.question, options: localized.options ?? [] });
    byPhase.set(row.phase_id, list);
  }

  return phaseIds
    .filter((id) => (byPhase.get(id) ?? []).length > 0)
    .map((id) => {
      const phaseDays = days.filter((d) => d.phaseId === id);
      return {
        phaseId: id,
        phaseName: phaseDays[0]?.phaseName ?? "",
        lastDayNumber: Math.max(...phaseDays.map((d) => d.dayNumber)),
        questions: byPhase.get(id) ?? [],
        answered: answered.has(id),
      };
    })
    .sort((a, b) => a.lastDayNumber - b.lastDayNumber);
}

/** Same upsert as useSubmitQuizAttempt, including the user_id+phase_id
 * conflict key, so answering again overwrites rather than duplicating, and an
 * answer given in the app is the same row. `score` stays 0: a survey has no
 * right answers, the column is legacy. */
export async function submitPhaseSurvey(
  userId: string,
  userProgramId: string,
  survey: PhaseSurvey,
  answers: Record<string, number>,
): Promise<void> {
  const snapshot: Record<string, { question: string; answer: string; optionIndex: number }> = {};
  for (const q of survey.questions) {
    const optionIndex = answers[q.id];
    if (optionIndex == null) continue;
    snapshot[q.id] = { question: q.question, answer: q.options[optionIndex] ?? "", optionIndex };
  }
  const { error } = await supabase.from("user_quiz_attempts").upsert(
    {
      user_id: userId,
      user_program_id: userProgramId,
      phase_id: survey.phaseId,
      score: 0,
      total_questions: survey.questions.length,
      answers: snapshot,
      completed_at: new Date().toISOString(),
    },
    { onConflict: "user_id,phase_id" },
  );
  if (error) throw error;
}

/** The admin-editable "Gợi ý từ TheraHOME" shown after submitting, resolved
 * with the same precedence the app now uses: the reader's own column, then the
 * bundled default, then the Vietnamese row. */
export async function fetchSurveySuggestion(market: string | null): Promise<{ title: string; body: string }> {
  const fallback = {
    title: "Gợi ý từ TheraHOME",
    body: "Cảm ơn bạn đã hoàn thành khảo sát! Hãy tiếp tục duy trì thói quen tập đều đặn mỗi ngày và lắng nghe cơ thể mình.",
  };
  const { data, error } = await supabase
    .from("app_config")
    .select("key, value_vi, value_en, value_ms")
    .in("key", ["survey_suggestion_title", "survey_suggestion_body"]);
  if (error) return fallback;
  const pick = (key: string, bundled: string) => {
    const row = (data ?? []).find((r) => r.key === key);
    if (!row) return bundled;
    const own = market === "US" ? row.value_en : market === "MALAY" ? row.value_ms : null;
    if (market === "VN") return row.value_vi?.trim() || bundled;
    return own?.trim() || bundled || row.value_vi?.trim() || "";
  };
  return {
    title: pick("survey_suggestion_title", fallback.title),
    body: pick("survey_suggestion_body", fallback.body),
  };
}
