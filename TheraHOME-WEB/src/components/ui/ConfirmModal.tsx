"use client";

import type { ReactNode } from "react";
import { Modal } from "./Modal";
import { GhostBtn } from "./primitives";

/** Small danger-confirmation dialog layered on the shared Modal — added for
 * ProductsView's delete actions (deletes there cascade across all 3 market
 * rows, so a stray trash-icon click was expensive). Reusable anywhere a
 * destructive action needs a second confirmation. */
export function ConfirmModal({
  title,
  message,
  confirmLabel = "Xoá",
  busy = false,
  onConfirm,
  onCancel,
}: {
  title: string;
  message: ReactNode;
  confirmLabel?: string;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <Modal
      title={title}
      onClose={onCancel}
      width={400}
      footer={
        <>
          <GhostBtn onClick={onCancel} disabled={busy}>Hủy</GhostBtn>
          <button
            onClick={onConfirm}
            disabled={busy}
            style={{
              border: "none",
              background: "var(--error)",
              color: "#fff",
              borderRadius: 10,
              padding: "9px 16px",
              fontFamily: "var(--font-family)",
              fontSize: 13,
              fontWeight: 600,
              cursor: busy ? "default" : "pointer",
              opacity: busy ? 0.6 : 1,
            }}
          >
            {busy ? "Đang xoá..." : confirmLabel}
          </button>
        </>
      }
    >
      <div style={{ fontSize: 13.5, color: "var(--text-primary)", lineHeight: 1.55 }}>{message}</div>
    </Modal>
  );
}
