"use client";

// The home page opening: "Home Cinematic.dc.html" from the design project.
//
// One 640vh scroll track with a sticky 100vh stage. Scrolling scrubs a single
// forward camera move through four stills — exterior at sunset, the glass door
// opening, the foyer, the gym — while six copy blocks fade in and out along a
// progress rail. The choreography lives in public/landing/cinematic-scroll.js
// (the design's own script, ported near-verbatim; see its header for the two
// places it differs) and is driven entirely by scroll position: this component
// only lays out the DOM the script expects, with data-cine-* hooks.
//
// The design's four plates are the owner's own frames (public/landing/cine/,
// see public/landing/README.md). The design also lists a fill.png under the
// plates: the stills are object-fit: contain, so on any viewport that is not
// 16:9 there would be bars top/bottom or left/right. That file could not be
// pulled (256 KiB cap), so the fill is the exterior frame again, blurred and
// darkened with CSS — the same treatment the previous hero used for its
// backdrop. It never shows through sharply; it only tints the bars.
import { createElement, type CSSProperties, type ReactNode } from "react";
import Link from "next/link";
import Script from "next/script";

const CINE = (n: string) => `/landing/cine/${n}.jpg`;

/** The scroll track element cinematic-scroll.js upgrades. Created through
 * createElement so no JSX intrinsic-element augmentation is needed (same
 * reasoning as ProductScrollHero). The inline height matches the design so
 * there is no jump before the script sets it for the viewport.
 *
 * The negative top margin swallows the 84px spacer LandingNav leaves under
 * its fixed bar. Every other page wants that gap; this one wants the opening
 * frame to run up under a transparent nav, which is what the design shows
 * and what the script arranges (it clears the nav's glass while at the top). */
function CinematicScrollElement({ children }: { children: ReactNode }) {
  return createElement(
    "cinematic-scroll",
    { style: { display: "block", position: "relative", height: "640vh", marginTop: "calc(-1 * var(--nav-h, 84px))" } },
    children,
  );
}

const plate: CSSProperties = {
  position: "absolute",
  inset: 0,
  width: "100%",
  height: "100%",
  objectFit: "contain",
  opacity: 0,
  willChange: "transform, opacity",
};

/** Every copy block sits at the design's left offset; the script drives
 * visibility, so they all start hidden except scene 1. */
const copyBase: CSSProperties = {
  position: "absolute",
  left: "clamp(84px, 9vw, 150px)",
  zIndex: 4,
  display: "flex",
  flexDirection: "column",
};

const h2: CSSProperties = { margin: 0, fontWeight: 600, color: "#fff" };
const body: CSSProperties = { margin: 0, fontSize: "clamp(15px, 1.15vw, 18px)", lineHeight: 1.55, color: "rgba(255,255,255,0.84)", textWrap: "pretty" };

const ctaPrimary: CSSProperties = { display: "inline-flex", alignItems: "center", height: 46, padding: "0 22px", borderRadius: 999, background: "var(--color-primary)", color: "#fff", fontSize: 15, fontWeight: 600 };
const ctaGhost: CSSProperties = { display: "inline-flex", alignItems: "center", gap: 8, height: 46, padding: "0 20px", borderRadius: 999, border: "1px solid rgba(255,255,255,0.32)", color: "#fff", fontSize: 15, fontWeight: 500 };

function Step() {
  return (
    <li data-cine-step style={{ display: "flex", alignItems: "center", gap: 12, marginLeft: -19 }}>
      <span style={{ width: 9, height: 9, borderRadius: "50%", border: "1px solid rgba(255,255,255,0.5)", background: "transparent", flex: "0 0 auto" }} />
    </li>
  );
}

