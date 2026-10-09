"use client";

// The console's own shell.
//
// Not AppShell: that one is the light Admin/CSKH chrome, with a white sidebar
// and an Admin ⇄ CSKH switcher this surface has no use for. Keeping them apart
// means /admin and /care are untouched by anything done here, and this surface
// can be dark without a theme flag threaded through a shared component.
//
// Layout lives in agentConsole.css rather than in inline styles, because the
// console has to fold down to a phone: below 940px the sidebar becomes a
// scrolling strip across the top and the page scrolls as one document.
import { useState, type ReactNode } from "react";
import Link from "next/link";
import { Icon } from "@/components/ui/Icon";
import { ToastHost } from "@/components/ui/Toast";
import { useConsole } from "@/components/agent/state";

import "@/styles/agentConsole.css";

export interface ConsoleNavItem {
  id: string;
  label: string;
  icon: string;
  /** Page subtitle, shown under the title in the topbar. */
  blurb: string;
}

export interface ConsoleNavGroup {
  label: string;
  items: ConsoleNavItem[];
}

const d = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;

/** Decoration, and only decoration: ribbons of the three accents behind the
 * header. It sits under the header's content, is blurred and faint enough that
 * nothing has to compete with it, takes no pointer events and is hidden from
 * assistive tech. */
function HeaderRibbons() {
  return (
    <div className="ac-head-deco" aria-hidden="true">
      <svg viewBox="0 0 1200 130" preserveAspectRatio="none" style={{ width: "100%", height: "100%", display: "block" }}>
        <defs>
          <linearGradient id="ac-rib-1" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#22d3ee" stopOpacity="0" />
            <stop offset="38%" stopColor="#22d3ee" stopOpacity="0.85" />
            <stop offset="72%" stopColor="#8b5cf6" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#ec4899" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="ac-rib-2" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#8b5cf6" stopOpacity="0" />
            <stop offset="52%" stopColor="#ec4899" stopOpacity="0.7" />
            <stop offset="100%" stopColor="#fb923c" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="ac-rib-3" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#8b5cf6" stopOpacity="0" />
            <stop offset="60%" stopColor="#8b5cf6" stopOpacity="0.55" />
            <stop offset="100%" stopColor="#22d3ee" stopOpacity="0" />
          </linearGradient>
          <filter id="ac-rib-blur" x="-10%" y="-60%" width="120%" height="220%">
            <feGaussianBlur stdDeviation="5" />
          </filter>
        </defs>
        <g filter="url(#ac-rib-blur)" opacity="0.62">
          <path d="M-60,104 C200,18 380,128 640,58 C860,-2 1010,96 1260,30" fill="none" stroke="url(#ac-rib-1)" strokeWidth="2.6" />
          <path d="M-60,126 C220,54 420,142 680,80 C900,26 1040,118 1260,58" fill="none" stroke="url(#ac-rib-2)" strokeWidth="2" />
          <path d="M-60,80 C240,-6 440,96 700,34 C920,-18 1060,70 1260,8" fill="none" stroke="url(#ac-rib-3)" strokeWidth="1.6" />
        </g>
      </svg>
    </div>
  );
}

/** Picks the span of days the whole console reads.
 *
 * Three real windows, not an open calendar: the figures behind them are a
 * snapshot taken on 2026-10-09, and offering a free date range would promise
 * data this app cannot fetch. When the connectors land, this becomes a date
 * range and the rest of the console does not change. */
