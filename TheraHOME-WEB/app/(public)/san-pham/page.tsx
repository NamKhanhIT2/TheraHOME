// TheraNECK+ — port of "Products.dc.html".
import type { CSSProperties } from "react";
import { LandingButton } from "@/components/landing/LandingButton";
import { getSiteContent } from "@/lib/siteContent";
import { LandingFooter } from "@/components/landing/LandingFooter";
import { ProductScrollHero } from "@/components/landing/ProductScrollHero";
import { Product3D } from "@/components/landing/Product3D";

export const metadata = {
  title: "TheraNECK+ · TheraHome",
  description: "Kéo giãn 26°, xung điện EMS, nhiệt sâu và massage — trong một thiết bị dùng tại nhà.",
};

const sectionPad: CSSProperties = { position: "relative", padding: "clamp(72px, 10vh, 130px) clamp(20px, 4vw, 64px)", borderTop: "1px solid rgba(255,255,255,0.06)" };
const eyebrow: CSSProperties = { fontSize: 11, letterSpacing: "0.2em", textTransform: "uppercase", color: "var(--color-primary)" };
const h2: CSSProperties = { margin: 0, fontSize: "clamp(26px, 2.8vw, 40px)", fontWeight: 600, lineHeight: 1.08, letterSpacing: "-0.015em", color: "#fff", textWrap: "pretty" };
const card: CSSProperties = { display: "flex", flexDirection: "column", gap: 14, padding: "clamp(24px, 2.4vw, 32px)", borderRadius: "var(--radius-lg, 24px)", background: "rgba(255,255,255,0.035)", border: "1px solid rgba(255,255,255,0.07)" };

const SUBNAV = [
  { href: "#mua-hang", label: "Giá & bộ quà tặng" },
  { href: "#lieu-phap-4", label: "4 liệu pháp" },
  { href: "#lo-trinh", label: "Lộ trình 14 ngày" },
];

const THERAPIES = [
  { badge: "AI", title: "Tích hợp AI", body: "Thiết lập lộ trình nhanh chóng bằng Paid Map — đau đâu chấm đấy, AI đề xuất lộ trình phù hợp với tình trạng của bạn." },
  { badge: "26°", title: "Liệu pháp kéo giãn", body: "Kỹ thuật kéo giãn nhẹ nhàng ở góc 26° mà các chuyên gia vật lý trị liệu sử dụng để giải nén cột sống cổ — tạo khoảng cho các đốt sống." },
  { badge: "EMS", title: "Liệu pháp xung điện", body: "Xung điện (EMS) giúp giảm đau bằng cách kích thích giải phóng endorphin hơn 50%, chất giảm đau tự nhiên của cơ thể." },
  { badge: "40° 41° 42°", title: "Liệu pháp nhiệt", body: "Liệu pháp nhiệt tập trung với ba cường độ khác nhau giúp tăng lưu lượng máu đến các cơ sâu ở cổ, đẩy nhanh quá trình phục hồi." },
  { badge: "♨", title: "Massager nhịp nhàng", body: "Massager nhịp nhàng làm tăng cảm giác dễ chịu, thư giãn trong quá trình trị liệu. Đồng thời giảm cơ co cứng quanh vùng cổ vai gáy." },
];


const PHASES = [
  { days: "Ngày 1–3", title: "Làm quen và khởi động", body: "Vùng cổ vai gáy bắt đầu dễ chịu hơn, cảm giác căng cứng giảm bớt và cơ thể làm quen dần với một nhịp phục hồi rõ ràng hơn." },
  { days: "Ngày 4–6", title: "Giảm đau và co cứng", body: "Cổ vai gáy bớt nặng hơn, đỡ khó chịu hơn trong sinh hoạt hằng ngày và cảm giác co cứng kéo dài bắt đầu giảm rõ." },
  { days: "Ngày 7–9", title: "Giảm kích thích và tê lan", body: "Những cảm giác khó chịu như tê mỏi, lan đau xuống vai hoặc lưng trên có xu hướng dịu bớt, giúp cơ thể nhẹ hơn và dễ chịu hơn." },
  { days: "Ngày 10–12", title: "Tăng cường sức bền", body: "Cổ vai gáy bắt đầu có cảm giác được nâng đỡ tốt hơn, ngồi lâu đỡ mỏi hơn và các hoạt động thường ngày trở nên thoải mái hơn." },
  { days: "Ngày 13–14", title: "Ổn định và giảm tái lại", body: "Cơ thể dần đi vào trạng thái ổn định hơn, vùng cổ bớt nhạy cảm với các tư thế xấu và cảm giác đỡ rồi lại đau cũng giảm dần." },
];

const BUNDLE = [
  "Máy trị liệu TheraNECK chính hãng",
  "Ứng dụng TheraAI trọn đời",
  "Lộ trình 14 ngày chuyên sâu",
  "Miếng dán thảo dược Vinh Gia",
  "Gel xung điện",
];

