"use client";

// admin.jsx and care.jsx in the design source are near-identical shells
// (sidebar nav + topbar search/bell + logout), differing only in nav items,
// badge/initial/email copy, and which views map to which tab id. Unified
// into one parameterized shell here rather than kept as two ~90%-duplicate
// copies. Also folds in the Admin <-> CSKH switcher (for accounts holding
// both roles, via useWebAccess()) into the existing sidebar footer instead
// of a separate bar, since the source only ever designed one logout area.
import { useState, type ReactNode } from "react";
import { useWebAccess } from "@/components/AccessGate";
import { pushToast, ToastHost } from "@/components/ui/Toast";
import { Icon } from "@/components/ui/Icon";
import { HEADER_ACCESSORY_SLOT_ID } from "@/components/shell/HeaderAccessory";
import type { NavItem } from "@/lib/adminMockData";

export function AppShell({
  badgeLabel,
  userInitial,
  userRoleLabel,
  navItems,
  initialActive,
  children,
}: {
  badgeLabel: string;
  userInitial: string;
  userRoleLabel: string;
  navItems: NavItem[];
  initialActive: string;
  children: (active: string, setActive: (id: string) => void) => ReactNode;
}) {
  const { roles, email, signOut } = useWebAccess();
  const [active, setActive] = useState(initialActive);
  const [openSubmenus, setOpenSubmenus] = useState<Record<string, boolean>>({});
  const item = navItems.flatMap((n) => n.children?.length ? [n, ...n.children] : [n]).find((n) => n.id === active) || navItems[0];
  const hasBothRoles = roles.includes("admin") && roles.includes("cskh");

  return (
    <div style={{ display: "flex", height: "100vh", fontFamily: "var(--font-family)", background: "var(--bg-app)" }}>
      <div style={{ width: 260, flexShrink: 0, background: "#fff", borderRight: "1px solid var(--divider)", display: "flex", flexDirection: "column" }}>
        <div style={{ padding: "22px 20px", display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ fontSize: 19, fontWeight: 700, color: "var(--text-primary)" }}>TheraHOME</div>
          <span style={{ fontSize: 11, fontWeight: 700, color: "var(--color-primary)", background: "var(--color-primary-tint-10)", padding: "2px 8px", borderRadius: 999 }}>
            {badgeLabel}
          </span>
        </div>
        <div style={{ flex: 1, overflowY: "auto", padding: "4px 12px" }}>
          {navItems.map((n) => {
            const hasChildren = !!n.children?.length;
            const isActive = n.id === active || n.children?.some((child) => child.id === active);
            const submenuOpen = openSubmenus[n.id] ?? false;
            return (
              <div key={n.id}>
                <button
                  onClick={() => {
                    if (hasChildren) {
                      setOpenSubmenus((current) => ({ ...current, [n.id]: !(current[n.id] ?? false) }));
                    } else setActive(n.id);
                  }}
                  aria-expanded={hasChildren ? submenuOpen : undefined}
                  style={{
                    width: "100%", display: "flex", alignItems: "center", gap: 12, border: "none",
                    background: isActive ? "var(--color-primary-tint-10)" : "none",
                    color: isActive ? "var(--color-primary)" : "var(--text-primary)", borderRadius: 10,
                    padding: "10px 12px", fontFamily: "var(--font-family)", fontSize: 14,
                    fontWeight: isActive ? 700 : 500, cursor: "pointer", textAlign: "left", marginBottom: hasChildren ? 1 : 2,
                  }}
                >
                  <Icon name={n.icon} size={18} color={isActive ? "var(--color-primary)" : "var(--text-secondary)"} />
                  <span style={{ flex: 1 }}>{n.label}</span>
                  {hasChildren ? <span style={{ display: "inline-flex", transform: submenuOpen ? "rotate(180deg)" : "none", transition: "transform 160ms ease" }}><Icon name="chevron-down" size={14} color={isActive ? "var(--color-primary)" : "var(--text-muted)"} /></span> : null}
                </button>
                {hasChildren && submenuOpen ? <div style={{ margin: "1px 0 5px 38px", display: "flex", flexDirection: "column", gap: 2 }}>
                  {n.children!.map((child) => {
                    const childActive = active === child.id;
                    return <button key={child.id} onClick={() => { setActive(child.id); setOpenSubmenus((current) => ({ ...current, [n.id]: true })); }} style={{ border: "none", background: childActive ? "var(--color-primary-tint-10)" : "none", color: childActive ? "var(--color-primary)" : "var(--text-secondary)", borderRadius: 8, padding: "7px 10px", textAlign: "left", fontFamily: "var(--font-family)", fontSize: 12.5, fontWeight: childActive ? 700 : 500, cursor: "pointer" }}>{child.label}</button>;
                  })}
                </div> : null}
              </div>
            );
          })}
        </div>
        <div style={{ borderTop: "1px solid var(--divider)", padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
          {hasBothRoles ? (
            <a
              href={badgeLabel === "Admin" ? "/care" : "/admin"}
              style={{ display: "flex", alignItems: "center", gap: 8, fontFamily: "var(--font-family)", fontSize: 12.5, fontWeight: 600, color: "var(--color-primary)", textDecoration: "none" }}
            >
              <Icon name="link-2" size={14} color="var(--color-primary)" />
              Chuyển sang {badgeLabel === "Admin" ? "CSKH" : "Admin"}
            </a>
          ) : null}
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 34, height: 34, borderRadius: 10, background: "var(--color-primary-tint-10)", color: "var(--color-primary)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700 }}>
              {userInitial}
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {email}
              </div>
              <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{userRoleLabel}</div>
            </div>
          </div>
          <button
            onClick={() => {
              pushToast("Đang đăng xuất...");
              signOut();
            }}
            style={{ display: "flex", alignItems: "center", gap: 8, border: "none", background: "none", color: "var(--error)", fontFamily: "var(--font-family)", fontSize: 13.5, fontWeight: 600, cursor: "pointer", padding: 0 }}
          >
            <Icon name="log-out" size={16} color="var(--error)" />
            Đăng xuất
          </button>
        </div>
      </div>
      <div style={{ flex: 1, overflowY: "auto" }}>
        <div style={{ position: "sticky", top: 0, background: "var(--bg-app)", zIndex: 5, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "22px 32px 16px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16, minWidth: 0 }}>
            <div style={{ fontSize: 22, fontWeight: 700, color: "var(--text-primary)" }}>{item.label}</div>
            {/* Views portal controls in here via <HeaderAccessory> (e.g. the
                market dropdown next to "Sản Phẩm"/"Lộ trình"). */}
            <div id={HEADER_ACCESSORY_SLOT_ID} style={{ display: "flex", alignItems: "center", gap: 12 }} />
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, background: "#fff", border: "1px solid var(--border-input)", borderRadius: 10, padding: "8px 12px", width: 240 }}>
              <Icon name="search" size={15} color="var(--text-muted)" />
              <input placeholder="Tìm kiếm..." style={{ border: "none", outline: "none", flex: 1, fontFamily: "var(--font-family)", fontSize: 13 }} />
            </div>
            <div style={{ width: 38, height: 38, borderRadius: 10, background: "#fff", border: "1px solid var(--border-input)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Icon name="bell" size={16} color="var(--text-secondary)" />
            </div>
          </div>
        </div>
        <div style={{ padding: "0 32px 40px" }}>{children(active, setActive)}</div>
      </div>
      <ToastHost />
    </div>
  );
}
