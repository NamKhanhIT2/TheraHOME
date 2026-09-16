"use client";

// Site footer. The design ships two variants — a four-column one on the home
// page and a compact row on App.dc.html — so this takes a `compact` flag
// instead of being duplicated.
//
// The policy links point at the app's own public legal pages, which already
// exist and are what the stores were given: /privacy and /terms. The design's
// placeholder "#" hrefs would have shipped dead links.
//
// The contact block and the social links are edited in Admin → Nội dung
// website. This is a client component (it is rendered inside /luyen-tap, which
// is one), so it reads them from context rather than fetching.
import Link from "next/link";
import { BrandMark } from "@/components/landing/BrandMark";
import { useSiteContent } from "@/components/landing/SiteContentProvider";

function Wordmark({ size = 18, withLogo = true }: { size?: number; withLogo?: boolean }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 10, color: "#fff" }}>
      {withLogo ? <BrandMark size={26} /> : null}
      <span style={{ display: "inline-flex", alignItems: "baseline", fontSize: size, lineHeight: 1, fontWeight: 600, letterSpacing: "-0.005em", color: "#8FC7E8" }}>
        TheraHome
      </span>
    </span>
  );
}

export function LandingFooter({ compact = false }: { compact?: boolean }) {
  const { contact, social } = useSiteContent();
  const SOCIAL = [
    { href: social.facebook, label: "Facebook" },
    { href: social.youtube, label: "YouTube" },
  ];
  if (compact) {
    return (
      <footer style={{ padding: "clamp(56px, 8vh, 90px) clamp(20px, 4vw, 64px) 44px", borderTop: "1px solid rgba(255,255,255,0.08)" }}>
        <div style={{ maxWidth: 1240, margin: "0 auto", display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 20 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <Wordmark withLogo={false} />
            <span style={{ fontSize: 13, color: "rgba(255,255,255,0.6)" }}>Operated by H-COMMERCE GLOBAL COMPANY LIMITED</span>
          </div>
          <div style={{ display: "flex", gap: 26, fontSize: 13, flexWrap: "wrap" }}>
            <Link href="/" style={{ color: "rgba(255,255,255,0.72)" }}>Trang chủ</Link>
            <Link href="/san-pham" style={{ color: "rgba(255,255,255,0.72)" }}>Sản phẩm</Link>
            {SOCIAL.map((s) => (
              <a key={s.href} href={s.href} target="_blank" rel="noreferrer" style={{ color: "rgba(255,255,255,0.72)" }}>{s.label}</a>
            ))}
          </div>
        </div>
      </footer>
    );
  }

  return (
    <footer id="ve-chung-toi" style={{ position: "relative", padding: "clamp(72px, 10vh, 120px) clamp(20px, 4vw, 64px) 48px", borderTop: "1px solid rgba(255,255,255,0.08)" }}>
      <div className="reveal-scope" style={{ maxWidth: 1240, margin: "0 auto", display: "flex", flexDirection: "column", gap: "clamp(40px, 6vh, 64px)" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "clamp(28px, 3vw, 48px)" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <Wordmark />
            <span style={{ fontSize: 13, lineHeight: 1.6, color: "rgba(255,255,255,0.6)" }}>Operated by H-COMMERCE GLOBAL COMPANY LIMITED</span>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <h3 style={{ margin: 0, fontSize: 12, letterSpacing: "0.16em", textTransform: "uppercase", color: "rgba(255,255,255,0.5)" }}>Về chúng tôi</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 10, fontSize: 14 }}>
              <Link href="/gioi-thieu" style={{ color: "rgba(255,255,255,0.78)" }}>Giới thiệu</Link>
              <Link href="/gioi-thieu#lien-he" style={{ color: "rgba(255,255,255,0.78)" }}>Liên hệ</Link>
              <Link href="/gioi-thieu#blog" style={{ color: "rgba(255,255,255,0.78)" }}>Blog</Link>
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <h3 style={{ margin: 0, fontSize: 12, letterSpacing: "0.16em", textTransform: "uppercase", color: "rgba(255,255,255,0.5)" }}>Chính sách của chúng tôi</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 10, fontSize: 14 }}>
              <Link href="/privacy" style={{ color: "rgba(255,255,255,0.78)" }}>Chính sách bảo mật</Link>
              <Link href="/terms" style={{ color: "rgba(255,255,255,0.78)" }}>Điều khoản sử dụng</Link>
              <Link href="/account-deletion" style={{ color: "rgba(255,255,255,0.78)" }}>Xoá tài khoản</Link>
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <h3 style={{ margin: 0, fontSize: 12, letterSpacing: "0.16em", textTransform: "uppercase", color: "rgba(255,255,255,0.5)" }}>Cần trợ giúp?</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, fontSize: 14, lineHeight: 1.6, color: "rgba(255,255,255,0.7)" }}>
              <span>{contact.address}</span>
              <a href={contact.phoneHref} style={{ color: "rgba(255,255,255,0.7)" }}>{contact.phone}</a>
              <a href={`mailto:${contact.email}`} style={{ color: "rgba(255,255,255,0.7)" }}>{contact.email}</a>
              <span>{contact.hours}</span>
            </div>
          </div>
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 16, paddingTop: 28, borderTop: "1px solid rgba(255,255,255,0.07)" }}>
          <span style={{ fontSize: 13, color: "rgba(255,255,255,0.55)" }}>Copyright © 2026 TheraHome. All Rights Reserved.</span>
          <div style={{ display: "flex", gap: 24, fontSize: 13 }}>
            {SOCIAL.map((s) => (
              <a key={s.href} href={s.href} target="_blank" rel="noreferrer" style={{ color: "rgba(255,255,255,0.7)" }}>{s.label}</a>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
