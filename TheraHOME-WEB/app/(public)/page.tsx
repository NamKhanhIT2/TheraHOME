// Home — "Hero Section.dc.html".
//
// The hero art is the design's own two-layer treatment of one image: a blurred,
// over-scaled copy fills the frame so the edges never show, and a contained
// copy sits on top, feathered on all four sides by two crossed mask gradients.
// Note the three.js hero experiments in the same design project
// (hero-scene.js, hero-object3d.js, hero-anatomy.js) are NOT wired into this
// page — the shipped hero is this image pair.
import Link from "next/link";
import type { CSSProperties } from "react";
import { LandingButton } from "@/components/landing/LandingButton";
import { SafeImg } from "@/components/landing/SafeImg";
import { LandingFooter } from "@/components/landing/LandingFooter";

const HERO_BG = "/landing/hero-bg.png";

/** Feather all four edges of the contained hero image. Two gradients crossed
 * with mask-composite, exactly as the design specifies. */
const heroMask: CSSProperties = {
  WebkitMaskImage:
    "linear-gradient(90deg, transparent 0, #000 3.5%, #000 96.5%, transparent 100%), linear-gradient(180deg, transparent 0, #000 3.5%, #000 96.5%, transparent 100%)",
  WebkitMaskComposite: "source-in",
  maskImage:
    "linear-gradient(90deg, transparent 0, #000 3.5%, #000 96.5%, transparent 100%), linear-gradient(180deg, transparent 0, #000 3.5%, #000 96.5%, transparent 100%)",
  maskComposite: "intersect",
};

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

const HERO_LINES = ["Chăm cột sống", "theo lộ trình,", "không theo cảm tính."];

const HERO_STATS = [
  { value: "+10.000", label: "khách hàng Việt Nam" },
  { value: "4.8/5", label: "1.186 đánh giá" },
  { value: "14 ngày", label: "lộ trình cá nhân hoá" },
];

const PILLARS = [
  { href: "/san-pham", eyebrow: "Thiết bị", title: "TheraNECK+", body: "Bốn liệu pháp trong một thiết bị dùng tại nhà, mỗi buổi 15–20 phút.", cta: "Xem sản phẩm →" },
  { href: "/ung-dung", eyebrow: "Ứng dụng", title: "TheraAI", body: "Chấm vị trí đau, nhận lộ trình 14 ngày và theo dõi tiến trình mỗi ngày.", cta: "Tìm hiểu ứng dụng →" },
  { href: null, eyebrow: "Đồng hành", title: "Đội ngũ hỗ trợ", body: "Hỗ trợ qua app và Zalo trong suốt lộ trình, không chỉ lúc mới mua.", cta: null },
];

const RESULTS = [
  { stat: "93%", body: "Người dùng cho biết đã giảm đau cổ ngay từ buổi đầu tiên." },
  { stat: "91%", body: "Người dùng đã hoàn toàn hết đau cổ sau lộ trình 14 ngày do AI thiết lập, mỗi ngày chỉ 15–20 phút." },
  { stat: "88%", body: "Người dùng đã cải thiện được các triệu chứng đi kèm như tê tay, châm chích, đau đầu." },
  { stat: "79%", body: "Người dùng đã thoát khỏi vùng có nguy cơ phải phẫu thuật." },
];

const SERVICES = ["Hỗ trợ trọn đời", "Ship hàng nhanh chóng", "An toàn / Khoa học", "Thanh toán đảm bảo"];

function CheckIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#4FB0F5" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flex: "0 0 auto" }}>
      <path d="M5 12.5 10 17l9-10" />
    </svg>
  );
}

