"use client";

// The Sản phẩm hero: a 600vh scroll track with a sticky 100vh stage, where
// scrolling drives a WebGL demonstration of the device's four therapies
// (<hero-scroll>, ported verbatim to public/landing/hero-scroll.js).
//
// It refuses to render the track unless the product photo is actually there.
// /landing/device.png could not be pulled from the design project (256 KiB cap
// — see public/landing/README.md), and without the texture the scene stays
// blank: the visitor would meet six screens of empty scrolling with the copy
// pinned in the middle. So the image is probed first, and a plain one-screen
// hero with the same words is shown instead. Drop the file in and the full
// choreography appears with no code change.
import { createElement, useEffect, useState } from "react";
import type { CSSProperties } from "react";
import Script from "next/script";
import { LandingButton } from "@/components/landing/LandingButton";

const DEVICE_IMG = "/landing/device.png";

/** The four beats the scroll drives, in the order hero-scroll.js lights them. */
const BEATS = [
  { at: 0.30, label: "Massage", text: "Cụm bi massage bắt đầu rung theo từng nhóm." },
  { at: 0.58, label: "Xung điện EMS", text: "Hai điện cực phát xung, nối thành một mạch khép kín." },
  { at: 0.72, label: "Nhiệt sâu", text: "Hơi ấm lan dần trên bề mặt tiếp xúc." },
];

// <hero-scroll> is registered by the plain script in
// public/landing/hero-scroll.js. Rather than augmenting the JSX namespace for
// one element (which the lint config rejects, rightly — module augmentation
// for a single local tag is a lot of global surface), it is created through
// createElement, which needs no intrinsic-element declaration at all.
function HeroScrollElement(props: { parallax: string; energy: string; vibration: string; style: CSSProperties }) {
  return createElement("hero-scroll", props);
}

function HeroCopy({ compact }: { compact?: boolean }) {
  return (
    <>
      <span style={{ fontSize: 11, letterSpacing: "0.2em", textTransform: "uppercase", color: "var(--color-primary)", animation: "landingFade 1.2s cubic-bezier(0.16,1,0.3,1) 0.8s both" }}>
        Bộ giải pháp chủ động ngay tại nhà
      </span>
      <h1 style={{ margin: 0, maxWidth: 420, color: "#fff", fontSize: "clamp(32px, 3.6vw, 56px)", fontWeight: 600, lineHeight: 1.02, letterSpacing: "-0.015em", textWrap: "pretty" }}>
        {["Tạm biệt đau cổ", "tái đi tái lại."].map((line, i) => (
          <span key={line} style={{ display: "block", overflow: "hidden", paddingBottom: "0.06em" }}>
            <span style={{ display: "block", animation: `landingLine 1.1s cubic-bezier(0.16,1,0.3,1) ${0.9 + i * 0.15}s both` }}>{line}</span>
          </span>
        ))}
      </h1>
      <p style={{ margin: 0, maxWidth: 400, fontSize: 16, lineHeight: 1.6, color: "rgba(255,255,255,0.66)", animation: "landingFade 1.2s cubic-bezier(0.16,1,0.3,1) 1.4s both" }}>
        +10.000 khách hàng Việt Nam hài lòng.
      </p>
      {compact ? (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 16, paddingTop: 8, pointerEvents: "auto", animation: "landingFade 1.2s cubic-bezier(0.16,1,0.3,1) 1.6s both" }}>
          <LandingButton href="#mua-hang">Xem bộ giải pháp</LandingButton>
          <LandingButton href="#lieu-phap-4" variant="secondary">4 liệu pháp</LandingButton>
        </div>
      ) : null}
    </>
  );
}

