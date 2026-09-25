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
  async redirects() {
    return [
      // The web training area is gone (owner 2026-09-25: "bỏ tab luyện tập
      // trên web ... dùng trên điện thoại đủ rồi"). Customers who bookmarked
      // /luyen-tap land on the app page instead of a 404, which is where they
      // get the app the training now lives in. Temporary on purpose: this is a
      // product decision, not a permanent move of that URL.
      { source: "/luyen-tap", destination: "/app", permanent: false },
      { source: "/luyen-tap/:path*", destination: "/app", permanent: false },
    ];
  },
};

export default nextConfig;
