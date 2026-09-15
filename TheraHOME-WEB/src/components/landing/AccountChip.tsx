"use client";

// The signed-in half of the nav, ported from auth-state.js: the Đăng Ký /
// Đăng Nhập pair is replaced by an account chip whose menu offers the
// training area and sign-out.
//
// One addition the design could not have: staff. An admin or CSKH who is
// browsing the public site gets a "Bảng điều khiển" entry back into their own
// shell — the site has a single login, so the same person really can be on
// either side of it.
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { initials, type LandingSession } from "@/components/landing/useLandingSession";

export function AccountChip({
  session,
  signOut,
}: {
  session: LandingSession;
  signOut: () => Promise<void>;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const staffHome = session.roles.includes("admin") ? "/admin" : session.roles.includes("cskh") ? "/care" : null;

  async function handleSignOut() {
    if (busy) return;
    setBusy(true);
    try {
      await signOut();
      setOpen(false);
      router.push("/");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  const item: React.CSSProperties = {
    display: "block",
    padding: "10px 12px",
    borderRadius: 10,
    fontSize: 13.5,
    color: "rgba(255,255,255,0.82)",
  };

  return (
    <div
      onPointerEnter={() => setOpen(true)}
      onPointerLeave={() => setOpen(false)}
      style={{ position: "relative", display: "flex", alignItems: "center", gap: 9, padding: "5px 6px 5px 5px", borderRadius: 999, border: "1px solid rgba(255,255,255,0.16)", cursor: "pointer" }}
    >
      <span style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 30, height: 30, borderRadius: 999, background: "linear-gradient(160deg,#1E90FF,#0059B3)", color: "#fff", fontSize: 12, fontWeight: 700, letterSpacing: "0.02em", flex: "0 0 auto" }}>
        {initials(session.name)}
      </span>
      <span style={{ fontSize: 13, color: "rgba(255,255,255,0.88)", maxWidth: 130, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {session.name || "Tài khoản"}
      </span>
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="2.2" aria-hidden="true" style={{ transition: "transform 240ms cubic-bezier(0.16,1,0.3,1)", transform: open ? "rotate(180deg)" : "none" }}>
        <path d="M6 9l6 6 6-6" />
      </svg>

      {/* invisible bridge so the pointer can reach the menu without :hover dropping */}
      <span aria-hidden="true" style={{ position: "absolute", left: 0, right: 0, top: "100%", height: 16 }} />

      <div
        style={{ position: "absolute", top: "calc(100% + 14px)", right: 0, minWidth: 208, padding: 8, borderRadius: 16, background: "rgba(8,14,26,0.97)", border: "1px solid rgba(255,255,255,0.12)", boxShadow: "0 30px 70px rgba(0,20,60,0.55)", backdropFilter: "blur(16px)", opacity: open ? 1 : 0, visibility: open ? "visible" : "hidden", transform: open ? "translateY(0)" : "translateY(-6px)", transition: "opacity 200ms ease-out, transform 240ms cubic-bezier(0.16,1,0.3,1), visibility 200ms" }}
      >
        {staffHome ? (
          <>
            <Link href={staffHome} className="nav-menu-item" style={item}>Bảng điều khiển</Link>
            <span aria-hidden="true" style={{ display: "block", height: 1, margin: "6px 10px", background: "rgba(255,255,255,0.1)" }} />
          </>
        ) : null}
        <Link href="/luyen-tap" className="nav-menu-item" style={item}>Luyện tập</Link>
        <span aria-hidden="true" style={{ display: "block", height: 1, margin: "6px 10px", background: "rgba(255,255,255,0.1)" }} />
        <button type="button" onClick={handleSignOut} disabled={busy} className="nav-menu-item" style={{ ...item, width: "100%", textAlign: "left", border: "none", background: "transparent", fontFamily: "inherit", cursor: busy ? "default" : "pointer" }}>
          {busy ? "Đang đăng xuất..." : "Đăng xuất"}
        </button>
      </div>
    </div>
  );
}
