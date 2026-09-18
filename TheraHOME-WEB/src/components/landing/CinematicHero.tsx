"use client";

// The home page opening: "Home Cinematic.dc.html" from the design project.
//
// Rewritten 2026-09-18 to follow the design's own rewrite. The first version
// cross-dissolved four stills; this one scrubs REAL FOOTAGE. Two clips shot
// through the house (approach + doors opening, then the foyer walk) are
// scrubbed frame-by-frame by scroll position, and the closing beat is a still —
// the design's note explains why: the generated footage's human motion reads
// artificial, so the gym is a photograph rather than video.
//
// Everything that moves lives in public/landing/cinematic-scroll.js (the
// design's script plus its config, merged — see that file's header). This
// component only lays out the DOM it expects.
//
// Assets: the owner's own footage and the corrected gym still, in
// public/landing/cine/ — see public/landing/README.md for provenance.
import { createElement, type CSSProperties, type ReactNode } from "react";
import Link from "next/link";
import Script from "next/script";

/** The design's source footage is 1248x704; the stage carries that aspect so
 * `object-fit: cover` fills it without cropping, which is why this revision
 * needs no letterbox fill behind the plates. */
const SOURCE_ASPECT = "1248 / 704";

/** First frame of clip 00, shown under the loading card so the opening shot is
 * on screen while 2.7 MB of video downloads. The design leaves that card flat
 * dark; on a slow connection that is several seconds of nothing at the top of
 * the home page, and since this is frame 0 of the very clip being fetched,
 * there is no jump when the video takes over. */
const POSTER = "/landing/cine/00-poster.jpg";

function CinematicScrollElement({ children }: { children: ReactNode }) {
  return createElement(
    "cinematic-scroll",
    { style: { display: "block", position: "relative", height: "860vh" } },
    children,
  );
}

const copyBase: CSSProperties = {
  position: "absolute",
  left: "clamp(84px, 9vw, 150px)",
  maxWidth: "min(700px, 62vw)",
  zIndex: 4,
  display: "flex",
  flexDirection: "column",
  gap: 16,
};

const headline: CSSProperties = {
  margin: 0,
  fontSize: "clamp(28px, 3.4vw, 50px)",
  lineHeight: 1.08,
  fontWeight: 600,
  letterSpacing: "-0.024em",
  textWrap: "balance",
  color: "#fff",
};

const body: CSSProperties = {
  margin: 0,
  fontSize: "clamp(15px, 1.15vw, 18px)",
  lineHeight: 1.55,
  color: "#fff",
  maxWidth: 460,
  textWrap: "pretty",
  textShadow: "0 1px 18px rgba(6,17,28,0.45)",
};

const cta: CSSProperties = {
  display: "inline-flex",
  alignSelf: "flex-start",
  alignItems: "center",
  height: 46,
  padding: "0 22px",
  borderRadius: 999,
  background: "var(--color-primary)",
  color: "#fff",
  fontSize: 15,
  fontWeight: 600,
  marginTop: 6,
};

/** Local darkening behind one copy column, so the footage can stay bright and
 * the words still read. Faded in and out with the copy by the script. */
