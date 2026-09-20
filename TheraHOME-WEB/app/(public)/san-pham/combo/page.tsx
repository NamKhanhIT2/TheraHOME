// Combo Phục Hồi Toàn Diện — the four pieces the box actually contains, one
// at a time, on a ground that changes colour with them.
//
// A page of its own under the product tab rather than another band on
// /san-pham: that page argues for the device, and the argument for the combo
// is a different one — it is about four things covering four different hours
// of the day. The carousel carries it; everything under the fold is the
// reason they belong together, the price, and the way to buy.
import type { CSSProperties } from "react";
import Link from "next/link";
import { Anton } from "next/font/google";
import { ComboCarousel } from "@/components/landing/ComboCarousel";
import { LandingButton } from "@/components/landing/LandingButton";
import { LandingFooter } from "@/components/landing/LandingFooter";
import { getSiteContent } from "@/lib/siteContent";

// Anton is the reference prompt's display face and it carries a Vietnamese
// subset, so the giant words keep their marks (TRỊ LIỆU, ĐỒNG HÀNH) instead of
// falling back mid-word. One weight is all the family has.
const anton = Anton({ subsets: ["latin", "vietnamese"], weight: "400", display: "swap" });

export const metadata = {
  title: "Combo Phục Hồi Toàn Diện · TheraHome",
  description:
    "Máy trị liệu cổ TheraNECK+, gối công thái học, ứng dụng TheraAI và miếng dán thảo dược Vinh Gia — bốn thứ chia nhau bốn thời điểm trong ngày.",
};

const sectionPad: CSSProperties = { position: "relative", padding: "clamp(72px, 10vh, 130px) clamp(20px, 4vw, 64px)", borderTop: "1px solid rgba(255,255,255,0.06)" };
const eyebrow: CSSProperties = { fontSize: 11, letterSpacing: "0.2em", textTransform: "uppercase", color: "var(--color-primary)" };
const h2: CSSProperties = { margin: 0, fontSize: "clamp(26px, 2.8vw, 40px)", fontWeight: 600, lineHeight: 1.08, letterSpacing: "-0.015em", color: "#fff", textWrap: "pretty" };
const card: CSSProperties = { display: "flex", flexDirection: "column", gap: 14, padding: "clamp(24px, 2.4vw, 32px)", borderRadius: "var(--radius-lg, 24px)", background: "rgba(255,255,255,0.035)", border: "1px solid rgba(255,255,255,0.07)" };

/** The case for buying all four, told as the day they divide between them. */
const HOURS = [
  { when: "15 phút mỗi ngày", what: "Máy trị liệu", body: "Buổi trị liệu thật sự: kéo giãn, xung điện, nhiệt và massage cùng làm việc trên vùng cổ vai gáy." },
  { when: "Bảy đến tám tiếng mỗi đêm", what: "Gối công thái học", body: "Phần dài nhất của ngày. Gối giữ cổ ở đúng tư thế trong lúc ngủ, để kết quả của buổi trị liệu không mất đi sau một đêm nằm sai." },
  { when: "Những lúc mỏi bất chợt", what: "Miếng dán thảo dược", body: "Giữa hai buổi trị liệu vẫn có lúc cổ vai gáy khó chịu. Miếng dán làm dịu ngay tại chỗ mà không phải chờ đến buổi kế tiếp." },
  { when: "Suốt mười bốn ngày", what: "Ứng dụng TheraAI", body: "Thứ giữ cho ba món trên đi theo một hướng: hôm nay tập gì, đã đến ngày nào, cơn đau đang đi lên hay đi xuống." },
];

export default async function ComboPage() {
  const { pricing, buy } = await getSiteContent();

  return (
    <>
      <ComboCarousel displayClass={anton.className} buyHref={buy.combo} priceLabel={pricing.comboCurrent} />

      {/* ------------------------------------------- vì sao đi cùng nhau */}
      <section style={{ ...sectionPad, borderTop: "none" }}>
        <div className="reveal-scope" style={{ maxWidth: 1240, margin: "0 auto", display: "flex", flexDirection: "column", gap: "clamp(32px, 5vh, 54px)" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: 680 }}>
            <span style={eyebrow}>Vì sao là cả bộ</span>
            <h2 style={h2}>Bốn món, bốn thời điểm khác nhau trong ngày.</h2>
            <p style={{ margin: 0, fontSize: 16.5, lineHeight: 1.65, color: "rgba(255,255,255,0.66)" }}>
              Buổi trị liệu chỉ chiếm mười lăm phút. Phần còn lại của ngày mới là nơi cổ vai gáy được giữ gìn hoặc bị làm hỏng — và đó là việc của ba món kia.
            </p>
          </div>

          <ol style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "clamp(18px, 2.2vw, 28px)" }}>
            {HOURS.map((h) => (
              <li key={h.what} style={card}>
                <span style={{ display: "inline-flex", alignSelf: "flex-start", padding: "6px 12px", borderRadius: 999, background: "rgba(0,127,217,0.16)", border: "1px solid rgba(0,127,217,0.4)", fontSize: 12.5, fontWeight: 600, color: "#7FBFFF" }}>
                  {h.when}
                </span>
                <h3 style={{ margin: 0, fontSize: 19, fontWeight: 600, color: "#fff" }}>{h.what}</h3>
                <p style={{ margin: 0, fontSize: 14.5, lineHeight: 1.65, color: "rgba(255,255,255,0.62)" }}>{h.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ------------------------------------------------------- giá & mua */}
      <section id="mua-combo" style={sectionPad}>
        <div className="reveal-scope" style={{ maxWidth: 760, margin: "0 auto", display: "flex", flexDirection: "column", gap: 22 }}>
          <div style={{ ...card, gap: 16, borderColor: "rgba(0,127,217,0.45)", background: "rgba(0,127,217,0.07)" }}>
            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10 }}>
              <h2 style={{ ...h2, fontSize: "clamp(24px, 2.5vw, 32px)" }}>{pricing.comboName}</h2>
              <span style={{ fontSize: 11.5, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", padding: "5px 10px", borderRadius: 999, background: "rgba(0,127,217,0.2)", border: "1px solid rgba(0,127,217,0.45)", color: "#7FBFFF" }}>
                Chuyên gia khuyên dùng
              </span>
            </div>
            <p style={{ margin: 0, fontSize: 15.5, lineHeight: 1.65, color: "rgba(255,255,255,0.74)" }}>{pricing.comboDesc}</p>
            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "baseline", gap: 12 }}>
              <span style={{ fontSize: "clamp(28px, 3vw, 40px)", fontWeight: 600, color: "#fff", letterSpacing: "-0.02em" }}>{pricing.comboCurrent}</span>
              <s style={{ fontSize: 17, color: "rgba(255,255,255,0.6)" }}>{pricing.comboOriginal}</s>
              <span style={{ fontSize: 13, color: "#7BE39B" }}>{pricing.comboNote}</span>
            </div>
            <LandingButton href={buy.combo}>Mua combo — {pricing.comboCurrent}</LandingButton>
          </div>

          <p style={{ margin: 0, fontSize: 15, lineHeight: 1.7, color: "rgba(255,255,255,0.6)" }}>
            Chỉ cần riêng máy trị liệu? <Link href="/san-pham#mua-hang" style={{ color: "#7FBFFF", borderBottom: "1px solid rgba(127,191,255,0.4)" }}>Xem bộ giải pháp Trị Liệu Cổ — {pricing.current}</Link>
          </p>
        </div>
      </section>

      <LandingFooter />
    </>
  );
}
