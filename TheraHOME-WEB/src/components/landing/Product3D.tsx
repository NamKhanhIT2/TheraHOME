"use client";

// The product in real 3D: orbit it, zoom it, and on Android open it in the
// room. Google's <model-viewer> over the owner's own .glb.
//
// The lighting is not guesswork. The pane in this environment returns black
// screenshots, so the settings below were chosen by rendering the model and
// reading the canvas back with toDataURL — four environment/exposure/tone
// combinations composited on the page's own #02030B and compared. `legacy` and
// `agx` came out washed out and flat against a dark ground; `neutral` at
// exposure 1.15 held the teal and the detail, so that is what ships.
//
// The .glb renders on a TRANSPARENT background, which is why this sits
// straight on the page with no light plinth — unlike the turntable video,
// whose studio backdrop needed a panel around it.
//
// Product360 is the fallback, not a leftover: WebGL can be missing or blocked,
// and a customer who gets nothing sees no product at all. The turntable is
// 0.36 MB and always works, so it stands in whenever 3D cannot.
import { createElement, useEffect, useState } from "react";
import Script from "next/script";
import { Product360 } from "@/components/landing/Product360";

const MODEL_VIEWER = "https://ajax.googleapis.com/ajax/libs/model-viewer/4.0.0/model-viewer.min.js";
const SRC = "/landing/product/theraneck.glb";
const POSTER = "/landing/product/theraneck-3d-poster.png";

/** Does this browser have a GPU we can draw on at all? */
function hasWebGL(): boolean {
  try {
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl2") || c.getContext("webgl"));
  } catch {
    return false;
  }
}

type Mode = "checking" | "3d" | "fallback";

export function Product3D({ label }: { label: string }) {
  const [mode, setMode] = useState<Mode>("checking");

  useEffect(() => {
    if (!hasWebGL()) {
      setMode("fallback");
      return;
    }
    // The custom element arrives with the CDN module. Give it a window to
    // register and fall back rather than leaving an empty box if the CDN is
    // blocked — which it is, on some corporate and national networks.
    if (customElements.get("model-viewer")) {
      setMode("3d");
      return;
    }
    let done = false;
    customElements.whenDefined("model-viewer").then(() => {
      if (!done) {
        done = true;
        setMode("3d");
      }
    });
    const timer = setTimeout(() => {
      if (!done) {
        done = true;
        setMode("fallback");
      }
    }, 8000);
    return () => {
      done = true;
      clearTimeout(timer);
    };
  }, []);

  if (mode === "fallback") return <Product360 label={label} />;

  return (
    <>
      <Script src={MODEL_VIEWER} type="module" strategy="afterInteractive" />
      <div className="p3d">
        {createElement("model-viewer", {
          src: SRC,
          poster: POSTER,
          alt: `${label} — mô hình 3D, kéo để xoay`,
          "camera-controls": true,
          "touch-action": "pan-y",
          "auto-rotate": true,
          "auto-rotate-delay": "2200",
          "rotation-per-second": "18deg",
          "interaction-prompt": "none",
          "environment-image": "neutral",
          "tone-mapping": "neutral",
          exposure: "1.15",
          "shadow-intensity": "1",
          "shadow-softness": "1",
          "camera-orbit": "38deg 74deg 105%",
          "min-camera-orbit": "auto auto 60%",
          "max-camera-orbit": "auto auto 160%",
          "field-of-view": "28deg",
          // Android gets "view it in your room" from the .glb directly. iOS
          // Quick Look needs a .usdz we do not have, so it simply will not
          // offer the button there rather than offering a broken one.
          ar: true,
          "ar-modes": "webxr scene-viewer",
          loading: "eager",
          className: "p3d-viewer",
        })}

        <span aria-hidden="true" className="p3d-hint">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
            <path d="M8 7 4 11l4 4M16 7l4 4-4 4M4.5 11h15" />
          </svg>
          Kéo để xoay · cuộn để phóng to
        </span>
      </div>
    </>
  );
}
