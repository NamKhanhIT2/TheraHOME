"use client";

// Fixed top nav for the public site. Ported from the shared <nav> block that
// every *.dc.html page in the design repeats verbatim — here it is one
// component and the active link is derived from the route instead of being
// hand-marked per page.
//
// Two host-specific things were translated rather than copied: the design's
// checkbox+label burger (a CSS-only toggle, because the design host runs no
// JS) is React state, and lang.js's localStorage picker is a hook. The
// hover/focus choreography stays in CSS (src/styles/landing.css) exactly as
// designed — it is all :hover/:focus-within and needs no JS.
import { Fragment, useEffect, useState, useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { BrandMark } from "@/components/landing/BrandMark";
import { AccountChip } from "@/components/landing/AccountChip";
import { useLandingSession } from "@/components/landing/useLandingSession";
import { LANG_LABEL, getLangSnapshot, getLangServerSnapshot, setLang, subscribeLang, type Lang } from "@/lib/langPreference";

export const NAV_LINKS = [
  { href: "/", label: "Trang chủ" },
  { href: "/san-pham", label: "Sản phẩm", dropdown: true },
  { href: "/gioi-thieu", label: "Về chúng tôi" },
] as const;

/** The design's own auth screen, now built: /dang-nhap and /dang-ky. The staff
 * entrances (/welcome, /thera-login) stay where they are — they are reached
 * from the console, not from the public site. */
const SIGN_IN = "/dang-nhap";
const SIGN_UP = "/dang-ky";

function Chevron({ size = 10, width = 1.6 }: { size?: number; width?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth={width} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M2.5 4.5 6 8l3.5-3.5" />
    </svg>
  );
}

function ProductsDropdown({ current }: { current: boolean }) {
  return (
    <div className={"nav-dd" + (current ? " nav-dd-current" : "")} style={{ position: "relative", display: "flex", alignItems: "center" }}>
      <Link href="/san-pham" style={{ display: "inline-flex", alignItems: "center", gap: 6, color: current ? "#fff" : "rgba(255,255,255,0.72)" }}>
        Sản phẩm
        <Chevron />
      </Link>
      {/* padding-top bridges the gap to the trigger so the pointer can travel
          into the panel without :hover dropping */}
      <div className="nav-dd-panel" style={{ position: "absolute", top: "100%", left: "50%", transform: "translate(-50%, 6px)", paddingTop: 49, opacity: 0, visibility: "hidden", transition: "opacity 180ms ease-out, transform 180ms ease-out" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 240, padding: 10, borderRadius: 18, background: "rgba(8,14,26,0.96)", border: "1px solid rgba(255,255,255,0.1)", boxShadow: "0 26px 60px rgba(0,0,0,0.55)", backdropFilter: "blur(16px)" }}>
          <Link href="/san-pham" style={{ display: "flex", flexDirection: "column", gap: 3, padding: "12px 14px", borderRadius: 12, color: "#fff" }}>
            <span style={{ fontSize: 14, fontWeight: 600 }}>TheraNECK+</span>
            <span style={{ fontSize: 13, color: "rgba(255,255,255,0.68)" }}>Máy trị liệu cổ 4 trong 1</span>
          </Link>
          <span style={{ padding: "10px 14px 4px", fontSize: 11.5, letterSpacing: "0.12em", textTransform: "uppercase", color: "rgba(255,255,255,0.5)" }}>
            Sắp có thêm sản phẩm
          </span>
        </div>
      </div>
    </div>
  );
}

function LanguagePicker() {
  // useSyncExternalStore, not state+effect: see src/lib/langPreference.ts.
  const lang = useSyncExternalStore(subscribeLang, getLangSnapshot, getLangServerSnapshot);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(""), 2600);
    return () => clearTimeout(t);
  }, [notice]);

  function pick(next: Lang) {
    setLang(next);
    // Copy is Vietnamese-only for now — say so rather than half-switching.
    setNotice(next === "en" ? "English is coming soon — content is Vietnamese for now." : "Đã chuyển sang Tiếng Việt.");
  }

  return (
    <>
      <div className="nav-lang" tabIndex={0} style={{ position: "relative", display: "flex", alignItems: "center", gap: 7, fontSize: 13, color: "rgba(255,255,255,0.72)", cursor: "default" }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
          <circle cx="12" cy="12" r="9" />
          <path d="M3 12h18M12 3c2.5 2.6 2.5 15.4 0 18M12 3c-2.5 2.6-2.5 15.4 0 18" />
        </svg>
        <span>{LANG_LABEL[lang]}</span>
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true">
          <path d="M6 9l6 6 6-6" />
        </svg>
        <div className="nav-lang-panel" style={{ position: "absolute", top: "calc(100% + 14px)", left: -12, minWidth: 186, padding: 8, borderRadius: 16, background: "rgba(8,14,26,0.97)", border: "1px solid rgba(255,255,255,0.12)", boxShadow: "0 30px 70px rgba(0,20,60,0.55)", backdropFilter: "blur(16px)", opacity: 0, visibility: "hidden", transform: "translateY(-6px)", transition: "opacity 200ms ease-out, transform 240ms cubic-bezier(0.16,1,0.3,1), visibility 200ms" }}>
          {(["vi", "en"] as const).map((code) => {
            const on = lang === code;
            return (
              <button
                key={code}
                type="button"
                onClick={() => pick(code)}
                style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14, width: "100%", padding: "9px 12px", borderRadius: 10, fontSize: 13.5, fontFamily: "inherit", textAlign: "left", cursor: "pointer", border: "none", color: on ? "#fff" : "rgba(255,255,255,0.72)", background: on ? "rgba(0,127,217,0.16)" : "transparent" }}
              >
                <span>{LANG_LABEL[code]}</span>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#4FB0F5" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: on ? 1 : 0, flex: "0 0 auto" }} aria-hidden="true">
                  <path d="M5 12.5 10 17l9-10" />
                </svg>
              </button>
            );
          })}
        </div>
      </div>
      {notice ? (
        <div role="status" style={{ position: "fixed", left: "50%", bottom: 28, transform: "translateX(-50%)", zIndex: 60, padding: "12px 18px", borderRadius: 999, background: "rgba(8,14,26,0.96)", border: "1px solid rgba(255,255,255,0.14)", color: "#fff", fontSize: 13.5, boxShadow: "0 20px 50px rgba(0,20,60,0.5)", pointerEvents: "none" }}>
          {notice}
        </div>
      ) : null}
    </>
  );
}

