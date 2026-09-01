// Small shared UI atoms ported from .design-reference/admin-shared.jsx —
// kept together in one file since they're stateless, tightly related, and
// only ever used by the Admin/Care views (mirrors how the source kept them
// all in one file too).
"use client";

import type { CSSProperties, ReactNode } from "react";
import { Icon } from "./Icon";

export const inputStyle: CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  border: "1px solid var(--border-input)",
  borderRadius: 10,
  padding: "10px 12px",
  fontFamily: "var(--font-family)",
  fontSize: 13.5,
  color: "var(--text-primary)",
};

export function Avatar({ name, color, size = 34 }: { name: string; color?: string; size?: number }) {
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        background: color || "var(--bg-card-alt)",
        color: "var(--text-primary)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontWeight: 700,
        fontSize: size * 0.4,
        flexShrink: 0,
      }}
    >
      {name.charAt(0)}
    </div>
  );
}

export function Badge({ children, color, bg }: { children: ReactNode; color: string; bg: string }) {
  return (
    <span style={{ fontSize: 11.5, fontWeight: 700, color, background: bg, padding: "3px 9px", borderRadius: 999 }}>
      {children}
    </span>
  );
}

const STATUS_PILL_MAP = {
  active: ["Hoạt động", "#1E9E5E", "rgba(30,158,94,0.12)"],
  paused: ["Tạm dừng", "#B9860B", "rgba(185,134,11,0.12)"],
  inactive: ["Ngừng", "#8A93A3", "rgba(138,147,163,0.12)"],
  unactivated: ["Chưa kích hoạt", "#6B7A99", "rgba(107,122,153,0.12)"],
} as const;

export function StatusPill({ status }: { status: keyof typeof STATUS_PILL_MAP }) {
  const [label, color, bg] = STATUS_PILL_MAP[status] || STATUS_PILL_MAP.active;
  return <Badge color={color} bg={bg}>{label}</Badge>;
}

export function PrimaryBtn({ children, onClick, icon, disabled }: { children: ReactNode; onClick?: () => void; icon?: string; disabled?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 6,
        border: "none",
        background: disabled ? "var(--color-primary-tint-10)" : "var(--color-primary)",
        color: disabled ? "var(--color-primary)" : "#fff",
        borderRadius: 10,
        padding: "9px 16px",
        fontFamily: "var(--font-family)",
        fontSize: 13,
        fontWeight: 600,
        cursor: disabled ? "default" : "pointer",
      }}
    >
      {icon ? <Icon name={icon} size={14} color={disabled ? "var(--color-primary)" : "#fff"} /> : null}
      {children}
    </button>
  );
}

export function GhostBtn({ children, onClick, color, disabled }: { children: ReactNode; onClick?: () => void; color?: string; disabled?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        border: "1px solid var(--border-input)",
        background: "none",
        color: color || "var(--text-primary)",
        borderRadius: 8,
        padding: "6px 12px",
        fontFamily: "var(--font-family)",
        fontSize: 12.5,
        fontWeight: 600,
        cursor: disabled ? "default" : "pointer",
        opacity: disabled ? 0.5 : 1,
      }}
    >
      {children}
    </button>
  );
}

export function FieldLabel({ children }: { children: ReactNode }) {
  return <div style={{ fontSize: 12.5, fontWeight: 700, color: "var(--text-secondary)", marginBottom: 6 }}>{children}</div>;
}

/** Small pill-button tab switcher — the same visual convention already
 * used ad hoc throughout Admin/Care (product switcher, subTab rows, market
 * tabs), pulled out as one shared piece for the new per-market/per-language
 * edit forms so it isn't rebuilt 4 times. Generic over the tab key type so
 * callers can use string unions like `"vn" | "us" | "malay"`. */
