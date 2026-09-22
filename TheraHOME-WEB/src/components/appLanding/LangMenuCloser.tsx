"use client";

import { useEffect } from "react";

/** The language menu is a native <details> so it works without JavaScript,
 * but <details> only closes when its own summary is clicked. This adds what
 * people expect from a dropdown: a click or tap anywhere outside it, or
 * Escape, closes it. */
export function LangMenuCloser() {
  useEffect(() => {
    const menus = () => Array.from(document.querySelectorAll<HTMLDetailsElement>("details.al-lang[open]"));
    const onPointer = (e: PointerEvent) => {
      for (const menu of menus()) {
        if (!menu.contains(e.target as Node)) menu.open = false;
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      for (const menu of menus()) {
        menu.open = false;
        menu.querySelector("summary")?.focus();
      }
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, []);
  return null;
}