const ASSURANCES = ["Miễn phí lộ trình qua APP TheraAI hoặc Zalo", "Hoàn trả 14 ngày", "Bảo hành 12 tháng", "Giao 2–5 ngày, hỗ trợ COD"];


export default async function ProductsPage() {
  const { stats_results: RESULTS, faq: FAQ, pricing } = await getSiteContent();
  return (
    <>
      {/* product sub-nav, pinned under the site nav */}
      <div style={{ position: "sticky", top: 84, zIndex: 15, display: "flex", alignItems: "center", gap: 28, padding: "14px clamp(20px, 4vw, 64px)", background: "rgba(2,3,11,0.82)", backdropFilter: "blur(14px)", borderBottom: "1px solid rgba(255,255,255,0.07)", fontSize: 13, letterSpacing: "0.04em", overflowX: "auto" }}>
        <span style={{ color: "rgba(255,255,255,0.5)", flex: "0 0 auto" }}>Sản phẩm</span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "8px 16px", borderRadius: 999, background: "rgba(0,127,217,0.18)", border: "1px solid rgba(0,127,217,0.45)", color: "#fff", fontWeight: 500, flex: "0 0 auto" }}>TheraNECK+</span>
        {SUBNAV.map((s) => (
          <a key={s.href} href={s.href} style={{ color: "rgba(255,255,255,0.66)", flex: "0 0 auto" }}>{s.label}</a>
        ))}
      </div>

      <ProductScrollHero />

      {/* ------------------------------------------------- sản phẩm & giá */}
      {/* Moved above the supporting sections on 2026-09-20. The product, its
          price and the way to buy it used to sit below four screens of
          argument; a shop shows you the thing first and makes the case after. */}
      <section id="mua-hang" style={{ ...sectionPad, paddingTop: "clamp(48px, 7vh, 88px)" }}>
        <div className="reveal-scope" style={{ maxWidth: 1240, margin: "0 auto", display: "flex", flexWrap: "wrap", alignItems: "flex-start", gap: "clamp(32px, 4.5vw, 64px)" }}>

          <div style={{ flex: "1 1 380px", minWidth: 0, display: "flex", flexDirection: "column", gap: 14 }}>
            <Product3D label="Máy trị liệu cổ TheraNECK+" />
            <p style={{ margin: 0, fontSize: 13, color: "rgba(255,255,255,0.48)", textAlign: "center" }}>
              Mô hình 3D dựng từ sản phẩm thật
            </p>
          </div>

          <div style={{ flex: "1 1 340px", minWidth: 0, display: "flex", flexDirection: "column", gap: 18 }}>
            <span style={eyebrow}>Máy trị liệu cổ</span>
            <h2 style={{ ...h2, fontSize: "clamp(28px, 3vw, 42px)" }}>Bộ giải pháp Trị Liệu Cổ</h2>
            <span style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 14, color: "rgba(255,255,255,0.72)" }}>
              <span aria-hidden="true" style={{ color: "#FFD23F", letterSpacing: "0.08em" }}>★★★★★</span>
              {pricing.ratingLine}
            </span>
            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "baseline", gap: 14 }}>
              <span style={{ fontSize: "clamp(30px, 3.2vw, 44px)", fontWeight: 600, color: "#fff", letterSpacing: "-0.02em" }}>{pricing.current}</span>
              <s style={{ fontSize: 18, color: "rgba(255,255,255,0.62)" }}>{pricing.original}</s>
              <span style={{ fontSize: 13, fontWeight: 600, padding: "6px 12px", borderRadius: 999, background: "rgba(255,182,72,0.16)", border: "1px solid rgba(255,182,72,0.4)", color: "#FFB648" }}>
                {pricing.note}
              </span>
            </div>

            <div style={{ display: "flex", flexWrap: "wrap", gap: 14, paddingTop: 4 }}>
              <LandingButton href="https://therahomeai.com">Thêm vào giỏ hàng</LandingButton>
              <LandingButton href="/ung-dung" variant="secondary">Tìm hiểu ứng dụng</LandingButton>
            </div>

            <div style={{ ...card, gap: 0, padding: "clamp(18px, 1.8vw, 24px)", marginTop: 4 }}>
              <h3 style={{ margin: "0 0 4px", fontSize: 12, letterSpacing: "0.16em", textTransform: "uppercase", color: "rgba(255,255,255,0.5)" }}>Trọn bộ giải pháp sẽ bao gồm</h3>
              <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
                {BUNDLE.map((b, i) => (
                  <li key={b} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 0", borderTop: i === 0 ? "none" : "1px solid rgba(255,255,255,0.07)", fontSize: 15, color: "rgba(255,255,255,0.86)" }}>
                    <span aria-hidden="true" style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 24, height: 24, flex: "0 0 auto", borderRadius: 999, background: "rgba(0,127,217,0.18)", color: "#7FBFFF", fontSize: 12, fontWeight: 700 }}>{i + 1}</span>
                    {b}
                  </li>
                ))}
              </ul>
            </div>

            <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: "10px 20px" }}>
              {ASSURANCES.map((a) => (
                <li key={a} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 14, color: "rgba(255,255,255,0.7)" }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#4FB0F5" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flex: "0 0 auto" }}>
                    <path d="M5 12.5 10 17l9-10" />
                  </svg>
                  {a}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* ----------------------------------------------------- 4 liệu pháp */}
      <section id="lieu-phap-4" style={sectionPad}>
        <div className="reveal-scope" style={{ maxWidth: 1240, margin: "0 auto", display: "flex", flexDirection: "column", gap: "clamp(36px, 5vh, 60px)" }}>
          <h2 style={{ ...h2, maxWidth: 700 }}>Thiết bị Trị Liệu 4 Trong 1 mang lại hiệu quả giảm đau lâu dài.</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: "clamp(20px, 2.4vw, 32px)" }}>
            {THERAPIES.map((t) => (
              <div key={t.title} style={card}>
                <span style={{ display: "inline-flex", alignItems: "center", alignSelf: "flex-start", gap: 6, padding: "6px 12px", borderRadius: 999, background: "rgba(0,127,217,0.16)", border: "1px solid rgba(0,127,217,0.4)", fontSize: 13, fontWeight: 600, color: "#7FBFFF" }}>
                  {t.badge}
                </span>
                <h3 style={{ margin: 0, fontSize: 19, fontWeight: 600, color: "#fff" }}>{t.title}</h3>
                <p style={{ margin: 0, fontSize: 14.5, lineHeight: 1.65, color: "rgba(255,255,255,0.62)" }}>{t.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* --------------------------------------------------------- kết quả */}
      <section style={sectionPad}>
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

      {/* ------------------------------------------------- lộ trình 14 ngày */}
      <section id="lo-trinh" style={sectionPad}>
        <div className="reveal-scope" style={{ maxWidth: 1240, margin: "0 auto", display: "flex", flexDirection: "column", gap: "clamp(36px, 5vh, 56px)" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 14, maxWidth: 680 }}>
            <span style={eyebrow}>Dễ dàng làm quen</span>
            <h2 style={h2}>Lộ trình cá nhân hoá 14 ngày giúp bạn thay đổi như thế nào</h2>
          </div>
          <ol style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 0 }}>
            {PHASES.map((p, i) => (
              <li key={p.days} style={{ display: "flex", gap: "clamp(16px, 3vw, 40px)", padding: "clamp(20px, 3vh, 30px) 0", borderTop: i === 0 ? "none" : "1px solid rgba(255,255,255,0.07)" }}>
                <span style={{ flex: "0 0 auto", width: "clamp(88px, 12vw, 132px)", fontSize: 13.5, fontWeight: 600, letterSpacing: "0.04em", color: "#7FBFFF", paddingTop: 3 }}>{p.days}</span>
                <div style={{ display: "flex", flexDirection: "column", gap: 8, minWidth: 0 }}>
                  <h3 style={{ margin: 0, fontSize: "clamp(17px, 1.6vw, 21px)", fontWeight: 600, color: "#fff" }}>{p.title}</h3>
                  <p style={{ margin: 0, maxWidth: 640, fontSize: 15.5, lineHeight: 1.7, color: "rgba(255,255,255,0.64)" }}>{p.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ------------------------------------------------------------- FAQ */}
      <section style={sectionPad}>
        <div className="reveal-scope" style={{ maxWidth: 880, margin: "0 auto", display: "flex", flexDirection: "column", gap: "clamp(28px, 4vh, 44px)" }}>
          <h2 style={h2}>Câu hỏi thường gặp</h2>
          <div style={{ display: "flex", flexDirection: "column" }}>
            {FAQ.map((f, i) => (
              <details key={f.q} style={{ borderTop: i === 0 ? "none" : "1px solid rgba(255,255,255,0.08)", padding: "18px 0" }}>
                <summary style={{ cursor: "pointer", listStyle: "none", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 20, fontSize: "clamp(16px, 1.5vw, 18px)", fontWeight: 500, color: "#fff" }}>
                  {f.q}
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.6)" strokeWidth="2" aria-hidden="true" style={{ flex: "0 0 auto" }}>
                    <path d="M12 5v14M5 12h14" />
                  </svg>
                </summary>
                <p style={{ margin: "12px 0 0", maxWidth: 720, fontSize: 15.5, lineHeight: 1.7, color: "rgba(255,255,255,0.64)" }}>{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <LandingFooter />
    </>
  );
}
