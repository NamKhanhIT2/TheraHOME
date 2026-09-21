"use client";

// The combo showcase: four objects on a coloured ground, one in focus at a
// time, the ground changing colour with it. It is a band INSIDE /san-pham,
// directly under the two offers — the combo is a bundle of this product, not
// a second product, so it does not get a page or a nav entry of its own.
//
// Built from a reference prompt the owner supplied (a figurine carousel called
// "TOONHUB", written for React + Vite + Tailwind). The EFFECT is kept — the
// per-item background cross-fade at 650ms cubic-bezier(.4,0,.2,1), the grain
// overlay, the label, the display-face buy link. Five things were translated
// rather than copied, because this host is not that host:
//
//   1. No Tailwind here. Every class below lives in src/styles/landing.css
//      under .landing-root, like p3d/p360/cine already do.
//   2. No `isMobile` state. The reference branches layout on
//      window.innerWidth; doing that in an SSR'd page means the first paint is
//      the desktop layout and the phone re-lays out after hydration. The
//      numbers that actually differ are CSS custom properties behind a media
//      query instead, so the server and the client render the same thing.
//   3. No fixed `height: 100vh`. The copy under the stage is Vietnamese and
//      its length differs per item; a fixed height plus `overflow: hidden`
//      would crop the longest one on a short laptop. The section is a flex
//      column with a min-height instead, so it fills the viewport and grows
//      only if it must.
//   4. No `new Image()` preload loop. next/image rewrites each src to
//      /_next/image?url=…&w=…, so preloading the raw file would download every
//      asset twice. All four <Image>s are in the DOM from the start (the
//      inactive ones are merely transformed and faded), so the browser already
//      fetches them; the first one carries `priority`.
//   5. The layout is the owner's, not the reference's: copy in a 3/10 column
//      on the left, the stage in the 7/10 on the right. The reference centres
//      the carousel and stacks a giant display word behind it; that word was
//      built and then removed at the owner's call (2026-09-21) — on a band in
//      the middle of a page it was reading as noise behind the product rather
//      than as type.
//
// The carousel is circular: with four items, one is always on the left and one
// on the right, and the fourth (|offset| = 2) sits off-stage at zero opacity.
import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";

interface ComboSlide {
  key: string;
  src: string;
  width: number;
  height: number;
  /** Page ground while this item is in focus. */
  bg: string;
  name: string;
  tag: string;
  points: string[];
}

const SLIDES: ComboSlide[] = [
  {
    key: "may",
    src: "/landing/combo/may.webp",
    width: 1000,
    height: 695,
    bg: "#07222E",
    name: "Máy trị liệu cổ TheraNECK+",
    tag: "Bốn liệu pháp trong một thiết bị",
    points: [
      "Kéo giãn 26° để giải nén đốt sống cổ",
      "Xung điện EMS, nhiệt sâu 40–42° và massage nhịp nhàng",
      "Mỗi buổi 15 phút, làm ngay tại nhà",
    ],
  },
  {
    key: "goi",
    src: "/landing/combo/goi.webp",
    width: 1100,
    height: 574,
    bg: "#141C2B",
    name: "Gối công thái học TheraPillow",
    tag: "Giữ đúng tư thế cổ suốt đêm",
    points: [
      "Foam định hình ôm theo đường cong tự nhiên của cổ",
      "Vùng nằm ngửa và vùng nằm nghiêng tách riêng",
      "Giữ lại kết quả của buổi trị liệu qua một đêm ngủ",
    ],
  },
  {
    key: "app",
    src: "/landing/combo/app.webp",
    width: 614,
    height: 1200,
    bg: "#061C3E",
    name: "Ứng dụng TheraAI",
    tag: "Lộ trình 14 ngày nằm trong túi bạn",
    points: [
      "Video hướng dẫn từng ngày, mở dần theo lịch",
      "Theo dõi mức đau và tiến độ sau mỗi buổi",
      "Nhắn tin với chuyên viên khi thấy bất thường",
    ],
  },
  {
    key: "dan",
    src: "/landing/combo/dan.webp",
    width: 783,
    height: 1100,
    bg: "#2A0D12",
    name: "Miếng dán thảo dược Vinh Gia",
    tag: "Làm dịu tại chỗ giữa các buổi",
    points: [
      "10 miếng 11 × 15 cm, hoàn toàn từ thảo dược",
      "Dán vào vùng cổ vai gáy những lúc mỏi nhiều",
      "Dùng xen kẽ giữa các buổi trị liệu",
    ],
  },
];

/** fractalNoise at baseFrequency 0.9 over four octaves, tiled every 200px —
 * the reference's own grain, inlined so it costs no request. */
const GRAIN =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='200' height='200' filter='url(%23n)' opacity='0.08'/%3E%3C/svg%3E\")";

/** Long enough that a double-click cannot skip two items mid-transition, short
 * enough that a deliberate second click still lands. The reference locks for
 * the full 650ms, which on a real pointer feels stuck. */
const LOCK_MS = 420;
const AUTO_MS = 3000;

/** How far from focus an item sits, and how it is drawn there. The z keeps the
 * one in focus in front: a neighbour's box still overlaps it by ~30px at the
 * widest desktop step. */
function place(off: number) {
  const dist = Math.abs(off);
  if (dist === 0) return { scale: 1, opacity: 1, z: 3 };
  if (dist === 1) return { scale: 0.54, opacity: 0.34, z: 2 };
  return { scale: 0.42, opacity: 0, z: 1 };
}

