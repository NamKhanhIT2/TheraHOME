// Home.
//
// The opening is "Home Cinematic.dc.html" — a scroll-driven camera journey
// through the TheraHOME house (src/components/landing/CinematicHero.tsx). It
// replaced the "Hero Section.dc.html" image hero on 2026-09-17 at the owner's
// request. The sections below it are still Hero Section's.
import Link from "next/link";
import type { CSSProperties } from "react";
import { LandingButton } from "@/components/landing/LandingButton";
import { CinematicHero } from "@/components/landing/CinematicHero";
import { getSiteContent } from "@/lib/siteContent";
import { LandingFooter } from "@/components/landing/LandingFooter";

const section: CSSProperties = {
  position: "relative",
  padding: "clamp(72px, 10vh, 130px) clamp(20px, 4vw, 64px)",
  borderTop: "1px solid rgba(255,255,255,0.06)",
};

const card: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 14,
  padding: "clamp(24px, 2.4vw, 32px)",
  borderRadius: "var(--radius-lg, 24px)",
  background: "rgba(255,255,255,0.035)",
  border: "1px solid rgba(255,255,255,0.07)",
};

const eyebrow: CSSProperties = {
  fontSize: 11,
  letterSpacing: "0.18em",
  textTransform: "uppercase",
  color: "var(--color-primary)",
};

const h2: CSSProperties = {
  margin: 0,
  fontSize: "clamp(26px, 2.8vw, 40px)",
  fontWeight: 600,
  lineHeight: 1.08,
  letterSpacing: "-0.015em",
  color: "#fff",
  textWrap: "pretty",
};

// HERO_STATS and RESULTS come from site_content — see src/lib/siteContent.ts.


const PILLARS = [
  { href: "/san-pham", eyebrow: "Thiết bị", title: "TheraNECK+", body: "Bốn liệu pháp trong một thiết bị dùng tại nhà, mỗi buổi 15–20 phút.", cta: "Xem sản phẩm →" },
  { href: "/app", eyebrow: "Ứng dụng", title: "TheraAI", body: "Chấm vị trí đau, nhận lộ trình 14 ngày và theo dõi tiến trình mỗi ngày.", cta: "Tìm hiểu ứng dụng →" },
  { href: null, eyebrow: "Đồng hành", title: "Đội ngũ hỗ trợ", body: "Hỗ trợ qua app và Zalo trong suốt lộ trình, không chỉ lúc mới mua.", cta: null },
];


const SERVICES = ["Hỗ trợ trọn đời", "Ship hàng nhanh chóng", "An toàn / Khoa học", "Thanh toán đảm bảo"];

function CheckIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#4FB0F5" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flex: "0 0 auto" }}>
      <path d="M5 12.5 10 17l9-10" />
    </svg>
  );
}

