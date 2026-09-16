// Ứng dụng TheraAI — port of "App.dc.html".
//
// The phone art is the real Play Store captures (play-assets/phone/), trimmed
// of the Android status and gesture bars. The design's measured crop offsets
// were calibrated to its own screenshots and are dropped in favour of
// object-fit — see AppCarousel.
import type { CSSProperties } from "react";
import { LandingButton } from "@/components/landing/LandingButton";
import { getSiteContent } from "@/lib/siteContent";
import { LandingFooter } from "@/components/landing/LandingFooter";
import { AppCarousel, type CarouselCard } from "@/components/landing/AppCarousel";
import { SafeImg } from "@/components/landing/SafeImg";

export const metadata = {
  title: "Ứng dụng TheraAI · TheraHome",
  description: "Hiểu rõ tình trạng hiện tại, theo dõi cơn đau mỗi ngày và đi theo một lộ trình phù hợp hơn với chính cơ thể mình.",
};

const S = (n: string) => `/landing/app/${n}.jpg`;

// The seven finished App Store panels. The design's ring holds eight cards,
// so one repeats.
const CARDS: CarouselCard[] = [
  { src: S("home"), alt: "Màn hình chính" },
  { src: S("roadmap"), alt: "Lộ trình 14 ngày" },
  { src: S("video"), alt: "Buổi tập có video hướng dẫn" },
  { src: S("community"), alt: "Cộng đồng TheraHome" },
  { src: S("ai-chat"), alt: "Trợ lý TheraAI" },
  { src: S("support"), alt: "Hỗ trợ từ đội ngũ TheraHome" },
  { src: S("video-alt"), alt: "Buổi tập theo video" },
  { src: S("home"), alt: "" },
];

const eyebrow: CSSProperties = { fontSize: 11, letterSpacing: "0.2em", textTransform: "uppercase", color: "var(--color-primary)" };
const sectionPad: CSSProperties = { position: "relative", padding: "clamp(72px, 10vh, 130px) clamp(20px, 4vw, 64px)", borderTop: "1px solid rgba(255,255,255,0.06)" };
const featureH2: CSSProperties = { margin: 0, fontSize: "clamp(26px, 2.8vw, 40px)", fontWeight: 600, lineHeight: 1.08, letterSpacing: "-0.015em", color: "#fff", textWrap: "pretty" };
const featureP: CSSProperties = { margin: 0, maxWidth: 520, fontSize: 16.5, lineHeight: 1.7, color: "rgba(255,255,255,0.66)" };
const chip: CSSProperties = { fontSize: 13, padding: "8px 14px", borderRadius: 999, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.78)" };

/** A floating App Store panel. `float` picks which of the two drift keyframes.
 * These carry their own device mockup, so unlike the design's phone frame there
 * is no bezel here — just the panel, its shadow and the drift. */
function AppPanel({ src, alt, max = 330, float = "a", seconds = 13 }: {
  src: string; alt: string; max?: number; float?: "a" | "b"; seconds?: number;
}) {
  return (
    <div style={{ position: "relative", width: "100%", maxWidth: max, aspectRatio: "0.462", borderRadius: 22, overflow: "hidden", boxShadow: "0 45px 100px rgba(0,60,140,0.45)", animation: `${float === "a" ? "landingAppFloat" : "landingAppFloatAlt"} ${seconds}s ease-in-out infinite` }}>
      <SafeImg src={src} style={{ position: "absolute", inset: 0, display: "block", width: "100%", height: "100%", objectFit: "contain" }} />
      <span style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clipPath: "inset(50%)" }}>{alt}</span>
    </div>
  );
}

/** One feature row. `flip` puts the art on the right instead of the left. */
function Feature({ flip = false, art, eyebrowText, title, body, chips }: {
  flip?: boolean; art: React.ReactNode; eyebrowText: string; title: string; body: string; chips?: string[];
}) {
  const copy = (
    <div style={{ flex: "1 1 360px", minWidth: 0, display: "flex", flexDirection: "column", gap: 16 }}>
      <span style={eyebrow}>{eyebrowText}</span>
      <h2 style={featureH2}>{title}</h2>
      <p style={featureP}>{body}</p>
      {chips?.length ? (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, paddingTop: 6 }}>
          {chips.map((c) => <span key={c} style={chip}>{c}</span>)}
        </div>
      ) : null}
    </div>
  );
  const artBox = (
    <div style={{ flex: "0 1 340px", minWidth: "min(320px, 100%)", display: "flex", justifyContent: "center" }}>{art}</div>
  );
  return (
    <div style={{ display: "flex", flexWrap: flip ? "wrap-reverse" : "wrap", alignItems: "center", gap: "clamp(32px, 5vw, 72px)" }}>
      {flip ? copy : artBox}
      {flip ? artBox : copy}
    </div>
  );
}