export function ProductScrollHero() {
  const [deviceReady, setDeviceReady] = useState<boolean | null>(null);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const img = new Image();
    img.onload = () => setDeviceReady(true);
    img.onerror = () => setDeviceReady(false);
    img.src = DEVICE_IMG;
  }, []);

  // Mirror the track's own progress so the beat caption tracks the WebGL
  // choreography. hero-scroll.js computes the same ratio internally; reading
  // it here keeps the caption in step without reaching into the element.
  useEffect(() => {
    if (!deviceReady) return;
    const track = document.querySelector<HTMLElement>("[data-scroll-track]");
    if (!track) return;
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const r = track.getBoundingClientRect();
        const span = Math.max(1, track.offsetHeight - window.innerHeight);
        setProgress(Math.max(0, Math.min(1, -r.top / span)));
      });
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(raf);
    };
  }, [deviceReady]);

  // Still probing — render the static shape so there is no layout jump.
  if (deviceReady !== true) {
    return (
      <section style={{ position: "relative", minHeight: "calc(100svh - var(--nav-h, 84px) - 52px)", display: "flex", flexDirection: "column", justifyContent: "center", gap: 20, padding: "0 clamp(20px, 4vw, 64px)", overflow: "hidden", background: "#02030B" }}>
        <div aria-hidden="true" style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse 60% 55% at 64% 48%, rgba(0,80,180,0.10), rgba(0,0,0,0) 70%)" }} />
        <div style={{ position: "relative", display: "flex", flexDirection: "column", gap: 20 }}>
          <HeroCopy compact />
        </div>
      </section>
    );
  }

  const beat = [...BEATS].reverse().find((b) => progress >= b.at);
  const finalOn = progress > 0.86;

  return (
    <>
      <Script src="/landing/hero-scroll.js" strategy="afterInteractive" />
      <div data-scroll-track="true" style={{ position: "relative", height: "600vh", background: "#02030B" }}>
        <section style={{ position: "sticky", top: 0, height: "100vh", overflow: "hidden", background: "#02030B" }}>
          <div aria-hidden="true" style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse 60% 55% at 64% 48%, rgba(0,80,180,0.10), rgba(0,0,0,0) 70%)" }} />

          <HeroScrollElement parallax="true" energy="1" vibration="1" style={{ position: "absolute", inset: 0 }} />

          {/* headline — fades out as the demonstration takes over */}
          <div style={{ position: "absolute", inset: 0, zIndex: 2, display: "flex", flexDirection: "column", justifyContent: "center", gap: 20, padding: "0 clamp(20px, 4vw, 64px)", pointerEvents: "none", opacity: finalOn ? 0 : Math.max(0, 1 - progress / 0.28), transition: "opacity 240ms linear", willChange: "opacity" }}>
            <HeroCopy />
          </div>

          {/* running caption for whichever therapy is playing */}
          <div style={{ position: "absolute", left: "clamp(20px, 4vw, 64px)", bottom: "clamp(64px, 12vh, 120px)", zIndex: 2, display: "flex", flexDirection: "column", gap: 12, maxWidth: "min(300px, 28vw)", opacity: beat && !finalOn ? 1 : 0, transition: "opacity 320ms ease-out", pointerEvents: "none" }}>
            <span style={{ fontSize: 11, letterSpacing: "0.2em", textTransform: "uppercase", color: "var(--color-primary)" }}>{beat?.label ?? ""}</span>
            <p style={{ margin: 0, fontSize: 17, lineHeight: 1.5, color: "rgba(255,255,255,0.82)" }}>{beat?.text ?? ""}</p>
          </div>

          {/* closing frame */}
          <div style={{ position: "absolute", inset: 0, zIndex: 2, display: "flex", flexDirection: "column", justifyContent: "center", gap: 28, padding: "0 clamp(20px, 4vw, 64px)", opacity: finalOn ? 1 : 0, transition: "opacity 400ms ease-out", pointerEvents: finalOn ? "auto" : "none" }}>
            <h2 style={{ margin: 0, maxWidth: 440, color: "#fff", fontSize: "clamp(28px, 3vw, 44px)", fontWeight: 600, lineHeight: 1.05, letterSpacing: "-0.015em" }}>
              Kéo giãn 26°, xung điện EMS, nhiệt sâu và massage — trong một thiết bị.
            </h2>
            <div style={{ display: "flex" }}>
              <LandingButton href="#mua-hang">Xem bộ giải pháp</LandingButton>
            </div>
          </div>

          {/* scroll hint, gone once the visitor has started */}
          <div style={{ position: "absolute", left: "clamp(20px, 4vw, 64px)", bottom: 32, zIndex: 2, display: "flex", alignItems: "center", gap: 10, fontSize: 12, letterSpacing: "0.16em", textTransform: "uppercase", color: "rgba(255,255,255,0.5)", opacity: progress > 0.04 ? 0 : 1, transition: "opacity 300ms ease-out", pointerEvents: "none" }}>
            <span>Cuộn xuống</span>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="M12 5v14M6 13l6 6 6-6" />
            </svg>
          </div>
        </section>
      </div>
    </>
  );
}
