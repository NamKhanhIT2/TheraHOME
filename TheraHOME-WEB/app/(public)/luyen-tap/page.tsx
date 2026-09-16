"use client";

// Luyện tập — the customer's training area, port of "Dashboard.dc.html".
//
// This reads and writes the SAME rows the mobile app does, so progress is one
// shared thing rather than two copies: a day watched here is done on the phone
// the next time it refetches. The three mechanics that have to match are
// documented at the top of src/lib/training.ts.
//
// Four tabs, matching the design's own tab bar: Lộ trình (its Trang chủ and
// Lộ trình tabs merged, since on a wide screen the summary and the day grid
// fit together), Cửa hàng and Cộng đồng.
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import type { CSSProperties } from "react";
import { supabase } from "@/lib/supabase";
import { LandingButton } from "@/components/landing/LandingButton";
import { LandingFooter } from "@/components/landing/LandingFooter";
import { StoreTab } from "@/components/landing/StoreTab";
import { CommunityTab } from "@/components/landing/CommunityTab";
import { ActivationPanel } from "@/components/landing/ActivationPanel";
import { YouTubeLesson } from "@/components/landing/YouTubeLesson";
import {
  canOpenDay,
  canRecordWatch,
  fetchPainTrend,
  fetchTrainingProgram,
  fetchWaterToday,
  logPain,
  markDayWatched,
  setWaterToday,
  youtubeVideoId,
  type TrainingDay,
  type TrainingProgram,
} from "@/lib/training";

const WATER_GOAL = 8;

const shell: CSSProperties = { maxWidth: 1240, margin: "0 auto", padding: "clamp(28px, 5vh, 56px) clamp(20px, 4vw, 64px)" };
const card: CSSProperties = { display: "flex", flexDirection: "column", gap: 14, padding: "clamp(20px, 2.2vw, 28px)", borderRadius: "var(--radius-lg, 24px)", background: "rgba(255,255,255,0.035)", border: "1px solid rgba(255,255,255,0.07)" };
const eyebrow: CSSProperties = { fontSize: 11, letterSpacing: "0.2em", textTransform: "uppercase", color: "var(--color-primary)" };

const STATUS_STYLE: Record<string, { bg: string; border: string; color: string; label: string }> = {
  done: { bg: "rgba(52,199,89,0.16)", border: "rgba(52,199,89,0.45)", color: "#7BE39B", label: "Đã xong" },
  current: { bg: "rgba(0,127,217,0.2)", border: "rgba(0,127,217,0.6)", color: "#8FCBFF", label: "Hôm nay" },
  missed: { bg: "rgba(255,182,72,0.14)", border: "rgba(255,182,72,0.4)", color: "#FFC978", label: "Bỏ lỡ" },
  upcoming: { bg: "rgba(255,255,255,0.04)", border: "rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.6)", label: "Sắp tới" },
  locked: { bg: "rgba(255,255,255,0.03)", border: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.38)", label: "Chưa mở" },
  // A paid phase the customer has not unlocked. Inert today — no phase carries
  // a store product id yet — but it must not leak when Giai đoạn 3 ships, and
  // the web has no way to sell it, so it points at the app.
  phaseLocked: { bg: "rgba(255,182,72,0.1)", border: "rgba(255,182,72,0.32)", color: "#FFC978", label: "Cần mở khoá" },
};

type TabId = "lo-trinh" | "cua-hang" | "cong-dong";

const TABS: { id: TabId; label: string }[] = [
  { id: "lo-trinh", label: "Lộ trình" },
  { id: "cua-hang", label: "Cửa hàng" },
  { id: "cong-dong", label: "Cộng đồng" },
];