function WindowPicker() {
  const { metrics, windowId, setWindowId } = useConsole();
  const [open, setOpen] = useState(false);
  const windows = metrics?.windows ?? [];
  const current = windows.find((w) => w.id === windowId) ?? windows[0];
  // Nothing to pick between until the figures are read. Rendering a disabled
  // chip with made-up dates would be worse than rendering nothing.
  if (!current) return null;

  return (
    <div
      style={{ position: "relative" }}
      onKeyDown={(e) => {
        if (e.key === "Escape") setOpen(false);
      }}
      onBlur={(e) => {
        // Closes when focus leaves the button AND the menu, so keyboard users
        // are not trapped and a click elsewhere dismisses it.
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOpen(false);
      }}
    >
      <button
        type="button"
        className="ac-range"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <Icon name="calendar" size={14} color="var(--ac-accent)" />
        <span>{current.label}</span>
        <span className="ac-range-dates">{d(current.from)} – {d(current.to)}</span>
        <Icon name="chevron-down" size={13} color="var(--ac-ink-3)" />
      </button>

      {open ? (
        <div className="ac-range-menu" role="listbox" aria-label="Khoảng thời gian">
          {windows.map((w) => (
            <button
              key={w.id}
              type="button"
              role="option"
              aria-selected={w.id === windowId}
              className="ac-range-option"
              onClick={() => {
                setWindowId(w.id);
                setOpen(false);
              }}
            >
              <span>{w.label}</span>
              <span className="ac-range-dates">{d(w.from)} – {d(w.to)}</span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function AgentShell({
  groups,
  initialActive,
  account,
  roleLabel,
  onSignOut,
  children,
}: {
  groups: ConsoleNavGroup[];
  initialActive: string;
  /** Who is signed in, for the sidebar footer. */
  account: string;
  roleLabel: string;
  onSignOut: () => void;
  children: (active: string, setActive: (id: string) => void) => ReactNode;
}) {
  const { openApprovals, metrics } = useConsole();
  const capturedAt = metrics?.capturedAt ?? null;
  const [active, setActive] = useState(initialActive);

  const flat = groups.flatMap((g) => g.items);
  const current = flat.find((i) => i.id === active) ?? flat[0];

  return (
    <div className="agent-console ac-shell">
      <aside className="ac-side">
        <div style={{ padding: "20px 20px 14px", display: "flex", alignItems: "center", gap: 11 }}>
          <span className="ac-brand-mark" style={{ width: 36, height: 36, borderRadius: 12, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 13, flex: "0 0 auto" }}>
            TH
          </span>
          <span style={{ minWidth: 0 }}>
            <span style={{ display: "block", fontSize: 14.5, fontWeight: 700, color: "var(--ac-ink)", lineHeight: 1.2 }}>Trung tâm điều hành</span>
            <span style={{ display: "block", fontSize: 11.5, color: "var(--ac-ink-3)" }}>Đội AI TheraHOME</span>
          </span>
        </div>

        <nav className="ac-side-nav">
          {groups.map((g) => (
            <div key={g.label}>
              <div className="ac-nav-group">{g.label}</div>
              {g.items.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className="ac-nav-item"
                  aria-current={active === item.id ? "page" : undefined}
                  onClick={() => setActive(item.id)}
                >
                  <Icon name={item.icon} size={17} color={active === item.id ? "var(--ac-accent)" : "var(--ac-ink-3)"} />
                  <span style={{ flex: 1, minWidth: 0 }}>{item.label}</span>
                  {item.id === "approvals" && openApprovals.length ? (
                    <span className="ac-nav-count">{openApprovals.length}</span>
                  ) : null}
                </button>
              ))}
            </div>
          ))}
        </nav>

        <div className="ac-side-foot">
          <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
            <span style={{ width: 32, height: 32, flex: "0 0 auto", borderRadius: 10, background: "var(--ac-accent-soft)", color: "var(--ac-accent)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 12 }}>
              H
            </span>
            <span style={{ minWidth: 0 }}>
              <span style={{ display: "block", fontSize: 12.5, fontWeight: 600, color: "var(--ac-ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{account}</span>
              <span style={{ display: "block", fontSize: 11.5, color: "var(--ac-ink-3)" }}>{roleLabel}</span>
            </span>
          </div>
          <button
            type="button"
            onClick={onSignOut}
            style={{ display: "flex", alignItems: "center", gap: 8, border: "none", background: "none", color: "var(--ac-crit)", fontFamily: "var(--font-family)", fontSize: 13, fontWeight: 600, cursor: "pointer", padding: 0, whiteSpace: "nowrap" }}
          >
            <Icon name="log-out" size={15} color="var(--ac-crit)" />
            Đăng xuất
          </button>
        </div>
      </aside>

      <div className="ac-main">
        <header className="ac-head">
          <HeaderRibbons />
          <div className="ac-head-inner">
            <div style={{ minWidth: 0 }}>
              <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: "var(--ac-ink)", letterSpacing: "-0.02em" }}>{current.label}</h1>
              <p style={{ margin: "2px 0 0", fontSize: 12.5, color: "var(--ac-ink-3)" }}>{current.blurb}</p>
            </div>

            <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              <WindowPicker />
              {capturedAt ? (
                <span title="Thời điểm số liệu được đọc từ Meta và Pancake" style={{ fontSize: 12, color: "var(--ac-ink-3)" }}>
                  đọc {d(capturedAt.slice(0, 10))}
                </span>
              ) : null}

              <Link href="/" className="ac-icon-btn" title="Về trang chủ TheraHOME" aria-label="Về trang chủ TheraHOME">
                <Icon name="home" size={16} color="currentColor" />
              </Link>
            </div>
          </div>
        </header>

        <main className="ac-content">{children(active, setActive)}</main>
      </div>

      <ToastHost />
    </div>
  );
}
