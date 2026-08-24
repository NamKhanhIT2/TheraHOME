"use client";

import type { ReactNode } from "react";
import { Icon } from "./Icon";

export function TableShell({
  subtitle,
  action,
  searchPlaceholder,
  searchValue,
  onSearchChange,
  filterOptions,
  filterValue,
  onFilterChange,
  columns,
  children,
  modals,
}: {
  subtitle?: string;
  action?: ReactNode;
  searchPlaceholder?: string;
  /** Controlled search input — omit to leave it decorative (pre-existing behavior). */
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  filterOptions?: string[];
  /** Controlled filter select — omit to leave it decorative (pre-existing behavior). */
  filterValue?: string;
  onFilterChange?: (value: string) => void;
  columns: string[];
  /** `<tr>` rows only — this ends up inside `<tbody>`, so nothing else
   * (modals, floating pickers, ...) belongs here. Use `modals` instead. */
  children: ReactNode;
  /** Rendered as a sibling after the table, not inside `<tbody>`. A `<div>`
   * (which every `Modal` in this app renders as its backdrop) is invalid
   * HTML inside `<tbody>` — React warns about it and it causes a hydration
   * mismatch. Every caller that opens a modal from a table row should pass
   * it here, not inline in `children`. */
  modals?: ReactNode;
}) {
  return (
    <div>
      {subtitle || action ? (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
          <div style={{ fontSize: 13.5, color: "var(--text-secondary)" }}>{subtitle}</div>
          {action}
        </div>
      ) : null}
      <div style={{ background: "#fff", borderRadius: 16, boxShadow: "var(--shadow-card)", overflow: "hidden" }}>
        {searchPlaceholder || filterOptions ? (
          <div style={{ display: "flex", gap: 12, padding: 20, borderBottom: "1px solid var(--divider)" }}>
            {searchPlaceholder ? (
              <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 8, border: "1px solid var(--border-input)", borderRadius: 10, padding: "10px 14px" }}>
                <Icon name="search" size={16} color="var(--text-muted)" />
                <input
                  placeholder={searchPlaceholder}
                  value={searchValue}
                  onChange={(e) => onSearchChange?.(e.target.value)}
                  style={{ border: "none", outline: "none", flex: 1, fontFamily: "var(--font-family)", fontSize: 13.5 }}
                />
              </div>
            ) : null}
            {filterOptions ? (
              <select
                value={filterValue}
                onChange={(e) => onFilterChange?.(e.target.value)}
                style={{ border: "1px solid var(--border-input)", borderRadius: 10, padding: "10px 14px", fontFamily: "var(--font-family)", fontSize: 13.5, color: "var(--text-primary)", minWidth: 200 }}
              >
                {filterOptions.map((o) => (
                  <option key={o}>{o}</option>
                ))}
              </select>
            ) : null}
          </div>
        ) : null}
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13.5 }}>
          <thead>
            <tr style={{ textAlign: "left", color: "var(--text-muted)", fontSize: 12, textTransform: "uppercase" }}>
              {columns.map((c) => (
                <th key={c} style={{ padding: "14px 20px" }}>{c}</th>
              ))}
            </tr>
          </thead>
          <tbody>{children}</tbody>
        </table>
      </div>
      {modals}
    </div>
  );
}
