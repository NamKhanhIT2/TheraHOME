// Về chúng tôi — port of "About.dc.html".
import Link from "next/link";
import type { CSSProperties } from "react";
import { getSiteContent } from "@/lib/siteContent";
import { LandingFooter } from "@/components/landing/LandingFooter";

export const metadata = {
  title: "Về chúng tôi · TheraHome",
  description: "Giải pháp trị liệu cổ – vai – gáy toàn diện cho cuộc sống khỏe mạnh & chủ động hơn.",
};

const sectionPad: CSSProperties = { position: "relative", padding: "clamp(64px, 9vh, 120px) clamp(20px, 4vw, 64px)", borderTop: "1px solid rgba(255,255,255,0.06)" };
const eyebrow: CSSProperties = { fontSize: 11, letterSpacing: "0.2em", textTransform: "uppercase", color: "var(--color-primary)" };
const h2: CSSProperties = { margin: 0, fontSize: "clamp(26px, 2.8vw, 40px)", fontWeight: 600, lineHeight: 1.08, letterSpacing: "-0.015em", color: "#fff" };
const body: CSSProperties = { margin: 0, maxWidth: 520, fontSize: 16.5, lineHeight: 1.7, color: "rgba(255,255,255,0.68)" };
const tile: CSSProperties = { padding: 24, borderRadius: "var(--radius-lg, 24px)", background: "rgba(255,255,255,0.035)", border: "1px solid rgba(255,255,255,0.07)", fontSize: 16, fontWeight: 600, color: "#fff" };

const MISSION_POINTS = [
  "Giảm đau tự nhiên, an toàn và bền vững",
  "Thoát khỏi sự phụ thuộc vào thuốc và các biện pháp tạm thời",
  "Lấy lại năng lượng, sự linh hoạt và chất lượng sống",
];

const VALUES = ["Hiểu gốc – sửa gốc", "Đơn giản nhưng hiệu quả", "Cá nhân hoá cho từng cơ thể", "Ứng dụng công nghệ để nâng độ chính xác hằng ngày"];



function Check() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#4FB0F5" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flex: "0 0 auto", marginTop: 1 }}>
      <path d="M5 12.5 10 17l9-10" />
    </svg>
  );
}

