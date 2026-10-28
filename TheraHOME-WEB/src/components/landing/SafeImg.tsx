"use client";

// A decorative <img> that removes itself if the file is not there.
//
// Two of the landing assets (logo.png, hero-bg.png) could not be pulled
// through DesignSync — see public/landing/README.md — so until someone exports
// them the page must not show broken-image boxes. Once the files land this
// component is a plain <img> and nothing else changes.
//
// onError alone is not enough: the browser starts fetching during SSR markup
// parsing, so a 404 usually resolves BEFORE React hydrates and attaches the
// handler, and the event is simply missed. The mount check covers that case —
// a decoded image always reports a non-zero naturalWidth.
import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";

export function SafeImg({
  src,
  style,
  className,
}: {
  src: string;
  style?: CSSProperties;
  className?: string;
}) {
  const ref = useRef<HTMLImageElement>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (el && el.complete && el.naturalWidth === 0) setFailed(true);
  }, []);

  if (failed) return null;

  return (
    // eslint-disable-next-line @next/next/no-img-element -- decorative art with a bespoke fallback; next/image manages neither
    <img
      ref={ref}
      src={src}
      alt=""
      aria-hidden="true"
      className={className}
      onError={() => setFailed(true)}
      // Kept as insurance for Google profile pictures, which this now also
      // serves. Google avatars did fail to render in the admin console until
      // the same header was added there — but a direct curl of one of these
      // lh3.googleusercontent.com URLs returns 200 with or without a Referer,
      // so the exact trigger is NOT pinned down and may be a browser-only
      // signal. The header costs nothing on the local assets this started out
      // serving, so it stays rather than being removed on a half-measurement.
      referrerPolicy="no-referrer"
      style={style}
    />
  );
}
