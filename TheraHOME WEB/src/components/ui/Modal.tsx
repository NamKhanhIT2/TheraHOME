"use client";

import { useRef, type ReactNode } from "react";
import { Icon } from "./Icon";

export function Modal({
  title,
  onClose,
  width = 460,
  children,
  footer,
}: {
  title: string;
  onClose: () => void;
  width?: number;
  children: ReactNode;
  footer?: ReactNode;
}) {
  // A plain `onClick={onClose}` on the backdrop closes on any click whose
  // *target* resolves to the backdrop — but a click/drag that starts inside
  // a form field (e.g. selecting text in a textarea) and releases outside
  // the modal's bounds also resolves its target to the backdrop, since
  // mousedown/mouseup landed on different elements. That silently closed
  // modals mid-edit (reported against the "Tạo tài khoản TheraHOME" form,
  // but this backdrop is shared by every modal in the app). Fix: only close
  // when the *press itself* (mousedown), not just the click, began on the
  // backdrop — a drag that started inside the content no longer counts.
  const pressStartedOnBackdrop = useRef(false);

  return (
    <div
      onMouseDown={(e) => {
        pressStartedOnBackdrop.current = e.target === e.currentTarget;
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && pressStartedOnBackdrop.current) onClose();
      }}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(15,20,30,0.45)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 100,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "#fff",
          borderRadius: 16,
          width,
          maxWidth: "92vw",
          maxHeight: "86vh",
          display: "flex",
          flexDirection: "column",
          boxShadow: "var(--shadow-card)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "18px 22px", borderBottom: "1px solid var(--divider)" }}>
          <div style={{ fontWeight: 700, fontSize: 16, color: "var(--text-primary)" }}>{title}</div>
          <button onClick={onClose} style={{ border: "none", background: "none", cursor: "pointer", display: "flex" }}>
            <Icon name="x" size={18} color="var(--text-secondary)" />
          </button>
        </div>
        <div style={{ padding: 22, overflowY: "auto", flex: 1 }}>{children}</div>
        {footer ? (
          <div style={{ padding: "14px 22px", borderTop: "1px solid var(--divider)", display: "flex", justifyContent: "flex-end", gap: 10 }}>
            {footer}
          </div>
        ) : null}
      </div>
    </div>
  );
}