export default async function AboutPage() {
  const { contact, social } = await getSiteContent();
  // Same four rows the page always showed, now built from the edited values.
  const CONTACT = [
    { label: "Địa chỉ", value: contact.address },
    { label: "Điện thoại", value: contact.phone, href: contact.phoneHref },
    { label: "Email", value: contact.email, href: `mailto:${contact.email}` },
    { label: "Ngày làm việc", value: contact.hours },
  ];
  const SOCIAL = [
    { href: social.facebook, label: "Facebook" },
    { href: social.youtube, label: "YouTube" },
  ];
  return (
    <>
      {/* ------------------------------------------------------ about hero */}
      <section style={{ position: "relative", overflow: "hidden", padding: "clamp(56px, 9vh, 110px) clamp(20px, 4vw, 64px) clamp(48px, 7vh, 90px)" }}>
        <div aria-hidden="true" style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse 50% 50% at 74% 40%, rgba(0,127,217,0.13), rgba(0,0,0,0) 70%)", pointerEvents: "none" }} />
        <div style={{ position: "relative", maxWidth: 1240, margin: "0 auto", display: "flex", flexWrap: "wrap", alignItems: "center", gap: "clamp(32px, 5vw, 72px)" }}>
          <div style={{ flex: "1 1 420px", minWidth: 0, display: "flex", flexDirection: "column", gap: 22, animation: "landingFade 1s cubic-bezier(0.16,1,0.3,1) both" }}>
            <span style={eyebrow}>Về chúng tôi</span>
            <h1 style={{ margin: 0, fontSize: "clamp(30px, 3.6vw, 52px)", fontWeight: 600, lineHeight: 1.04, letterSpacing: "-0.02em", color: "#fff", maxWidth: "22ch", textWrap: "pretty" }}>
              Giải pháp trị liệu cổ – vai – gáy toàn diện cho cuộc sống khỏe mạnh &amp; chủ động hơn
            </h1>
            <p style={{ ...body, maxWidth: 560, fontSize: 17, color: "rgba(255,255,255,0.72)" }}>
              Tại TheraHome AI, chúng tôi tin rằng một cơ thể khỏe mạnh bắt đầu từ một cột sống khỏe mạnh – và mỗi người đều xứng đáng sống một cuộc đời không bị giới hạn bởi những cơn đau âm ỉ kéo dài.
            </p>
            <p style={{ ...body, maxWidth: 560, fontSize: 17, color: "rgba(255,255,255,0.72)" }}>
              Trong nhiều năm nghiên cứu về hành vi con người và sinh lý học cột sống, chúng tôi nhận ra rằng:{" "}
              <strong style={{ fontWeight: 600, color: "#fff" }}>80% đau cổ – vai – gáy không đến từ tuổi tác, mà đến từ thói quen sống sai cách.</strong>
            </p>
            <p style={{ ...body, maxWidth: 560, fontSize: 17, color: "rgba(255,255,255,0.72)" }}>
              Vì vậy, TheraHome AI không chỉ tạo ra một sản phẩm, mà xây dựng một hệ sinh thái chăm sóc trọn vòng đời, giúp bạn:{" "}
              <strong style={{ fontWeight: 600, color: "#fff" }}>Hiểu đúng – Cải thiện đúng – Duy trì đúng</strong> thói quen để sống khỏe hơn mỗi ngày.
            </p>
          </div>

          {/* the rotating emblem — pure CSS, no asset needed */}
          <div style={{ flex: "0 1 320px", display: "flex", justifyContent: "center", animation: "landingFade 1.2s cubic-bezier(0.16,1,0.3,1) .3s both" }}>
            <div style={{ position: "relative", width: "min(320px, 78vw)", aspectRatio: "1" }}>
              <span aria-hidden="true" style={{ position: "absolute", inset: "26%", borderRadius: "50%", background: "radial-gradient(circle, rgba(0,127,217,0.5), rgba(0,127,217,0) 70%)", filter: "blur(16px)", animation: "landingBreathe 8s ease-in-out infinite" }} />
              <span aria-hidden="true" style={{ position: "absolute", inset: "8%", borderRadius: "50%", border: "1px solid rgba(255,255,255,0.1)" }} />
              <span aria-hidden="true" style={{ position: "absolute", inset: "22%", borderRadius: "50%", border: "1px dashed rgba(0,127,217,0.45)", animation: "landingSpin 28s linear infinite" }} />
              <span aria-hidden="true" style={{ position: "absolute", inset: "36%", borderRadius: "50%", border: "1px solid rgba(255,255,255,0.14)", animation: "landingSpinRev 21s linear infinite" }} />
              <span style={{ position: "absolute", left: "50%", top: "50%", transform: "translate(-50%,-50%)", textAlign: "center", fontSize: 12, lineHeight: 1.6, letterSpacing: "0.08em", color: "rgba(255,255,255,0.82)" }}>
                Chăm bằng trái tim,
                <br />
                chỉnh từng đốt sống.
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* -------------------------------------------------------- sứ mệnh */}
      <section style={sectionPad}>
        <div className="reveal-scope" style={{ maxWidth: 1240, margin: "0 auto", display: "flex", flexWrap: "wrap", gap: "clamp(32px, 5vw, 72px)" }}>
          <div style={{ flex: "1 1 340px", minWidth: 0, display: "flex", flexDirection: "column", gap: 18 }}>
            <h2 style={h2}>Sứ mệnh của chúng tôi</h2>
            <p style={body}>
              Trao cho mỗi người khả năng tự chăm sóc cột sống và cơ thể ngay tại nhà, dựa trên khoa học – công nghệ – và những thói quen trị liệu lành mạnh.
            </p>
            <p style={{ ...body, color: "rgba(255,255,255,0.8)" }}>
              Chúng tôi không chỉ bán sản phẩm. <strong style={{ fontWeight: 600, color: "#fff" }}>Chúng tôi trao lại sự thoải mái cho cuộc sống của bạn.</strong>
            </p>
          </div>
          <div style={{ flex: "1 1 340px", minWidth: 0, display: "flex", flexDirection: "column", gap: 14 }}>
            {MISSION_POINTS.map((p) => (
              <div key={p} style={{ display: "flex", alignItems: "flex-start", gap: 14, padding: "20px 22px", borderRadius: "var(--radius-md, 16px)", background: "rgba(255,255,255,0.035)", border: "1px solid rgba(255,255,255,0.07)" }}>
                <Check />
                <span style={{ fontSize: 15, lineHeight: 1.6, color: "rgba(255,255,255,0.84)" }}>{p}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------- khác biệt */}
      <section style={sectionPad}>
        <div className="reveal-scope" style={{ maxWidth: 1240, margin: "0 auto", display: "flex", flexDirection: "column", gap: "clamp(36px, 5vh, 60px)" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 18, maxWidth: 680 }}>
            <h2 style={h2}>Điều khác biệt của chúng tôi</h2>
            <p style={{ ...body, maxWidth: "none" }}>
              Chúng tôi kết hợp trí tuệ nhân tạo (AI), thiết bị trị liệu ứng dụng công nghệ tiên tiến, và kiến thức từ chuyên gia trị liệu để phân tích tình trạng từng người và điều chỉnh lộ trình phục hồi phù hợp nhất với cơ thể họ.
            </p>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "clamp(20px, 2.4vw, 32px)" }}>
            <article style={{ display: "flex", flexDirection: "column", gap: 16, padding: "clamp(24px, 2.4vw, 32px)", borderRadius: "var(--radius-lg, 24px)", background: "rgba(255,255,255,0.035)", border: "1px solid rgba(255,255,255,0.07)" }}>
              <span style={{ ...eyebrow, letterSpacing: "0.18em" }}>01</span>
              <h3 style={{ margin: 0, fontSize: 19, fontWeight: 600, color: "#fff", lineHeight: 1.3 }}>Trị liệu toàn diện – dựa trên cơ chế đau thật của con người</h3>
              <p style={{ margin: 0, fontSize: 14.5, lineHeight: 1.7, color: "rgba(255,255,255,0.64)" }}>
                Không chỉ dừng ở triệu chứng. Chúng tôi tìm hiểu gốc rễ của cơn đau thông qua thói quen sống, tư thế, độ căng cơ và mức độ vận động hằng ngày — để giảm đau đúng nguyên nhân, không chỉ giảm tạm thời.
              </p>
            </article>
            <article style={{ display: "flex", flexDirection: "column", gap: 16, padding: "clamp(24px, 2.4vw, 32px)", borderRadius: "var(--radius-lg, 24px)", background: "rgba(255,255,255,0.035)", border: "1px solid rgba(255,255,255,0.07)" }}>
              <span style={{ ...eyebrow, letterSpacing: "0.18em" }}>02</span>
              <h3 style={{ margin: 0, fontSize: 19, fontWeight: 600, color: "#fff", lineHeight: 1.3 }}>Ứng dụng chăm sóc sức khỏe cá nhân hoá</h3>
              <p style={{ margin: 0, fontSize: 14.5, lineHeight: 1.7, color: "rgba(255,255,255,0.64)" }}>
                Ứng dụng giống như một chuyên gia trị liệu luôn bên cạnh bạn: theo dõi tình trạng mỗi ngày, gợi ý bài tập đúng với trạng thái, xác định vùng đau qua bản đồ Pain Map 3D, nhắc lịch tập và cập nhật kiến thức giảm đau khoa học.
              </p>
              <Link href="/app" style={{ fontSize: 13, color: "#7FBFFF" }}>Tìm hiểu ứng dụng →</Link>
            </article>
          </div>
        </div>
      </section>

      {/* --------------------------------------------------------- giá trị */}
      <section style={sectionPad}>
        <div className="reveal-scope" style={{ maxWidth: 1240, margin: "0 auto", display: "flex", flexDirection: "column", gap: "clamp(32px, 4.5vh, 56px)" }}>
          <h2 style={h2}>Giá trị mà TheraHome AI theo đuổi</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "clamp(18px, 2vw, 28px)" }}>
            {VALUES.map((v) => <div key={v} style={tile}>{v}</div>)}
          </div>
          <p style={{ ...body, maxWidth: 620 }}>Chúng tôi đi con đường dài: xây dựng thói quen sống lành mạnh – không chỉ giảm đau tức thời.</p>
        </div>
      </section>

      {/* -------------------------------------------------------- tầm nhìn */}
      <section style={sectionPad}>
        <div style={{ maxWidth: 820, margin: "0 auto", display: "flex", flexDirection: "column", gap: 20, textAlign: "center", alignItems: "center" }}>
          <span style={eyebrow}>Tầm nhìn</span>
          <h2 style={{ ...h2, fontSize: "clamp(26px, 2.9vw, 42px)", lineHeight: 1.1, textWrap: "pretty" }}>
            Trở thành nền tảng chăm sóc cột sống &amp; phục hồi chức năng hàng đầu Đông Nam Á
          </h2>
          <p style={{ ...body, maxWidth: 600 }}>
            Nơi mỗi người có thể kiểm soát sức khỏe của mình dễ dàng hơn – thông minh hơn – chủ động hơn mỗi ngày.
          </p>
          <p style={{ margin: 0, fontSize: 16, fontStyle: "italic", color: "rgba(255,255,255,0.82)" }}>
            TheraHome AI – &ldquo;Chăm bằng trái tim, chỉnh từng đốt sống.&rdquo;
          </p>
        </div>
      </section>

      {/* ------------------------------------------------------------ blog */}
      <section id="blog" style={sectionPad}>
        <div className="reveal-scope" style={{ maxWidth: 1240, margin: "0 auto", display: "flex", flexWrap: "wrap", alignItems: "center", gap: "clamp(24px, 4vw, 56px)" }}>
          <div style={{ flex: "1 1 360px", minWidth: 0, display: "flex", flexDirection: "column", gap: 14 }}>
            <span style={eyebrow}>Blog</span>
            <h2 style={{ ...h2, fontSize: "clamp(24px, 2.4vw, 34px)", lineHeight: 1.1 }}>Kiến thức về cột sống cổ</h2>
            <p style={{ ...body, fontSize: 16, color: "rgba(255,255,255,0.66)" }}>
              Chuyên mục đang được cập nhật. Trong lúc chờ, bạn có thể theo dõi các nội dung mới nhất của TheraHome trên Facebook và YouTube.
            </p>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 14 }}>
            {SOCIAL.map((s) => (
              <a key={s.href} href={s.href} target="_blank" rel="noreferrer" style={{ padding: "14px 22px", borderRadius: 999, border: "1px solid rgba(255,255,255,0.14)", fontSize: 14, color: "rgba(255,255,255,0.86)" }}>
                {s.label}
              </a>
            ))}
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------- liên hệ */}
      <section id="lien-he" style={sectionPad}>
        <div className="reveal-scope" style={{ maxWidth: 1240, margin: "0 auto", display: "flex", flexDirection: "column", gap: "clamp(28px, 4vh, 44px)" }}>
          <h2 style={h2}>Liên hệ</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))", gap: "clamp(20px, 2.4vw, 32px)" }}>
            {CONTACT.map((c) => (
              <div key={c.label} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <span style={{ fontSize: 12, letterSpacing: "0.14em", textTransform: "uppercase", color: "rgba(255,255,255,0.5)" }}>{c.label}</span>
                {c.href ? (
                  <a href={c.href} style={{ fontSize: 15, lineHeight: 1.6, color: "rgba(255,255,255,0.82)" }}>{c.value}</a>
                ) : (
                  <span style={{ fontSize: 15, lineHeight: 1.6, color: "rgba(255,255,255,0.82)" }}>{c.value}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      <LandingFooter compact />
    </>
  );
}