export function LandingNav() {
  const pathname = usePathname();
  const { signOut, ...session } = useLandingSession();
  const [menuOpen, setMenuOpen] = useState(false);
  // The sheet closes from the links themselves rather than an effect on
  // pathname: Next keeps this layout mounted across navigations, so an open
  // sheet would otherwise cover the page you just navigated to.
  const closeMenu = () => setMenuOpen(false);

  const isCurrent = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

  const renderLink = (link: (typeof NAV_LINKS)[number]) =>
    "dropdown" in link && link.dropdown ? (
      <ProductsDropdown current={isCurrent(link.href)} />
    ) : (
      <Link href={link.href} className={isCurrent(link.href) ? "nav-links-current" : undefined} style={{ color: isCurrent(link.href) ? "#fff" : "rgba(255,255,255,0.72)" }}>
        {link.label}
      </Link>
    );

  return (
    <>
      <nav style={{ position: "fixed", top: 0, left: 0, right: 0, zIndex: 20, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 24, padding: "22px clamp(20px, 4vw, 64px)", background: "rgba(2,3,11,0.72)", backdropFilter: "blur(14px)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        <Link className="nav-logo" href="/" aria-label="TheraHome — về trang chủ" style={{ display: "inline-flex", alignItems: "center", gap: 11, color: "#fff" }}>
          <BrandMark size={30} glow />
          <span style={{ display: "inline-flex", alignItems: "baseline", fontSize: 19, lineHeight: 1, fontWeight: 600, letterSpacing: "-0.005em", color: "#8FC7E8" }}>TheraHome</span>
        </Link>

        <div className="nav-links" style={{ display: "flex", gap: "clamp(16px, 2.2vw, 40px)", fontSize: 13, letterSpacing: "0.06em" }}>
          {NAV_LINKS.map((link) => (
            <Fragment key={link.href}>{renderLink(link)}</Fragment>
          ))}
        </div>

        <div className="nav-account" style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <LanguagePicker />
          {/* null while the session is still resolving — showing "Đăng Nhập"
              and then swapping it for the account chip is a visible flicker on
              every page load for a signed-in customer. */}
          {session.signedIn === null ? null : session.signedIn ? (
            <>
              <span aria-hidden="true" style={{ width: 1, height: 18, background: "rgba(255,255,255,0.22)" }} />
              <AccountChip session={session} signOut={signOut} />
            </>
          ) : (
            <>
              <span aria-hidden="true" style={{ width: 1, height: 18, background: "rgba(255,255,255,0.22)" }} />
              <Link href={SIGN_UP} className="nav-auth" style={{ fontSize: 13.5, fontWeight: 600, letterSpacing: "0.02em", color: "#fff" }}>Đăng Ký</Link>
              <span aria-hidden="true" style={{ width: 1, height: 18, background: "rgba(255,255,255,0.22)" }} />
              <Link href={SIGN_IN} className="nav-auth" style={{ fontSize: 13.5, fontWeight: 600, letterSpacing: "0.02em", color: "#fff" }}>Đăng Nhập</Link>
            </>
          )}
        </div>

        <button
          type="button"
          className="nav-burger"
          aria-label="Menu"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((open) => !open)}
          style={{ display: "none", alignItems: "center", justifyContent: "center", width: 40, height: 40, borderRadius: 999, border: "1px solid rgba(255,255,255,0.14)", background: "transparent", cursor: "pointer" }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
            {menuOpen ? <path d="M6 6l12 12M18 6 6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
          </svg>
        </button>

        {menuOpen ? (
          <div className="nav-mobile" style={{ display: "flex", position: "fixed", left: 0, right: 0, top: 84, flexDirection: "column", gap: 4, padding: "14px clamp(20px, 4vw, 64px) 20px", background: "rgba(8,14,26,0.97)", borderBottom: "1px solid rgba(255,255,255,0.1)", backdropFilter: "blur(16px)" }}>
            <Link href="/" onClick={closeMenu} style={{ padding: "12px 4px", fontSize: 15, color: "rgba(255,255,255,0.86)" }}>Trang chủ</Link>
            <span style={{ padding: "12px 4px 4px", fontSize: 11.5, letterSpacing: "0.14em", textTransform: "uppercase", color: "rgba(255,255,255,0.55)" }}>Sản phẩm</span>
            <Link href="/san-pham" onClick={closeMenu} style={{ padding: "10px 4px 10px 18px", fontSize: 15, color: "rgba(255,255,255,0.86)" }}>TheraNECK+</Link>
            <Link href="/gioi-thieu" onClick={closeMenu} style={{ padding: "12px 4px", fontSize: 15, color: "rgba(255,255,255,0.86)" }}>Về chúng tôi</Link>
            <span style={{ height: 1, margin: "8px 0", background: "rgba(255,255,255,0.1)" }} />
            {session.signedIn ? (
              <button type="button" onClick={() => { closeMenu(); void signOut(); }} style={{ padding: "12px 4px", fontSize: 15, fontWeight: 600, color: "#fff", background: "transparent", border: "none", textAlign: "left", fontFamily: "inherit", cursor: "pointer" }}>
                Đăng xuất
              </button>
            ) : (
              <>
                <Link href={SIGN_IN} onClick={closeMenu} style={{ padding: "12px 4px", fontSize: 15, fontWeight: 600, color: "#fff" }}>Đăng Nhập</Link>
                <Link href={SIGN_UP} onClick={closeMenu} style={{ padding: "12px 4px", fontSize: 15, fontWeight: 600, color: "#7FBFFF" }}>Đăng Ký</Link>
              </>
            )}
          </div>
        ) : null}
      </nav>
      <div aria-hidden="true" style={{ height: 84 }} />
    </>
  );
}