export function PillTabs<T extends string>({ options, value, onChange }: { options: Array<[T, string]>; value: T; onChange: (value: T) => void }) {
  return (
    <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
      {options.map(([key, label]) => (
        <button
          key={key}
          type="button"
          onClick={() => onChange(key)}
          style={{
            border: value === key ? "none" : "1px solid var(--border-input)",
            background: value === key ? "var(--color-primary)" : "#fff",
            color: value === key ? "#fff" : "var(--text-primary)",
            borderRadius: 999,
            padding: "7px 14px",
            fontFamily: "var(--font-family)",
            fontWeight: 600,
            fontSize: 12.5,
            cursor: "pointer",
          }}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

/** Top-row market dropdown ("Thị trường: VN ▾") for views that manage each
 * market's content separately (Products, Routine). Generic over the market
 * key type the caller uses ("VN"|"US"|"MALAY" vs "vn"|"us"|"malay"). */
export function MarketSelect<T extends string>({ options, value, onChange }: { options: Array<[T, string]>; value: T; onChange: (value: T) => void }) {
  return (
    <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 600, color: "var(--text-secondary)" }}>
      Thị trường:
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as T)}
        style={{ ...inputStyle, width: "auto", padding: "8px 10px", fontWeight: 700, color: "var(--text-primary)", background: "#fff", cursor: "pointer" }}
      >
        {options.map(([key, label]) => (
          <option key={key} value={key}>{label}</option>
        ))}
      </select>
    </label>
  );
}

export function SectionCard({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <div style={{ background: "#fff", borderRadius: 16, padding: 22, boxShadow: "var(--shadow-card)" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <div style={{ fontWeight: 700, fontSize: 16, color: "var(--text-primary)" }}>{title}</div>
        {action}
      </div>
      {children}
    </div>
  );
}

export function EmptyState({ item }: { item: { icon: string; label: string } }) {
  return (
    <div style={{ background: "#fff", borderRadius: 16, padding: "64px 24px", boxShadow: "var(--shadow-card)", display: "flex", flexDirection: "column", alignItems: "center", gap: 12, textAlign: "center" }}>
      <div style={{ width: 56, height: 56, borderRadius: 16, background: "var(--color-primary-tint-10)", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Icon name={item.icon} size={26} color="var(--color-primary)" />
      </div>
      <div style={{ fontWeight: 700, fontSize: 17, color: "var(--text-primary)" }}>{item.label}</div>
      <div style={{ fontSize: 13.5, color: "var(--text-secondary)", maxWidth: 320 }}>
        Mục quản lý này đang được thiết kế chi tiết. Cho tôi biết bạn cần những thao tác cụ thể nào ở đây.
      </div>
    </div>
  );
}

export function Stars({ n }: { n: number }) {
  return (
    <div style={{ display: "flex", gap: 2 }}>
      {Array.from({ length: 5 }).map((_, i) => (
        <Icon key={i} name="star" size={14} color={i < n ? "#FF9F0A" : "var(--border-input)"} />
      ))}
    </div>
  );
}

export function StatCard({ icon, label, value, delta, tint }: { icon: string; label: string; value: ReactNode; delta?: string; tint: string }) {
  const isNegative = delta?.startsWith("-");
  return (
    <div style={{ background: "#fff", borderRadius: 16, padding: "20px 22px", boxShadow: "var(--shadow-card)", flex: 1, minWidth: 200 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ width: 40, height: 40, borderRadius: 12, background: tint, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Icon name={icon} size={19} color="var(--color-primary-dark)" />
        </div>
        {delta ? (
          <div style={{ display: "flex", alignItems: "center", gap: 3, fontSize: 12, fontWeight: 700, color: isNegative ? "var(--error)" : "#1E9E5E" }}>
            <Icon name="trending-up" size={13} color={isNegative ? "var(--error)" : "#1E9E5E"} />
            {delta}
          </div>
        ) : null}
      </div>
      <div style={{ fontSize: 28, fontWeight: 700, color: "var(--text-primary)", marginTop: 14 }}>{value}</div>
      <div style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 2 }}>{label}</div>
    </div>
  );
}

export function WeekChart({ data }: { data: number[] }) {
  const days = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 14, height: 140, marginTop: 18 }}>
      {data.map((v, i) => (
        <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
          <div
            style={{
              width: "100%",
              height: Math.max(v, 0.06) * 110,
              borderRadius: 6,
              background: v >= 1 ? "var(--color-primary)" : v > 0 ? "var(--color-primary-light)" : "var(--bg-card-alt)",
            }}
          />
          <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{days[i]}</span>
        </div>
      ))}
    </div>
  );
}