export function ComboCarousel({
  id,
  displayClass,
  buyHref,
  priceLabel,
}: {
  /** Anchor for the product page's sub-nav. */
  id?: string;
  /** Anton, loaded by the page with next/font. */
  displayClass: string;
  buyHref: string;
  priceLabel: string;
}) {
  const [active, setActive] = useState(0);
  const [touched, setTouched] = useState(false);
  const lockRef = useRef(false);
  const rootRef = useRef<HTMLElement>(null);
  const dragRef = useRef<{ x: number; y: number; moved: boolean } | null>(null);

  const go = useCallback((next: number) => {
    if (lockRef.current) return;
    lockRef.current = true;
    setTimeout(() => {
      lockRef.current = false;
    }, LOCK_MS);
    setTouched(true);
    setActive(((next % SLIDES.length) + SLIDES.length) % SLIDES.length);
  }, []);

  // Turns by itself until the visitor takes over, so the effect is visible to
  // someone who only scrolls past. Stops for good at the first interaction,
  // never runs off-screen, and never runs for someone who asked for less
  // motion — the same rules as Product360's idle turn.
  useEffect(() => {
    if (touched) return;
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const el = rootRef.current;
    if (!el) return;
    let timer: ReturnType<typeof setInterval> | null = null;
    const stop = () => {
      if (timer) clearInterval(timer);
      timer = null;
    };
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !timer) {
          timer = setInterval(() => setActive((i) => (i + 1) % SLIDES.length), AUTO_MS);
        } else if (!entry.isIntersecting) {
          stop();
        }
      },
      { threshold: 0.4 },
    );
    io.observe(el);
    return () => {
      stop();
      io.disconnect();
    };
  }, [touched]);

  function onKeyDown(e: React.KeyboardEvent<HTMLElement>) {
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      go(active - 1);
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      go(active + 1);
    }
  }

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    dragRef.current = { x: e.clientX, y: e.clientY, moved: false };
  }

  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (!drag || drag.moved) return;
    const dx = e.clientX - drag.x;
    // Only claim the gesture once it is clearly horizontal — otherwise a thumb
    // scrolling the page past the stage would flip the carousel.
    if (Math.abs(dx) < 46 || Math.abs(dx) < Math.abs(e.clientY - drag.y)) return;
    drag.moved = true;
    go(active + (dx < 0 ? 1 : -1));
  }

  function endDrag() {
    dragRef.current = null;
  }

  const slide = SLIDES[active];

  return (
    <section
      ref={rootRef}
      id={id}
      className="cmb"
      style={{ background: slide.bg }}
      onKeyDown={onKeyDown}
      aria-roledescription="carousel"
      aria-label="Bốn phần của combo phục hồi toàn diện"
    >
      <span aria-hidden="true" className="cmb-grain" style={{ backgroundImage: GRAIN }} />

      {/* 3 of 10: everything that is words. */}
      <div className="cmb-copy">
        <span className="cmb-brand">Combo phục hồi toàn diện</span>

        <span className="cmb-index">
          {String(active + 1).padStart(2, "0")} <i>/ {String(SLIDES.length).padStart(2, "0")}</i>
        </span>

        {/* All four blocks stay mounted and cross-fade, so the column's height
            never jumps between items whose copy differs in length. */}
        <div className="cmb-deck">
          {SLIDES.map((s) => (
            <div
              key={s.key}
              className={"cmb-one" + (s.key === slide.key ? " cmb-on" : "")}
              aria-hidden={s.key !== slide.key}
            >
              <h2>{s.name}</h2>
              <p>{s.tag}</p>
              <ul>
                {s.points.map((pt) => (
                  <li key={pt}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M5 12.5 10 17l9-10" />
                    </svg>
                    {pt}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="cmb-dots" role="tablist" aria-label="Chọn sản phẩm trong combo">
          {SLIDES.map((s, i) => (
            <button
              key={s.key}
              type="button"
              role="tab"
              aria-selected={i === active}
              aria-label={s.name}
              className={"cmb-dot" + (i === active ? " cmb-on" : "")}
              onClick={() => go(i)}
            />
          ))}
        </div>

        <a className={`cmb-link ${displayClass}`} href={buyHref} target="_blank" rel="noopener noreferrer">
          Mua combo · {priceLabel}
        </a>
      </div>

      {/* 7 of 10: the objects. */}
      <div
        className="cmb-stage"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        {SLIDES.map((s, i) => {
          let off = i - active;
          if (off > 2) off -= SLIDES.length;
          if (off < -2) off += SLIDES.length;
          const { scale, opacity, z } = place(off);
          const isActive = off === 0;
          return (
            <button
              key={s.key}
              type="button"
              className="cmb-item"
              style={{
                ["--off" as string]: off,
                ["--s" as string]: scale,
                ["--o" as string]: opacity,
                ["--z" as string]: z,
              }}
              onClick={() => !isActive && go(i)}
              /* Off the tab order both when it is already in focus (nothing to
                 activate) and when it is the hidden one — a focusable
                 aria-hidden element is a trap for a screen reader. */
              tabIndex={isActive || opacity === 0 ? -1 : 0}
              aria-label={`Xem ${s.name}`}
              aria-hidden={opacity === 0}
            >
              <Image
                src={s.src}
                alt={isActive ? s.name : ""}
                width={s.width}
                height={s.height}
                priority={i === 0}
                sizes="(max-width: 899px) 72vw, 440px"
                className="cmb-img"
              />
            </button>
          );
        })}
      </div>
    </section>
  );
}
