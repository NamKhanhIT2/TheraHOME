"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/** The "see the app" strip, as a coverflow: the panel nearest the centre is
 * full size, its neighbours shrink and fade with distance. It is still a
 * native scroll-snap strip underneath — swipe, trackpad and keyboard all work,
 * and with JavaScript off it is simply a row of panels.
 *
 * Autoplay advances one panel every few seconds, loops, and stops for good
 * the moment the visitor touches, scrolls, clicks or focuses it (their hand
 * wins), and pauses while the strip is off screen or the tab is hidden.
 * Reduced motion: no autoplay. */
export function AppGallery({
  images,
  prevLabel,
  nextLabel,
  dotLabel,
}: {
  images: { src: string; alt: string }[];
  prevLabel: string;
  nextLabel: string;
  /** "{n}" is replaced with the panel number. */
  dotLabel: string;
}) {
  const track = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  const activeRef = useRef(0);
  const userTookOver = useRef(false);
  const visible = useRef(false);

  const items = () => Array.from(track.current?.querySelectorAll<HTMLElement>(".al-cf-item") ?? []);

  const goTo = useCallback((index: number) => {
    const el = track.current;
    const list = Array.from(el?.querySelectorAll<HTMLElement>(".al-cf-item") ?? []);
    const target = list[(index + list.length) % list.length];
    if (!el || !target) return;
    el.scrollTo({ left: target.offsetLeft - (el.clientWidth - target.offsetWidth) / 2, behavior: "smooth" });
  }, []);

  // Depth: scale / fade each panel by its distance from the centre.
  useEffect(() => {
    const el = track.current;
    if (!el) return;
    let frame = 0;
    const paint = () => {
      frame = 0;
      const centre = el.scrollLeft + el.clientWidth / 2;
      let nearest = 0;
      let best = Infinity;
      items().forEach((item, i) => {
        const d = (item.offsetLeft + item.offsetWidth / 2 - centre) / item.offsetWidth;
        const a = Math.min(Math.abs(d), 2.2);
        item.style.setProperty("--cf-scale", String(1 - a * 0.12));
        item.style.setProperty("--cf-fade", String(1 - a * 0.28));
        item.style.setProperty("--cf-tilt", `${Math.max(-1, Math.min(1, d)) * -10}deg`);
        item.style.zIndex = String(10 - Math.round(a * 3));
        if (Math.abs(d) < best) { best = Math.abs(d); nearest = i; }
      });
      activeRef.current = nearest;
      setActive(nearest);
    };
    const onScroll = () => { if (!frame) frame = requestAnimationFrame(paint); };
    paint();
    el.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      el.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      cancelAnimationFrame(frame);
    };
  }, []);

  // Start centred on the first panel.
  useEffect(() => {
    const el = track.current;
    const first = items()[0];
    if (el && first) el.scrollLeft = first.offsetLeft - (el.clientWidth - first.offsetWidth) / 2;
  }, []);

  // Autoplay.
  useEffect(() => {
    const el = track.current;
    if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const stop = () => { userTookOver.current = true; };
    const events = ["pointerdown", "wheel", "touchstart", "keydown", "focusin"] as const;
    events.forEach((e) => el.addEventListener(e, stop, { passive: true }));
    const io = new IntersectionObserver(([entry]) => { visible.current = entry.isIntersecting; }, { threshold: 0.4 });
    io.observe(el);
    const timer = window.setInterval(() => {
      if (userTookOver.current || !visible.current || document.hidden) return;
      goTo(activeRef.current + 1);
    }, 3200);
    return () => {
      events.forEach((e) => el.removeEventListener(e, stop));
      io.disconnect();
      window.clearInterval(timer);
    };
  }, [goTo]);

  const press = (index: number) => {
    userTookOver.current = true;
    goTo(index);
  };

  return (
    <div className="al-cf">
      <div className="al-cf-track" ref={track}>
        {images.map((img) => (
          <div className="al-cf-item" key={img.src}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={img.src} alt={img.alt} width={853} height={1844} loading="lazy" draggable={false} />
          </div>
        ))}
      </div>
      <div className="al-cf-controls">
        <button type="button" className="al-nm-round" aria-label={prevLabel} onClick={() => press(active - 1)}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m15 6-6 6 6 6" /></svg>
        </button>
        <div className="al-cf-dots">
          {images.map((img, i) => (
            <button
              key={img.src}
              type="button"
              className={i === active ? "is-on" : ""}
              aria-label={dotLabel.replace("{n}", String(i + 1))}
              aria-current={i === active ? "true" : undefined}
              onClick={() => press(i)}
            />
          ))}
        </div>
        <button type="button" className="al-nm-round" aria-label={nextLabel} onClick={() => press(active + 1)}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m9 6 6 6-6 6" /></svg>
        </button>
      </div>
    </div>
  );
}