export function CinematicHero() {
  return (
    <>
      <Script src="/landing/cinematic-scroll.js" strategy="afterInteractive" />
      <CinematicScrollElement>
        <div data-cine-stage style={{ position: "sticky", top: 0, height: "100vh", overflow: "hidden", background: "#06111C" }}>
          {/* fill under the contained plates — see the header note */}
          {/* eslint-disable-next-line @next/next/no-img-element -- cinematic-scroll.js writes transform/opacity straight onto these; next/image would wrap them in its own element and fight it */}
          <img src={CINE("01-exterior")} alt="" aria-hidden="true" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", filter: "blur(40px) brightness(0.55) saturate(1.05)", transform: "scale(1.15)", pointerEvents: "none" }} />

          {/* plates, in camera order */}
          {/* eslint-disable-next-line @next/next/no-img-element -- cinematic-scroll.js writes transform/opacity straight onto these; next/image would wrap them in its own element and fight it */}
          <img data-cine-plate="ext" src={CINE("01-exterior")} alt="Ngôi nhà TheraHOME lúc hoàng hôn" style={plate} />
          {/* eslint-disable-next-line @next/next/no-img-element -- cinematic-scroll.js writes transform/opacity straight onto these; next/image would wrap them in its own element and fight it */}
          <img data-cine-plate="door" src={CINE("02-door-open")} alt="" style={plate} />
          {/* eslint-disable-next-line @next/next/no-img-element -- cinematic-scroll.js writes transform/opacity straight onto these; next/image would wrap them in its own element and fight it */}
          <img data-cine-plate="foyer" src={CINE("03-foyer")} alt="" style={plate} />
          {/* eslint-disable-next-line @next/next/no-img-element -- cinematic-scroll.js writes transform/opacity straight onto these; next/image would wrap them in its own element and fight it */}
          <img data-cine-plate="gym" src={CINE("04-gym")} alt="" style={plate} />
          <div data-cine-grade aria-hidden="true" style={{ position: "absolute", inset: 0, background: "linear-gradient(90deg, rgba(6,17,28,0.72) 0%, rgba(6,17,28,0.38) 42%, rgba(6,17,28,0) 70%), linear-gradient(180deg, rgba(6,17,28,0.35) 0%, rgba(6,17,28,0) 22%, rgba(6,17,28,0) 75%, rgba(6,17,28,0.45) 100%)", opacity: 0.18, pointerEvents: "none" }} />

          {/* left progress rail */}
          <div className="cine-rail" aria-hidden="true" style={{ position: "absolute", left: "clamp(18px, 2.6vw, 40px)", top: "50%", transform: "translateY(-50%)", zIndex: 5, display: "flex", gap: 14, pointerEvents: "none" }}>
            <div style={{ position: "relative", width: 1, background: "rgba(255,255,255,0.18)", margin: "8px 0" }}>
              <div data-cine-fill style={{ position: "absolute", left: 0, top: 0, width: 1, height: "100%", background: "var(--color-primary)", transform: "scaleY(0)", transformOrigin: "top", boxShadow: "0 0 8px rgba(0,127,217,0.7)" }} />
            </div>
            <ol style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 22 }}>
              <Step /><Step /><Step /><Step /><Step /><Step />
            </ol>
          </div>

          {/* SCENE 01 · exterior */}
          <div className="cine-copy" data-cine-copy="1" style={{ ...copyBase, top: "50%", transform: "translateY(-50%)", maxWidth: 600, gap: 18 }}>
            <span style={{ fontSize: 12, letterSpacing: "0.18em", textTransform: "uppercase", color: "#B8DCFC", fontWeight: 500 }}>TheraHOME · Wellness starts at home</span>
            <h1 style={{ ...h2, fontSize: "clamp(34px, 4.6vw, 64px)", lineHeight: 1.06, letterSpacing: "-0.025em", textWrap: "balance" }}>Một khởi đầu khỏe hơn từ chính ngôi nhà của bạn.</h1>
            <p style={{ ...body, color: "rgba(255,255,255,0.82)", maxWidth: 520 }}>TheraHOME kết hợp thiết bị, ứng dụng và lộ trình để việc chăm sóc cơ thể tại nhà có hướng đi rõ ràng hơn.</p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginTop: 8 }}>
              <Link className="cine-cta" href="/san-pham" style={ctaPrimary}>Khám phá TheraHOME</Link>
              <a className="cine-cta-ghost" href="#hanh-trinh" style={ctaGhost}>
                Xem hành trình
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 5v14M6 13l6 6 6-6" /></svg>
              </a>
            </div>
          </div>

          {/* SCENE 02 · door opening */}
          <div className="cine-copy" data-cine-copy="2" style={{ ...copyBase, bottom: "clamp(64px, 10vh, 120px)", maxWidth: 480, gap: 12, visibility: "hidden" }}>
            <h2 style={{ ...h2, fontSize: "clamp(26px, 2.8vw, 40px)", lineHeight: 1.12, letterSpacing: "-0.02em" }}>Bước vào không gian của bạn.</h2>
            <p style={{ ...body, fontSize: "clamp(15px, 1.1vw, 17px)", color: "rgba(255,255,255,0.82)" }}>Không cần một phòng tập lớn.<br />Chỉ cần một góc nhỏ và một lộ trình đúng.</p>
          </div>

          {/* SCENE 03 · foyer */}
          <div className="cine-copy" data-cine-copy="3" style={{ ...copyBase, top: "clamp(110px, 16vh, 170px)", maxWidth: 540, gap: 22, visibility: "hidden" }}>
            <h2 style={{ ...h2, fontSize: "clamp(30px, 3.6vw, 52px)", lineHeight: 1.08, letterSpacing: "-0.024em" }}>Chăm sóc mỗi ngày,<br />ngay tại nhà.</h2>
          </div>

          {/* SCENE 04 · turn toward gym */}
          <div className="cine-copy" data-cine-copy="4" style={{ ...copyBase, bottom: "clamp(72px, 12vh, 140px)", maxWidth: 520, gap: 14, padding: "22px 26px", borderRadius: 18, background: "rgba(8,20,32,0.28)", border: "1px solid rgba(255,255,255,0.18)", backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)", visibility: "hidden" }}>
            <h2 style={{ ...h2, fontSize: "clamp(28px, 3.2vw, 46px)", lineHeight: 1.1, letterSpacing: "-0.022em" }}>Một không gian nhỏ.<br />Một thói quen lớn.</h2>
            <p style={{ ...body, fontSize: "clamp(15px, 1.1vw, 17px)" }}>TheraHOME giúp việc chăm sóc cơ thể trở thành một phần tự nhiên của cuộc sống hằng ngày.</p>
          </div>

          {/* SCENE 05 · inside the gym */}
          <div className="cine-copy" data-cine-copy="5" style={{ ...copyBase, top: "clamp(110px, 16vh, 170px)", maxWidth: 520, gap: 16, visibility: "hidden" }}>
            <h2 style={{ ...h2, fontSize: "clamp(28px, 3.4vw, 50px)", lineHeight: 1.08, letterSpacing: "-0.024em" }}>Thiết bị chỉ là điểm bắt đầu.</h2>
            <p style={body}>Điều tạo nên khác biệt là cách mọi thứ kết nối thành một lộ trình.</p>
          </div>

          {/* SCENE 06 · ecosystem / final */}
          <div className="cine-copy" data-cine-copy="6" style={{ ...copyBase, top: "clamp(104px, 15vh, 160px)", maxWidth: 560, gap: 18, visibility: "hidden" }}>
            <h2 style={{ ...h2, fontSize: "clamp(32px, 4.2vw, 58px)", lineHeight: 1.06, letterSpacing: "-0.026em", textWrap: "balance" }}>Một cơ thể khỏe mạnh là nền tảng cho những điều tuyệt vời hơn.</h2>
            <p style={body}>Thiết bị. Ứng dụng. Luyện tập.<br />Một hệ sinh thái cho cuộc sống chủ động hơn.</p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginTop: 6 }}>
              <Link className="cine-cta" href="/san-pham" style={ctaPrimary}>Khám phá sản phẩm</Link>
              <Link className="cine-cta-ghost" href="/ung-dung" style={ctaGhost}>Khám phá ứng dụng</Link>
            </div>
          </div>
        </div>

        {/* "Xem hành trình" target: one screen into the journey, as in the design */}
        <span id="hanh-trinh" aria-hidden="true" style={{ position: "absolute", top: "100vh", left: 0, width: 1, height: 1 }} />
      </CinematicScrollElement>
    </>
  );
}