export default function HomePage() {
  return (
    <>
      {/* ------------------------------------------------------ brand hero */}
      <section style={{ position: "relative", overflow: "hidden", isolation: "isolate", boxSizing: "border-box", width: "100%", maxWidth: "100%", minHeight: "calc(100svh - var(--nav-h, 84px))", display: "flex", alignItems: "center", padding: "clamp(24px, 4vh, 56px) clamp(20px, 4vw, 64px)" }}>
        <SafeImg src={HERO_BG} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", objectPosition: "68% 50%", filter: "blur(38px) saturate(1.04)", transform: "scale(1.12)" }} />
        <SafeImg src={HERO_BG} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "contain", objectPosition: "50% 50%", ...heroMask }} />
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(100deg, rgba(2,3,11,0.93) 0%, rgba(2,3,11,0.84) 30%, rgba(2,3,11,0.5) 56%, rgba(2,3,11,0.1) 100%)" }} />
        <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse 55% 55% at 74% 45%, rgba(0,127,217,0.16), rgba(0,0,0,0) 70%)", pointerEvents: "none" }} />

        <div style={{ position: "relative", maxWidth: 1240, margin: "0 auto", width: "100%", display: "flex", flexWrap: "wrap", alignItems: "center", gap: "clamp(36px, 5vw, 80px)" }}>
          <div style={{ flex: "1 1 420px", maxWidth: "min(620px, 56%)", minWidth: 0, display: "flex", flexDirection: "column", gap: "clamp(20px, 2.2vh, 30px)" }}>
            <span style={{ fontSize: "clamp(12.5px, 1.05vw, 15px)", fontWeight: 600, letterSpacing: "0.13em", textTransform: "uppercase", color: "#8FCBFF", animation: "landingFade 1s cubic-bezier(0.16,1,0.3,1) .2s both" }}>
              Bộ giải pháp chủ động ngay tại nhà
            </span>

            <h1 style={{ margin: 0, fontSize: "clamp(32px, 3.9vw, 58px)", fontWeight: 600, lineHeight: 1.06, letterSpacing: "-0.034em", color: "#fff", maxWidth: "15ch", textWrap: "pretty" }}>
              {HERO_LINES.map((line, i) => (
                <span key={line} style={{ display: "block", overflow: "hidden", paddingBottom: "0.06em" }}>
                  <span style={{ display: "block", animation: `landingLine 1.1s cubic-bezier(0.16,1,0.3,1) ${0.35 + i * 0.13}s both` }}>{line}</span>
                </span>
              ))}
            </h1>

            <p style={{ margin: 0, maxWidth: 470, fontSize: "clamp(16px, 1.25vw, 18px)", lineHeight: 1.6, letterSpacing: "-0.006em", color: "rgba(255,255,255,0.7)", animation: "landingFade 1s cubic-bezier(0.16,1,0.3,1) .9s both" }}>
              TheraHome kết hợp thiết bị trị liệu, ứng dụng TheraAI và đội ngũ đồng hành, để việc phục hồi tại nhà có hướng đi rõ ràng thay vì làm theo cảm tính.
            </p>

            <div style={{ display: "flex", flexWrap: "wrap", gap: 16, animation: "landingFade 1s cubic-bezier(0.16,1,0.3,1) 1.1s both" }}>
              <LandingButton href="/san-pham">Xem sản phẩm</LandingButton>
              <LandingButton href="/ung-dung" variant="secondary">Ứng dụng TheraAI</LandingButton>
            </div>

            <div style={{ display: "flex", flexWrap: "wrap", gap: 32, paddingTop: 8, animation: "landingFade 1s cubic-bezier(0.16,1,0.3,1) 1.3s both" }}>
              {HERO_STATS.map((s) => (
                <div key={s.value} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <span style={{ fontSize: "clamp(22px, 1.9vw, 27px)", fontWeight: 600, letterSpacing: "-0.022em", color: "#fff" }}>{s.value}</span>
                  <span style={{ fontSize: 13, color: "rgba(255,255,255,0.68)" }}>{s.label}</span>
                </div>
              ))}
            </div>
          </div>
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
            <LandingButton href="/ung-dung">Kiểm tra bây giờ</LandingButton>
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