export default async function AppPage() {
  const { app_links } = await getSiteContent();
  return (
    <>
      {/* -------------------------------------------------------- carousel */}
      <section style={{ position: "relative", padding: "clamp(28px, 4vh, 48px) 0 clamp(40px, 6vh, 72px)", overflow: "hidden" }}>
        <div className="reveal-scope" style={{ maxWidth: 1240, margin: "0 auto", padding: "0 clamp(20px, 4vw, 64px) clamp(24px, 4vh, 44px)", display: "flex", flexDirection: "column", gap: 12 }}>
          <span style={eyebrow}>Ứng dụng TheraAI</span>
          <h1 style={{ margin: 0, maxWidth: 600, fontSize: "clamp(28px, 3vw, 44px)", fontWeight: 600, lineHeight: 1.06, letterSpacing: "-0.02em", color: "#fff", textWrap: "pretty" }}>
            Toàn bộ lộ trình gọn trong một ứng dụng
          </h1>
          <p style={{ margin: 0, maxWidth: 520, fontSize: 16, lineHeight: 1.65, color: "rgba(255,255,255,0.64)" }}>
            Đưa chuột vào để dừng và xem từng màn hình.
          </p>
        </div>
        <AppCarousel cards={CARDS} />
      </section>

      {/* -------------------------------------------------------- app hero */}
      <section style={{ position: "relative", overflow: "hidden", padding: "clamp(64px, 10vh, 120px) clamp(20px, 4vw, 64px) clamp(40px, 6vh, 80px)" }}>
        <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse 55% 50% at 72% 40%, rgba(0,127,217,0.16), rgba(0,0,0,0) 70%)", pointerEvents: "none" }} />
        <div style={{ position: "relative", maxWidth: 1240, margin: "0 auto", display: "flex", flexWrap: "wrap", alignItems: "center", gap: "clamp(36px, 5vw, 72px)" }}>
          <div style={{ flex: "1 1 380px", minWidth: 0, display: "flex", flexDirection: "column", gap: 24, animation: "landingFade 1s cubic-bezier(0.16,1,0.3,1) both" }}>
            <span style={eyebrow}>Ứng dụng TheraAI</span>
            <h2 style={{ margin: 0, fontSize: "clamp(30px, 3.6vw, 52px)", fontWeight: 600, lineHeight: 1.02, letterSpacing: "-0.02em", color: "#fff", maxWidth: "16ch", textWrap: "pretty" }}>
              Lộ trình phục hồi của riêng bạn
            </h2>
            <p style={{ margin: 0, maxWidth: 460, fontSize: 17, lineHeight: 1.65, color: "rgba(255,255,255,0.68)" }}>
              Hiểu rõ tình trạng hiện tại, theo dõi cơn đau mỗi ngày và đi theo một lộ trình phù hợp hơn với chính cơ thể mình — ngay trên điện thoại.
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 18 }}>
              <LandingButton href="/luyen-tap">Tải miễn phí</LandingButton>
              <span style={{ fontSize: 13, color: "rgba(255,255,255,0.62)" }}>Miễn phí trọn đời cho khách hàng TheraHome</span>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 26, paddingTop: 8, fontSize: 13, color: "rgba(255,255,255,0.62)" }}>
              <span>Bản đồ đau (Paid Map)</span>
              <span>Lộ trình 14 ngày</span>
              <span>Trợ lý AI 24/7</span>
            </div>
          </div>
          <div style={{ flex: "0 1 380px", display: "flex", justifyContent: "center", position: "relative" }}>
            <span aria-hidden="true" style={{ position: "absolute", inset: "6% 12%", borderRadius: "50%", background: "radial-gradient(circle, rgba(0,127,217,0.45), rgba(0,0,0,0) 70%)", filter: "blur(30px)", animation: "landingGlowPulse 7s ease-in-out infinite" }} />
            <AppPanel src={S("home")} alt="Màn hình chính ứng dụng TheraAI" max={360} seconds={12} />
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------- tính năng */}
      <section style={sectionPad}>
        <div className="reveal-scope" style={{ maxWidth: 1240, margin: "0 auto", display: "flex", flexDirection: "column", gap: "clamp(64px, 9vh, 120px)" }}>
          <Feature
            eyebrowText="Lộ trình có hướng dẫn"
            title="Lộ trình 14 ngày, chia theo từng giai đoạn"
            body="Mỗi ngày một buổi 15–20 phút, đánh dấu hoàn thành ngay trong app. Hết mỗi giai đoạn có bài tự đánh giá để lộ trình điều chỉnh theo tình trạng của bạn."
            chips={["Giai đoạn rõ ràng", "Đánh dấu hoàn thành", "Tự đánh giá theo giai đoạn"]}
            art={<AppPanel src={S("roadmap")} alt="Lộ trình 14 ngày trong ứng dụng" seconds={13} />}
          />

          <Feature
            flip
            eyebrowText="Buổi tập có video"
            title="Làm theo video từng ngày, không phải đoán"
            body="Mỗi ngày có video hướng dẫn riêng, xem trực tiếp trong app hoặc chiếu lên TV. Xem xong buổi đó tự động được ghi nhận hoàn thành."
            art={<AppPanel src={S("video")} alt="Buổi tập có video hướng dẫn" float="b" seconds={14} />}
          />

          <Feature
            eyebrowText="Trợ lý AI"
            title="Hỏi bất cứ lúc nào, trả lời ngay"
            body="Gợi ý buổi tập hôm nay, cách dùng thiết bị, điều chỉnh cường độ. Trợ lý được huấn luyện theo kiến thức của bác sĩ và chuyên gia trị liệu — không thay thế chẩn đoán của bác sĩ."
            art={<AppPanel src={S("ai-chat")} alt="Trợ lý TheraAI trong ứng dụng" max={360} seconds={15} />}
          />

          <Feature
            flip
            eyebrowText="Cộng đồng"
            title="Đi cùng những người cùng hoàn cảnh"
            body="Chia sẻ hành trình, đọc mẹo từ người đi trước và từ đội ngũ TheraHome. Duy trì đều đặn dễ hơn khi không làm một mình."
            art={<AppPanel src={S("community")} alt="Cộng đồng TheraHome trong ứng dụng" max={360} float="b" seconds={13} />}
          />

          <Feature
            flip
            eyebrowText="Hỗ trợ thật"
            title="Nhắn là có người trả lời"
            body="Đội ngũ TheraHome hỗ trợ về tài khoản, lộ trình, thiết bị và ứng dụng — theo sát bạn suốt lộ trình, không chỉ lúc mới mua."
            art={<AppPanel src={S("support")} alt="Hỗ trợ từ đội ngũ TheraHome" max={360} float="b" seconds={12.5} />}
          />
        </div>
      </section>

      {/* --------------------------------------------------------- tải app */}
      <section style={{ ...sectionPad, overflow: "hidden" }}>
        <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse 45% 50% at 50% 20%, rgba(0,127,217,0.12), rgba(0,0,0,0) 70%)", pointerEvents: "none" }} />
        <div style={{ position: "relative", maxWidth: 760, margin: "0 auto", display: "flex", flexDirection: "column", alignItems: "center", gap: 24, textAlign: "center" }}>
          <h2 style={{ margin: 0, fontSize: "clamp(28px, 3vw, 42px)", fontWeight: 600, lineHeight: 1.06, letterSpacing: "-0.015em", color: "#fff", textWrap: "pretty" }}>
            Bắt đầu lộ trình đầu tiên của bạn hôm nay
          </h2>
          <p style={{ margin: 0, maxWidth: 520, fontSize: 16.5, lineHeight: 1.65, color: "rgba(255,255,255,0.66)" }}>
            Tải ứng dụng TheraAI, chấm vị trí đau và nhận lộ trình cá nhân hoá trong 5 giây.
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 16 }}>
            <LandingButton href={app_links.appStore}>Tải trên App Store</LandingButton>
            <LandingButton href={app_links.playStore} variant="secondary">Tải trên Google Play</LandingButton>
          </div>
        </div>
      </section>

      <LandingFooter compact />
    </>
  );
}