function Scrim() {
  return <div data-cine-scrim aria-hidden="true" />;
}

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
        {/* The stage sticks below the site nav rather than the design's 68px
            bar. LandingNav already leaves an 84px spacer in the flow, so the
            track needs no padding of its own — only the sticky offset. */}
        <div
          data-cine-stage
          style={{
            position: "sticky",
            top: "var(--nav-h, 84px)",
            width: "100%",
            aspectRatio: SOURCE_ASPECT,
            maxHeight: "calc(100vh - var(--nav-h, 84px))",
            overflow: "hidden",
            background: "#06111C",
          }}
        >
          {/* VideoSegmentManager mounts the segment videos and the closing still here */}
          <div data-cine-videos style={{ position: "absolute", inset: 0, background: "#06111C" }} />

          <div
            data-cine-loading
            aria-hidden="true"
            style={{ position: "absolute", inset: 0, display: "flex", alignItems: "flex-end", justifyContent: "center", paddingBottom: "8%", background: `#06111C center/cover no-repeat url(${POSTER})`, transition: "opacity 450ms ease-out", zIndex: 2 }}
          >
            <span style={{ fontSize: 12, letterSpacing: "0.18em", textTransform: "uppercase", color: "rgba(255,255,255,0.72)", textShadow: "0 1px 16px rgba(6,17,28,0.8)" }}>
              TheraHOME
            </span>
          </div>

          {/* Corner tag. Not decoration: the footage carries a generator
              watermark in this exact corner, and the gradient covers it.
              Because the stage carries the source aspect, the video's own
              bottom-right corner is this one. */}
          <div
            data-cine-tag
            aria-hidden="true"
            style={{ position: "absolute", right: 0, bottom: 0, zIndex: 3, display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 11, minWidth: "clamp(230px, 20vw, 340px)", height: "clamp(74px, 7vh, 96px)", padding: "0 clamp(18px, 2vw, 34px)", background: "linear-gradient(118deg, rgba(4,12,22,0) 0%, rgba(4,12,22,0.5) 34%, rgba(4,12,22,0.88) 72%, rgba(4,12,22,0.94) 100%)", backdropFilter: "blur(14px)", WebkitBackdropFilter: "blur(14px)" }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- a 20px mark inside a decorative overlay; next/image would add a wrapper for nothing */}
            <img src="/landing/logo.png" alt="" style={{ width: 20, height: 20, display: "block", opacity: 0.9 }} />
            <span style={{ fontSize: 12, letterSpacing: "0.18em", textTransform: "uppercase", color: "rgba(255,255,255,0.86)", whiteSpace: "nowrap" }}>Sunset House</span>
          </div>

          <div data-cine-grade aria-hidden="true" style={{ position: "absolute", inset: 0, background: "linear-gradient(90deg, rgba(6,17,28,0.72) 0%, rgba(6,17,28,0.38) 42%, rgba(6,17,28,0) 70%), linear-gradient(180deg, rgba(6,17,28,0.35) 0%, rgba(6,17,28,0) 22%, rgba(6,17,28,0) 75%, rgba(6,17,28,0.45) 100%)", opacity: 0.34, pointerEvents: "none" }} />

          {/* left progress rail */}
          <div className="cine-rail" aria-hidden="true" style={{ position: "absolute", left: "clamp(18px, 2.6vw, 40px)", top: "50%", transform: "translateY(-50%)", zIndex: 5, display: "flex", gap: 14, pointerEvents: "none" }}>
            <div style={{ position: "relative", width: 1, background: "rgba(255,255,255,0.18)", margin: "8px 0" }}>
              <div data-cine-fill style={{ position: "absolute", left: 0, top: 0, width: 1, height: "100%", background: "var(--color-primary)", transform: "scaleY(0)", transformOrigin: "top", boxShadow: "0 0 8px rgba(0,127,217,0.7)" }} />
            </div>
            <ol style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 22 }}>
              <Step /><Step /><Step /><Step /><Step /><Step />
            </ol>
          </div>

          <div className="cine-copy" data-cine-copy="1" style={{ ...copyBase, top: "50%", transform: "translateY(-50%)" }}>
            <Scrim />
            <h1 style={{ ...headline, fontSize: "clamp(34px, 4.6vw, 64px)" }}>Một khởi đầu khỏe hơn<br />từ chính ngôi nhà của bạn.</h1>
            <p style={body}>Chăm sóc cơ thể tại nhà với một lộ trình rõ ràng hơn.</p>
            <Link className="cine-cta" href="/san-pham" style={cta}>Khám phá TheraHOME</Link>
          </div>

          <div className="cine-copy" data-cine-copy="2" style={{ ...copyBase, bottom: "clamp(72px, 12vh, 140px)", visibility: "hidden" }}>
            <Scrim />
            <h2 style={headline}>Bước vào<br />không gian của bạn.</h2>
            <p style={body}>Một góc nhỏ cũng có thể trở thành nơi bắt đầu.</p>
          </div>

          <div className="cine-copy" data-cine-copy="3" style={{ ...copyBase, top: "clamp(110px, 16vh, 170px)", visibility: "hidden" }}>
            <Scrim />
            <h2 style={headline}>Chăm sóc mỗi ngày.</h2>
            <p style={body}>Biến việc vận động thành một phần tự nhiên của cuộc sống.</p>
          </div>

          <div className="cine-copy" data-cine-copy="4" style={{ ...copyBase, bottom: "clamp(72px, 12vh, 140px)", visibility: "hidden" }}>
            <Scrim />
            <h2 style={headline}>Một hệ sinh thái<br />được kết nối.</h2>
            <p style={body}>Thiết bị, ứng dụng và luyện tập cùng hoạt động trong một lộ trình.</p>
          </div>

          <div className="cine-copy" data-cine-copy="5" style={{ ...copyBase, bottom: "clamp(72px, 12vh, 140px)", visibility: "hidden" }}>
            <Scrim />
            <h2 style={headline}>Thiết bị chỉ là<br />điểm bắt đầu.</h2>
            <p style={body}>Giá trị nằm ở cách mọi thứ kết nối với nhau.</p>
          </div>

          <div className="cine-copy" data-cine-copy="6" style={{ ...copyBase, top: "50%", transform: "translateY(-50%)", visibility: "hidden" }}>
            <Scrim />
            <h2 style={{ ...headline, fontSize: "clamp(32px, 4.2vw, 58px)" }}>Một cơ thể khỏe mạnh<br />là nền tảng cho những<br />điều tuyệt vời hơn.</h2>
            <Link className="cine-cta" href="/san-pham" style={cta}>Khám phá TheraHOME</Link>
          </div>
        </div>

        <span id="hanh-trinh" aria-hidden="true" style={{ position: "absolute", top: "100vh", left: 0, width: 1, height: 1 }} />
      </CinematicScrollElement>
    </>
  );
}
