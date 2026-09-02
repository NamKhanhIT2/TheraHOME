import type { NextConfig } from "next";

// Baseline security headers (2026-09-02 security audit, item 18):
// HSTS, clickjacking/MIME-sniffing protection, and a conservative
// referrer/permissions policy. No CSP yet — the app inlines styles and
// loads user images from Supabase Storage, so a strict CSP needs its own
// measured pass rather than a blanket header here.
const securityHeaders = [
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

const nextConfig: NextConfig = {
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
