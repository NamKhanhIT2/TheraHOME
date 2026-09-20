"use client";

// Drag to turn the product. The owner's 96-frame turntable render, scrubbed by
// pointer position rather than played.
//
// Why a video and not the .glb the owner also sent: a real 3D viewer needs a
// WebGL runtime and a CDN component, and its look depends on lighting this
// project would have to author — none of which could be checked here, because
// the browser pane in this environment does not paint WebGL. Shipping a
// showcase nobody had looked at was the larger risk. The turntable is the
// studio render itself, 0.36 MB, and works without WebGL. The .glb is still on
// hand if a true 3D/AR viewer is wanted later.
//
// The source clip carried ONE keyframe for all 96 frames, which would have made
// dragging backwards decode from the start every time; it is re-encoded
// all-intra (96/96 keyframes, see public/landing/README.md) so any frame is an
// instant seek in either direction.
import { useCallback, useEffect, useRef, useState } from "react";

const SRC = "/landing/product/theraneck-360.mp4";
const POSTER = "/landing/product/theraneck-360-poster.jpg";
const FRAMES = 96;
const FPS = 30;

/** The render's own studio backdrop, sampled from the frames, so the video
 * melts into the panel instead of sitting on it as a lighter square. */
const STUDIO = "#e9eae8";

export function Product360({ label }: { label: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef(0);
  const dragRef = useRef<{ x: number; frame: number } | null>(null);
  const [ready, setReady] = useState(false);
  const [touched, setTouched] = useState(false);

  /** Frames are continuous internally so a drag can run past either end; the
   * modulo happens only when choosing the time to show. */
  const show = useCallback((frame: number) => {
    frameRef.current = frame;
    const v = videoRef.current;
    if (!v || !v.duration) return;
    const wrapped = ((Math.round(frame) % FRAMES) + FRAMES) % FRAMES;
    // Half a frame in, so rounding never lands on the boundary of the next one.
    v.currentTime = Math.min((wrapped + 0.5) / FPS, v.duration - 0.001);
  }, []);

  // Metadata may already be in before React attaches anything — a warm cache
  // resolves it well before hydration. Relying on the onLoadedMetadata prop
  // alone left `ready` false for ever on exactly those loads, and since the
  // drag is gated on it the panel silently refused to turn (the arrow keys
  // still worked, which is what gave it away). Same shape as SafeImg's
  // already-failed-image check: ask the element, then listen.
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const init = () => {
      setReady(true);
      show(0);
    };
    if (v.readyState >= 1 /* HAVE_METADATA */) {
      init();
      return;
    }
    v.addEventListener("loadedmetadata", init, { once: true });
    return () => v.removeEventListener("loadedmetadata", init);
  }, [show]);

  // Idle turn, as an invitation. Stops for good at the first interaction, and
  // never starts for someone who asked for less motion.
  useEffect(() => {
    if (!ready || touched) return;
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = now - last;
      last = now;
      show(frameRef.current + (dt / 1000) * 7);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [ready, touched, show]);

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (!ready) return;
    setTouched(true);
    dragRef.current = { x: e.clientX, frame: frameRef.current };
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    const width = boxRef.current?.clientWidth ?? 0;
    if (!drag || !width) return;
    // A drag across the full width is one complete turn — the same gesture
    // distance whatever the panel size.
    show(drag.frame - ((e.clientX - drag.x) / width) * FRAMES);
  }

  function endDrag(e: React.PointerEvent<HTMLDivElement>) {
    dragRef.current = null;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
  }

  // Arrow keys turn it too: the whole point of the control is inspecting the
  // product, and that should not need a mouse.
  function onKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    e.preventDefault();
    setTouched(true);
    show(frameRef.current + (e.key === "ArrowRight" ? -4 : 4));
  }

  return (
    <div
      ref={boxRef}
      role="img"
      aria-label={`${label} — ảnh 360 độ, kéo ngang hoặc dùng phím mũi tên để xoay`}
      tabIndex={0}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onKeyDown={onKeyDown}
      className="p360"
      style={{ background: STUDIO }}
    >
      <video
        ref={videoRef}
        src={SRC}
        poster={POSTER}
        muted
        playsInline
        preload="auto"
        aria-hidden="true"
        className="p360-media"
      />

      {/* Softens the panel's edges into the page so the studio backdrop reads
          as light falling away, not as a pasted-on square. */}
      <span aria-hidden="true" className="p360-vignette" />

      <span aria-hidden="true" className={"p360-hint" + (touched ? " p360-hint-gone" : "")}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
          <path d="M8 7 4 11l4 4M16 7l4 4-4 4M4.5 11h15" />
        </svg>
        Kéo để xoay
      </span>
    </div>
  );
}