function TabBar({ active, onChange }: { active: TabId; onChange: (id: TabId) => void }) {
  return (
    <div role="tablist" style={{ display: "flex", gap: 8, padding: 6, borderRadius: 999, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", alignSelf: "flex-start", maxWidth: "100%", overflowX: "auto" }}>
      {TABS.map((t) => {
        const on = active === t.id;
        return (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={on}
            onClick={() => onChange(t.id)}
            style={{ flex: "0 0 auto", padding: "10px 22px", borderRadius: 999, border: "none", fontFamily: "inherit", fontSize: 14.5, fontWeight: 600, cursor: "pointer", color: on ? "#fff" : "rgba(255,255,255,0.66)", background: on ? "var(--color-primary)" : "transparent" }}
          >
            {t.label}
          </button>
        );
      })}
    </div>
  );
}

function Spinner({ label }: { label: string }) {
  return <div style={{ ...shell, color: "rgba(255,255,255,0.6)" }}>{label}</div>;
}

/** Mechanic 2 — the pain scale that gates opening a day. */
function PainScaleModal({ dayNumber, busy, onConfirm, onCancel }: { dayNumber: number; busy: boolean; onConfirm: (score: number) => void; onCancel: () => void }) {
  const [score, setScore] = useState(3);
  return (
    <div role="dialog" aria-modal="true" style={{ position: "fixed", inset: 0, zIndex: 60, display: "flex", alignItems: "center", justifyContent: "center", padding: 20, background: "rgba(2,3,11,0.72)", backdropFilter: "blur(8px)" }}>
      <div style={{ width: "100%", maxWidth: 420, display: "flex", flexDirection: "column", gap: 18, padding: 26, borderRadius: 24, background: "rgba(8,14,26,0.98)", border: "1px solid rgba(255,255,255,0.12)", boxShadow: "0 30px 70px rgba(0,20,60,0.55)" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <span style={eyebrow}>Ngày {dayNumber}</span>
          <h2 style={{ margin: 0, fontSize: 21, fontWeight: 600, color: "#fff" }}>Hôm nay bạn khó chịu ở mức nào?</h2>
          <p style={{ margin: 0, fontSize: 14, lineHeight: 1.6, color: "rgba(255,255,255,0.62)" }}>
            0 là hoàn toàn dễ chịu, 10 là đau nhất bạn từng thấy. Ghi lại trước mỗi buổi để theo dõi tiến triển.
          </p>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {Array.from({ length: 11 }, (_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setScore(i)}
              aria-pressed={score === i}
              style={{ width: 38, height: 38, borderRadius: 12, cursor: "pointer", fontFamily: "inherit", fontSize: 14, fontWeight: 600, color: score === i ? "#fff" : "rgba(255,255,255,0.7)", background: score === i ? "var(--color-primary)" : "rgba(255,255,255,0.06)", border: `1px solid ${score === i ? "var(--color-primary)" : "rgba(255,255,255,0.12)"}` }}
            >
              {i}
            </button>
          ))}
        </div>
        <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
          <button type="button" onClick={onCancel} disabled={busy} style={{ padding: "12px 18px", borderRadius: 12, border: "1px solid rgba(255,255,255,0.16)", background: "transparent", color: "rgba(255,255,255,0.8)", fontFamily: "inherit", fontSize: 14, cursor: "pointer" }}>
            Để sau
          </button>
          <LandingButton onClick={() => onConfirm(score)} disabled={busy} style={{ height: 44 }}>
            {busy ? "Đang mở..." : "Bắt đầu buổi tập"}
          </LandingButton>
        </div>
      </div>
    </div>
  );
}

function DayDetail({ program, day, onWatched, onBack }: { program: TrainingProgram; day: TrainingDay; onWatched: () => void; onBack: () => void }) {
  const [recorded, setRecorded] = useState(day.status === "done");
  const [recordError, setRecordError] = useState("");
  const raw = day.videoUrl ? (day.videoUrl.startsWith("http") ? day.videoUrl : `https://${day.videoUrl}`) : "";
  const videoId = raw ? youtubeVideoId(raw) : "";
  // The app only records for today's day or a missed one; a finished day is
  // already done and nothing else is openable.
  const recordable = canRecordWatch(day);

  const record = useCallback(async () => {
    if (recorded || !recordable) return;
    try {
      await markDayWatched(program.userProgramId, day.programDayId);
      setRecorded(true);
      setRecordError("");
      onWatched();
    } catch (error) {
      console.error("Unable to record this day as watched", error);
      // The app alerts here rather than failing silently — a customer who
      // watched the video needs to know it was not counted.
      setRecordError("Không ghi nhận được buổi tập. Vui lòng thử lại.");
    }
  }, [recorded, recordable, program.userProgramId, day.programDayId, onWatched]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <button type="button" onClick={onBack} style={{ alignSelf: "flex-start", display: "inline-flex", alignItems: "center", gap: 8, padding: 0, background: "transparent", border: "none", color: "rgba(255,255,255,0.66)", fontFamily: "inherit", fontSize: 14, cursor: "pointer" }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M15 6l-6 6 6 6" /></svg>
        Lộ trình
      </button>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <span style={eyebrow}>{day.phaseName ?? `Ngày ${day.dayNumber}`}</span>
        <h1 style={{ margin: 0, fontSize: "clamp(24px, 3vw, 36px)", fontWeight: 600, letterSpacing: "-0.02em", color: "#fff" }}>
          Ngày {day.dayNumber} / {program.totalDays}
        </h1>
      </div>

      {videoId ? (
        <>
          <YouTubeLesson videoId={videoId} title={`Ngày ${day.dayNumber}`} onPlay={() => void record()} />
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 14 }}>
            <a href={raw} target="_blank" rel="noreferrer" onClick={() => void record()} style={{ padding: "12px 20px", borderRadius: 999, border: "1px solid rgba(255,255,255,0.16)", fontSize: 14, color: "rgba(255,255,255,0.86)" }}>
              Xem trên YouTube
            </a>
            <span style={{ fontSize: 13, color: "rgba(255,255,255,0.58)" }}>
              Mẹo: chiếu lên TV để buổi tập thoải mái hơn.
            </span>
          </div>
        </>
      ) : (
        <div style={{ ...card, alignItems: "flex-start" }}>
          <p style={{ margin: 0, fontSize: 15, color: "rgba(255,255,255,0.7)" }}>Ngày này chưa có video. Admin sẽ cập nhật trong tab Lộ trình.</p>
        </div>
      )}

      <div style={{ ...card, background: recorded ? "rgba(52,199,89,0.1)" : "rgba(255,255,255,0.035)", border: `1px solid ${recorded ? "rgba(52,199,89,0.35)" : "rgba(255,255,255,0.07)"}` }}>
        <span style={{ fontSize: 15, fontWeight: 600, color: recorded ? "#7BE39B" : "#fff" }}>
          {recorded ? `Ngày ${day.dayNumber} đã được ghi nhận hoàn thành.` : "Xem video để hoàn thành"}
        </span>
        {!recorded ? (
          <p style={{ margin: 0, fontSize: 14, lineHeight: 1.6, color: "rgba(255,255,255,0.62)" }}>
            Bật video ở trên hoặc bấm &ldquo;Xem trên YouTube&rdquo; — ngày này sẽ tự động được ghi nhận hoàn thành.
          </p>
        ) : null}
        {recordError ? <span style={{ fontSize: 13, color: "var(--error)" }}>{recordError}</span> : null}
      </div>

      {day.supportToolsUrl ? (
        <a href={day.supportToolsUrl} target="_blank" rel="noreferrer" style={{ ...card, color: "#7FBFFF", fontSize: 14 }}>
          {day.supportToolsLabel || "Dụng cụ hỗ trợ buổi tập"} →
        </a>
      ) : null}
    </div>
  );
}

export default function TrainingPage() {
  const [userId, setUserId] = useState<string | null | undefined>(undefined);
  // undefined = not fetched yet, null = fetched and this account has no program
  const [program, setProgram] = useState<TrainingProgram | null | undefined>(undefined);
  const [pain, setPain] = useState<{ score: number; loggedAt: string }[]>([]);
  const [water, setWater] = useState(0);
  const [openDay, setOpenDay] = useState<TrainingDay | null>(null);
  const [gateDay, setGateDay] = useState<TrainingDay | null>(null);
  const [gateBusy, setGateBusy] = useState(false);
  const [tab, setTab] = useState<TabId>("lo-trinh");
  const [me, setMe] = useState<{ name: string; market: string | null }>({ name: "", market: null });

  /** Bumped to refetch — after a day is watched, or a pain log is written. */
  const [refreshKey, setRefreshKey] = useState(0);
  const refresh = useCallback(() => setRefreshKey((k) => k + 1), []);

  useEffect(() => {
    void (async () => {
      const { data } = await supabase.auth.getSession();
      const session = data.session;
      setUserId(session?.user.id ?? null);
      if (!session) return;
      // Name for the composer avatar, market for which store catalog to show.
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name, market")
        .eq("id", session.user.id)
        .maybeSingle();
      setMe({ name: profile?.full_name || session.user.email || "", market: profile?.market ?? null });
    })();
  }, []);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    // The async IIFE matters twice over: every setState lands after an await
    // (so nothing is set synchronously from the effect body), and `cancelled`
    // drops a response that arrives after the account changed, which would
    // otherwise show one customer's programme to the next.
    void (async () => {
      const [p, tr, w] = await Promise.all([
        fetchTrainingProgram(userId).catch((error) => {
          console.error("Unable to load the training programme", error);
          return null;
        }),
        fetchPainTrend(userId).catch(() => []),
        fetchWaterToday(userId).catch(() => 0),
      ]);
      if (cancelled) return;
      setProgram(p);
      setPain(tr);
      setWater(w);
    })();
    return () => {
      cancelled = true;
    };
  }, [userId, refreshKey]);

  // Derived, not stored: a `loading` state would have to be cleared from inside
  // the effect, which is the cascading-render pattern react-hooks rejects.
  const loading = userId === undefined || (userId !== null && program === undefined);

  /** Mechanic 2: an openable day with no pain log shows the scale first.
   * Openability itself is canOpenDay — which carries the App Review bypass and
   * the paid-phase lock, both of which the app applies here too. */
  function requestDay(day: TrainingDay) {
    if (!program || !canOpenDay(day, program.isReviewAccount)) return;
    if (!day.hasPainLog) {
      setGateDay(day);
      return;
    }
    setOpenDay(day);
  }

  async function confirmPain(score: number) {
    // `gateBusy` reaches the modal's button as a disabled prop, which cannot
    // stop a second tap dispatched before the re-render commits — in the app
    // that wrote two pain_logs rows for one day, so guard here as well.
    if (!gateDay || !userId || !program || gateBusy) return;
    setGateBusy(true);
    // A logging failure must never block the workout, so this resolves either way.
    await logPain(userId, program.userProgramId, gateDay.programDayId, score);
    setGateBusy(false);
    setOpenDay(gateDay);
    setGateDay(null);
    refresh();
  }

  async function changeWater(next: number) {
    if (!userId) return;
    const clamped = Math.max(0, Math.min(WATER_GOAL * 2, next));
    setWater(clamped);
    try {
      await setWaterToday(userId, clamped);
    } catch (error) {
      console.error("Unable to save the water log", error);
    }
  }

  if (loading) return <Spinner label="Đang tải lộ trình..." />;

  // A day open for training takes over the whole surface — the tab bar would
  // only offer ways to lose your place mid-session.
  if (tab === "lo-trinh" && openDay && program) {
    return (
      <>
        <div style={shell}>
          <DayDetail program={program} day={openDay} onBack={() => setOpenDay(null)} onWatched={refresh} />
        </div>
        <LandingFooter compact />
      </>
    );
  }

  const doneCount = program ? program.days.filter((d) => d.status === "done").length : 0;
  const pct = program ? Math.round((doneCount / Math.max(1, program.totalDays)) * 100) : 0;
  const today = program?.days.find((d) => d.dayNumber === program.todayDay);

  return (
    <>
      <div style={{ ...shell, display: "flex", flexDirection: "column", gap: "clamp(20px, 3vh, 32px)" }}>
        <TabBar active={tab} onChange={setTab} />

        {/* The store catalog is world-readable, so it renders signed out too. */}
        {tab === "cua-hang" ? <StoreTab market={me.market} /> : null}

        {tab === "cong-dong" ? <CommunityTab userId={userId} userName={me.name} /> : null}

        {tab === "lo-trinh" && userId === null ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 18, minHeight: "38vh", justifyContent: "center" }}>
            <span style={eyebrow}>Luyện tập</span>
            <h1 style={{ margin: 0, fontSize: "clamp(28px, 3.4vw, 44px)", fontWeight: 600, letterSpacing: "-0.02em", color: "#fff" }}>
              Đăng nhập để xem lộ trình của bạn
            </h1>
            <p style={{ margin: 0, maxWidth: 520, fontSize: 16.5, lineHeight: 1.65, color: "rgba(255,255,255,0.66)" }}>
              Dùng chung tài khoản với ứng dụng trên điện thoại — tiến độ hai bên là một.
            </p>
            <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
              <LandingButton href="/dang-nhap">Đăng nhập</LandingButton>
            </div>
          </div>
        ) : null}

        {/* No programme yet — the same activation screen the app shows, not a
            dead end pointing at the app. `refresh` refetches, so a successful
            claim lands straight on the roadmap. */}
        {tab === "lo-trinh" && userId !== null && !program ? (
          <>
            <ActivationPanel market={me.market} onActivated={refresh} />
            <div style={{ display: "flex", gap: 14, flexWrap: "wrap", justifyContent: "center", marginTop: 6 }}>
              <LandingButton href="/san-pham" variant="secondary">Chưa có thiết bị? Xem sản phẩm</LandingButton>
            </div>
          </>
        ) : null}

        {tab === "lo-trinh" && program ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "clamp(24px, 4vh, 40px)" }}>
            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-end", justifyContent: "space-between", gap: 20 }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <span style={eyebrow}>{program.productName}</span>
                <h1 style={{ margin: 0, fontSize: "clamp(28px, 3.4vw, 44px)", fontWeight: 600, letterSpacing: "-0.02em", color: "#fff" }}>
                  Ngày {program.todayDay} / {program.totalDays}
                </h1>
                <span style={{ fontSize: 14, color: "rgba(255,255,255,0.62)" }}>{today?.phaseName ?? ""}</span>
              </div>
              {today && canOpenDay(today, program.isReviewAccount) && today.status !== "done" ? (
                <LandingButton onClick={() => requestDay(today)}>Bắt đầu hôm nay</LandingButton>
              ) : null}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "clamp(16px, 2vw, 24px)" }}>
              <div style={card}>
                <span style={{ fontSize: 12, letterSpacing: "0.14em", textTransform: "uppercase", color: "rgba(255,255,255,0.5)" }}>Tiến độ</span>
                <span style={{ fontSize: 40, fontWeight: 600, color: "#fff", letterSpacing: "-0.02em" }}>{pct}%</span>
                <div aria-hidden="true" style={{ height: 8, borderRadius: 999, background: "rgba(255,255,255,0.08)", overflow: "hidden" }}>
                  <div style={{ width: `${pct}%`, height: "100%", borderRadius: 999, background: "var(--color-primary)", transition: "width 400ms cubic-bezier(0.16,1,0.3,1)" }} />
                </div>
                <span style={{ fontSize: 13, color: "rgba(255,255,255,0.6)" }}>{doneCount} / {program.totalDays} buổi đã hoàn thành</span>
              </div>

              <div style={card}>
                <span style={{ fontSize: 12, letterSpacing: "0.14em", textTransform: "uppercase", color: "rgba(255,255,255,0.5)" }}>Mức khó chịu gần đây</span>
                {pain.length ? (
                  <>
                    <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: 76 }}>
                      {pain.map((pt, i) => (
                        <div key={i} title={`${pt.score}/10`} style={{ flex: 1, height: `${Math.max(6, (pt.score / 10) * 100)}%`, borderRadius: 6, background: "linear-gradient(180deg, #4FB0F5, rgba(0,127,217,0.35))" }} />
                      ))}
                    </div>
                    <span style={{ fontSize: 13, color: "rgba(255,255,255,0.6)" }}>{pain.length} lần ghi gần nhất</span>
                  </>
                ) : (
                  <p style={{ margin: 0, fontSize: 14, lineHeight: 1.6, color: "rgba(255,255,255,0.6)" }}>
                    Ghi lại mức khó chịu sau mỗi buổi để thấy tiến triển ở đây.
                  </p>
                )}
              </div>

              <div style={card}>
                <span style={{ fontSize: 12, letterSpacing: "0.14em", textTransform: "uppercase", color: "rgba(255,255,255,0.5)" }}>Nước hôm nay</span>
                <span style={{ fontSize: 40, fontWeight: 600, color: "#fff", letterSpacing: "-0.02em" }}>
                  {water}
                  <span style={{ fontSize: 16, fontWeight: 400, color: "rgba(255,255,255,0.55)" }}> / {WATER_GOAL} cốc</span>
                </span>
                <div style={{ display: "flex", gap: 10 }}>
                  <button type="button" onClick={() => void changeWater(water - 1)} aria-label="Bớt một cốc" style={{ width: 40, height: 40, borderRadius: 12, cursor: "pointer", border: "1px solid rgba(255,255,255,0.14)", background: "transparent", color: "#fff", fontSize: 18, fontFamily: "inherit" }}>−</button>
                  <button type="button" onClick={() => void changeWater(water + 1)} aria-label="Thêm một cốc" style={{ width: 40, height: 40, borderRadius: 12, cursor: "pointer", border: "1px solid rgba(0,127,217,0.5)", background: "rgba(0,127,217,0.18)", color: "#fff", fontSize: 18, fontFamily: "inherit" }}>+</button>
                </div>
              </div>
            </div>

            {!program.roadmapPublished ? (
              <div style={{ ...card, borderColor: "rgba(255,182,72,0.32)", background: "rgba(255,182,72,0.1)" }}>
                <span style={{ fontSize: 15, fontWeight: 600, color: "#FFC978" }}>Lộ trình đang hoàn thiện</span>
                <p style={{ margin: 0, fontSize: 14, lineHeight: 1.6, color: "rgba(255,255,255,0.7)" }}>
                  Các buổi tập sẽ mở khi đội ngũ xuất bản lộ trình cho sản phẩm này.
                </p>
              </div>
            ) : null}

            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <h2 style={{ margin: 0, fontSize: "clamp(20px, 2.2vw, 28px)", fontWeight: 600, color: "#fff", letterSpacing: "-0.015em" }}>Lộ trình</h2>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 12 }}>
                {program.days.map((d) => {
                  const st = d.phaseLocked ? STATUS_STYLE.phaseLocked : STATUS_STYLE[d.status];
                  const openable = canOpenDay(d, program.isReviewAccount);
                  return (
                    <button
                      key={d.programDayId}
                      type="button"
                      onClick={() => requestDay(d)}
                      disabled={!openable}
                      style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 8, padding: "16px 18px", borderRadius: 18, textAlign: "left", fontFamily: "inherit", cursor: openable ? "pointer" : "default", background: st.bg, border: `1px solid ${st.border}`, color: "#fff" }}
                    >
                      <span style={{ fontSize: 13, color: "rgba(255,255,255,0.6)" }}>Ngày {d.dayNumber}</span>
                      <span style={{ fontSize: 13.5, fontWeight: 600, color: st.color }}>{st.label}</span>
                    </button>
                  );
                })}
              </div>
              <p style={{ margin: 0, fontSize: 13, color: "rgba(255,255,255,0.5)" }}>
                Mỗi ngày mở thêm một buổi. Tiến độ dùng chung với ứng dụng trên điện thoại.
              </p>
              {program.days.some((d) => d.phaseLocked) ? (
                <p style={{ margin: 0, fontSize: 13, color: "#FFC978" }}>
                  Có giai đoạn cần mở khoá. Việc mua chỉ thực hiện trong ứng dụng trên điện thoại.
                </p>
              ) : null}
            </div>

            <div style={{ display: "flex", flexWrap: "wrap", gap: 14 }}>
              <Link href="/ung-dung" style={{ fontSize: 14, color: "#7FBFFF" }}>Tải ứng dụng để tập trên điện thoại →</Link>
            </div>
          </div>
        ) : null}
      </div>

      {gateDay ? (
        <PainScaleModal dayNumber={gateDay.dayNumber} busy={gateBusy} onConfirm={(s) => void confirmPain(s)} onCancel={() => setGateDay(null)} />
      ) : null}

      <LandingFooter compact />
    </>
  );
}
