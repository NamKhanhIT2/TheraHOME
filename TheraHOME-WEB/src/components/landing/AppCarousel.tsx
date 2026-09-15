"use client";

// 3D ring carousel of the App Store panels — port of carousel.js.
//
// The design frames each card in a dark phone bezel because it was showing
// bare screen captures. Ours are the finished App Store panels, which already
// carry their own device mockup on a branded background, so the bezel is gone:
// a frame inside a frame reads as a mistake. The card keeps the panel's own
// 0.462 aspect so nothing is cropped.
//
// Rotation and per-card facing are driven in one rAF loop rather than by CSS
// animation, because each card must be hidden once it turns away:
// backface-visibility is unreliable on cards that use overflow:hidden, which
// these do to clip the screenshots into their rounded frames.
//
// Dropped from the original: the MutationObserver that re-found the ring after
// the design host swapped nodes mid-render. React owns this subtree, so the
// ref is stable and there is nothing to re-find.
import { useEffect, useRef } from "react";

export interface CarouselCard {
  src: string;
  alt: string;
}

const RADIUS = 300;
const DEG_PER_MS = 0.0105; // ~34s per full turn
const FRAME_MS = 32; // ~30fps is plenty for a slow rotation

export function AppCarousel({ cards }: { cards: CarouselCard[] }) {
  const ringRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<HTMLDivElement>(null);
  const pausedRef = useRef(false);

  useEffect(() => {
    const ring = ringRef.current;
    const scene = sceneRef.current;
    if (!ring || !scene) return;

    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const cardEls = Array.from(ring.children) as HTMLElement[];
    const n = cardEls.length;
    if (!n) return;
    const step = 360 / n;

    // Place each card once — only the ring's own rotation changes per frame.
    cardEls.forEach((el, i) => {
      el.style.transform = `rotateY(${i * step}deg) translateZ(${RADIUS}px) translateY(-50%)`;
    });

    let visible = true;
    const io = new IntersectionObserver((e) => { visible = e[0].isIntersecting; }, { threshold: 0 });
    io.observe(scene);

    let base = 0;
    let last = performance.now();
    let lastDraw = 0;
    let raf = 0;

    const frame = (now: number) => {
      const dt = Math.min(now - last, 100);
      last = now;
      if (visible && !pausedRef.current && !reduced) base -= dt * DEG_PER_MS;

      if (visible && now - lastDraw > FRAME_MS) {
        lastDraw = now;
        ring.style.transform = `rotateY(${base}deg)`;
        for (let i = 0; i < n; i++) {
          const facing = Math.cos(((base + i * step) * Math.PI) / 180);
          const el = cardEls[i];
          const op = facing > 0.08 ? Math.min(1, 0.35 + facing).toFixed(2) : "0";
          if (el.dataset.op !== op) {
            el.dataset.op = op;
            el.style.opacity = op;
            el.style.zIndex = String(Math.round(facing * 100));
          }
        }
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
    };
  }, [cards.length]);

  return (
    <div
      ref={sceneRef}
      className="app-carousel"
      onPointerEnter={() => { pausedRef.current = true; }}
      onPointerLeave={() => { pausedRef.current = false; }}
      onFocus={() => { pausedRef.current = true; }}
      onBlur={() => { pausedRef.current = false; }}
      style={{ position: "relative", overflow: "hidden", height: "min(520px, 132vw)", perspective: 1700, WebkitMaskImage: "linear-gradient(90deg, transparent, #000 16%, #000 84%, transparent)", maskImage: "linear-gradient(90deg, transparent, #000 16%, #000 84%, transparent)" }}
    >
      <div ref={ringRef} className="app-ring" style={{ position: "absolute", left: "50%", top: 0, width: 184, height: "100%", marginLeft: -92, transformStyle: "preserve-3d" }}>
        {cards.map((c, i) => (
          <div
            key={`${c.src}-${i}`}
            style={{ position: "absolute", left: "50%", top: "50%", width: 184, marginLeft: -92, aspectRatio: "0.462", borderRadius: 18, overflow: "hidden", boxShadow: "0 24px 60px rgba(0,30,80,0.5)", opacity: 0, transition: "opacity 220ms linear" }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- fixed 184px card inside a 3D ring; next/image manages neither */}
            <img
              src={c.src}
              alt={c.alt}
              loading={i === 0 ? undefined : "lazy"}
              decoding="async"
              onError={(e) => { e.currentTarget.style.display = "none"; }}
              style={{ position: "absolute", inset: 0, display: "block", width: "100%", height: "100%", objectFit: "contain" }}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
