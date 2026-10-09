"use client";

// What the number screens show while the figures are being read, or when the
// read failed.
//
// Two states, never one: "đang đọc" and "không đọc được" look identical if
// both render an empty dashboard, and a reader who cannot tell them apart will
// assume the business had no orders.
import { Icon } from "@/components/ui/Icon";
import { useConsole } from "@/components/agent/state";

export function MetricsGate() {
  const { metricsError, reloadMetrics } = useConsole();

  if (metricsError) {
    return (
      <div className="ac-card ac-card-pad" style={{ display: "flex", flexDirection: "column", gap: 12, alignItems: "flex-start" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
          <Icon name="triangle-alert" size={17} color="var(--ac-crit)" />
          <span style={{ fontSize: 15, fontWeight: 700, color: "var(--ac-ink)" }}>Không đọc được số liệu</span>
        </div>
        <div style={{ fontSize: 13, color: "var(--ac-ink-2)", lineHeight: 1.6, maxWidth: 560 }}>
          {metricsError}
        </div>
        <div style={{ fontSize: 12.5, color: "var(--ac-ink-3)", lineHeight: 1.6, maxWidth: 560 }}>
          Số liệu nằm trong database, không nằm trong mã nguồn. Nếu bảng còn trống thì chưa có ai đổ bản chụp nào vào.
        </div>
        <button type="button" className="ac-btn" onClick={reloadMetrics}>Thử lại</button>
      </div>
    );
  }

  return (
    <div className="ac-card ac-card-pad" style={{ fontSize: 13.5, color: "var(--ac-ink-3)" }}>
      Đang đọc số liệu…
    </div>
  );
}
