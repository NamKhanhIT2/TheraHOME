"use client";

// The logo image. Thin wrapper over SafeImg so /landing/logo.png missing (see
// public/landing/README.md) shows the wordmark alone rather than a broken
// image box — and so the footer can stay a server component, which it could
// not if it passed the fallback handler itself.
import { SafeImg } from "@/components/landing/SafeImg";

export function BrandMark({ size, glow = false }: { size: number; glow?: boolean }) {
  return (
    <SafeImg
      src="/landing/logo.png"
      style={{
        width: size,
        height: size,
        display: "block",
        ...(glow ? { filter: "drop-shadow(0 0 12px rgba(0,127,217,0.45))" } : null),
      }}
    />
  );
}