export default async function HomePage() {
  const { stats_hero: HERO_STATS, stats_results: RESULTS } = await getSiteContent();
  return (
    <>
      {/* ------------------------------------------- cinematic opening */}
      <CinematicHero />

      {/* The three headline numbers used to sit inside the hero. The cinematic
          opening has no room for them and the design drops them, but they are
          admin-edited (Nội dung website) and the owner's, so they keep a band
          of their own right after the journey. */}
      <section style={{ ...section, paddingTop: "clamp(40px, 6vh, 64px)", paddingBottom: "clamp(40px, 6vh, 64px)" }}>
        <div style={{ maxWidth: 1240, margin: "0 auto", display: "flex", flexWrap: "wrap", justifyContent: "center", gap: "clamp(32px, 6vw, 96px)" }}>
          {HERO_STATS.map((s) => (
            <div key={s.value} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, textAlign: "center" }}>
              <span style={{ fontSize: "clamp(26px, 2.4vw, 34px)", fontWeight: 600, letterSpacing: "-0.022em", color: "#fff" }}>{s.value}</span>
              <span style={{ fontSize: 13.5, color: "rgba(255,255,255,0.68)" }}>{s.label}</span>
            </div>
          ))}
        </div>
      </section>

      {/* ----------------------------------------------------- ba trụ cột */}
      <section style={section}>
        <div className="reveal-scope" style={{ maxWidth: 1240, margin: "0 auto", display: "flex", flexDirection: "column", gap: "clamp(36px, 5vh, 60px)" }}>
          <h2 style={{ ...h2, maxWidth: 620 }}>Ba phần của một lộ trình phục hồi</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: "clamp(20px, 2.4vw, 32px)" }}>
            {PILLARS.map((p) => {
              const inner = (
                <>
                  <span style={eyebrow}>{p.eyebrow}</span>
                  <h3 style={{ margin: 0, fontSize: 19, fontWeight: 600, color: "#fff" }}>{p.title}</h3>
                  <p style={{ margin: 0, fontSize: 14.5, lineHeight: 1.65, color: "rgba(255,255,255,0.62)" }}>{p.body}</p>
                  {p.cta ? <span style={{ fontSize: 13, color: "#7FBFFF" }}>{p.cta}</span> : null}
                </>
              );
              return p.href ? (
                <Link key={p.title} href={p.href} style={{ ...card, color: "#fff" }}>{inner}</Link>
              ) : (
                <div key={p.title} style={card}>{inner}</div>
              );
            })}
          </div>
        </div>
      </section>

      {/* --------------------------------------------------------- vấn đề */}
      <section style={section}>
        <div className="reveal-scope" style={{ maxWidth: 1240, margin: "0 auto", display: "flex", flexWrap: "wrap", alignItems: "flex-end", gap: "clamp(28px, 4vw, 64px)" }}>
          <div style={{ flex: "1 1 420px", minWidth: 0, display: "flex", flexDirection: "column", gap: 18 }}>
            <h2 style={{ ...h2, fontSize: "clamp(26px, 2.9vw, 42px)", maxWidth: 620 }}>Thoái hóa hay thoát vị thì không thể tự hết</h2>
            <p style={{ margin: 0, fontSize: 17, lineHeight: 1.6, color: "rgba(255,255,255,0.66)", maxWidth: 520 }}>
              Kiểm tra sớm để có lộ trình cải thiện ngay và tiết kiệm chi phí.
            </p>
          </div>
          <div style={{ display: "flex" }}>
            <LandingButton href="/app">Kiểm tra bây giờ</LandingButton>
          </div>
        </div>
      </section>

      {/* -------------------------------------------------------- kết quả */}
      <section style={section}>
        <div className="reveal-scope" style={{ maxWidth: 1240, margin: "0 auto", display: "flex", flexDirection: "column", gap: "clamp(36px, 5vh, 60px)" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: 640 }}>
            <h2 style={h2}>Kết quả từ trải nghiệm thực tế</h2>
            <p style={{ margin: 0, fontSize: 16, lineHeight: 1.65, color: "rgba(255,255,255,0.64)" }}>
              Được thử nghiệm trên gần 500 khách hàng đầu tiên khi đi đúng lộ trình thì tốc độ cải thiện X3 lần so với người làm theo cảm tính.
            </p>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "clamp(20px, 2.4vw, 32px)" }}>
            {RESULTS.map((r) => (
              <div key={r.stat} style={{ ...card, padding: 26 }}>
                <span style={{ fontSize: 40, fontWeight: 600, color: "#fff", letterSpacing: "-0.02em" }}>{r.stat}</span>
                <p style={{ margin: 0, fontSize: 14.5, lineHeight: 1.6, color: "rgba(255,255,255,0.62)" }}>{r.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* --------------------------------------------- đánh giá chuyên gia */}
      <section style={section}>
        <div className="reveal-scope" style={{ maxWidth: 880, margin: "0 auto", display: "flex", flexDirection: "column", gap: 28 }}>
          <blockquote style={{ margin: 0, fontSize: "clamp(17px, 1.4vw, 20px)", lineHeight: 1.72, color: "rgba(255,255,255,0.78)", fontStyle: "italic", textWrap: "pretty" }}>
            &ldquo;Tôi đã làm việc trong lĩnh vực chăm sóc cột sống suốt 18 năm, và tôi không dễ bị thuyết phục bởi các thiết bị trị liệu tại nhà. Nhưng TheraHome khiến tôi chú ý vì họ không chỉ tạo ra một chiếc máy — họ xây dựng một lộ trình rõ ràng thông qua ứng dụng TheraAI.&rdquo;
          </blockquote>
          <p style={{ margin: 0, fontSize: 14, lineHeight: 1.6, color: "rgba(255,255,255,0.62)", fontWeight: 600 }}>
            — Tiến sĩ Thomas William, Chuyên gia Trị liệu Cột sống và Chấn thương chỉnh hình.
          </p>
        </div>
      </section>

      {/* -------------------------------------------------------- dịch vụ */}
      <section style={section}>
        <div className="reveal-scope" style={{ maxWidth: 1240, margin: "0 auto", display: "flex", flexDirection: "column", gap: "clamp(32px, 4.5vh, 56px)" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: 560 }}>
            <h2 style={{ ...h2, fontSize: "clamp(26px, 2.6vw, 38px)" }}>Dịch vụ khách hàng của tôi có gì?</h2>
            <p style={{ margin: 0, fontSize: 16, lineHeight: 1.6, color: "rgba(255,255,255,0.62)" }}>
              Hãy trải nghiệm dịch vụ hậu mãi cao cấp của chúng tôi.
            </p>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "clamp(18px, 2vw, 28px)" }}>
            {SERVICES.map((s) => (
              <div key={s} style={{ display: "flex", alignItems: "center", gap: 14, padding: "20px 22px", borderRadius: "var(--radius-md, 16px)", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                <CheckIcon />
                <span style={{ fontSize: 14.5, fontWeight: 500, color: "rgba(255,255,255,0.86)" }}>{s}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <LandingFooter />
    </>
  );
}
