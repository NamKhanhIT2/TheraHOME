"use client";

import { useEffect } from "react";

/** Fades [data-reveal] elements in as they scroll into view.
 *
 * The page is complete without this: nothing is hidden in the server HTML, so
 * with JavaScript off, for a crawler, or for a thumbnail every section is
 * simply there. On mount only elements still BELOW the fold are parked, then
 * released by an IntersectionObserver — whatever is already on screen never
 * blinks out. `data-reveal-delay` (ms) staggers siblings. Reduced motion
 * skips the whole thing. */
export function Reveal() {
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (!("IntersectionObserver" in window)) return;

    const nodes = Array.from(document.querySelectorAll<HTMLElement>("[data-reveal]"));
    const fold = window.innerHeight * 0.92;
    const pending = nodes.filter((el) => el.getBoundingClientRect().top > fold);

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const el = entry.target as HTMLElement;
          el.style.transitionDelay = `${el.dataset.revealDelay ?? 0}ms`;
          el.classList.add("is-in");
          observer.unobserve(el);
        }
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.12 },
    );

    for (const el of pending) {
      el.classList.add("is-pending");
      observer.observe(el);
    }
    return () => observer.disconnect();
  }, []);

  return null;
}
