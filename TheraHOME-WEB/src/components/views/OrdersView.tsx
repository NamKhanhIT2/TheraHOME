"use client";

// Đơn hàng đặt trong app.
//
// Shared by Admin and CSKH: the same queue, the same powers. An order is
// placed in the mobile store, `place-app-order` writes it to `app_orders`,
// and this is where somebody calls the customer and walks it to delivered.
//
// Everything about the order itself is read-only here — product, prices,
// quantity, address are what the app charged and what the customer typed,
// and a console that can quietly rewrite them is worse than one that
// cannot. Only `status` and `staff_note` are editable, and the database
// stamps who moved it and when (trigger `touch_app_order`).

import { useCallback, useEffect, useMemo, useState } from "react";
import { TableShell } from "@/components/ui/TableShell";
import { Modal } from "@/components/ui/Modal";
import { Badge, GhostBtn, PrimaryBtn, StatCard, FieldLabel, inputStyle } from "@/components/ui/primitives";
import { pushToast } from "@/components/ui/Toast";
import { errorMessage } from "@/lib/errorMessage";
import { fetchAppOrders, updateAppOrder, type AppOrder, type AppOrderStatus } from "@/lib/db";

const STATUS: Record<AppOrderStatus, { label: string; color: string; bg: string }> = {
  new: { label: "Mới", color: "var(--color-primary-dark)", bg: "var(--color-primary-tint-10)" },
  confirmed: { label: "Đã xác nhận", color: "#B26B00", bg: "rgba(178,107,0,0.12)" },
  shipped: { label: "Đang giao", color: "#5B49C9", bg: "rgba(91,73,201,0.12)" },
  delivered: { label: "Đã giao", color: "#1E9E5E", bg: "rgba(30,158,94,0.12)" },
  cancelled: { label: "Đã huỷ", color: "var(--error)", bg: "var(--error-tint)" },
};

const STATUS_ORDER: AppOrderStatus[] = ["new", "confirmed", "shipped", "delivered", "cancelled"];
const FILTER_ALL = "Tất cả trạng thái";

/** Same shape as the app and the Edge Function print, so a customer reading
 * their receipt over the phone and the specialist on the console see the
 * identical number. */
function money(amount: number, market: string): string {
  if (market === "MALAY") return `RM ${amount.toLocaleString("ms-MY", { maximumFractionDigits: 2 })}`;
  if (market === "US") return `$${amount.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
  return `${Math.round(amount).toLocaleString("vi-VN")}đ`;
}

function dateVn(iso: string): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("vi-VN", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

export function OrdersView() {
  const [orders, setOrders] = useState<AppOrder[] | null>(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState(FILTER_ALL);
  const [open, setOpen] = useState<AppOrder | null>(null);

  const load = useCallback(() => {
    fetchAppOrders()
      .then(setOrders)
      .catch((e) => {
        pushToast(errorMessage(e) || "Không tải được danh sách đơn");
        setOrders([]);
      });
  }, []);
  useEffect(() => { load(); }, [load]);

  const visible = useMemo(() => {
    const needle = search.trim().toLowerCase();
    // A phone typed with spaces or dots must still find the order, which is
    // why `phone_digits` exists alongside `phone`.
    const digits = needle.replace(/\D/g, "");
    return (orders ?? []).filter((order) => {
      if (filter !== FILTER_ALL && STATUS[order.status].label !== filter) return false;
      if (!needle) return true;
      if (digits && order.phoneDigits.includes(digits)) return true;
      return (
        order.reference.toLowerCase().includes(needle) ||
        order.customerName.toLowerCase().includes(needle) ||
        order.productName.toLowerCase().includes(needle) ||
        order.phone.toLowerCase().includes(needle)
      );
    });
  }, [orders, search, filter]);

  // Counted over everything loaded, not the filtered view — these answer
  // "what is waiting for me", so a filter must not make work disappear.
  const stats = useMemo(() => {
    const all = orders ?? [];
    const month = new Date();
    month.setDate(1);
    month.setHours(0, 0, 0, 0);
    return {
      waiting: all.filter((o) => o.status === "new").length,
      moving: all.filter((o) => o.status === "confirmed" || o.status === "shipped").length,
      delivered: all.filter((o) => o.status === "delivered").length,
      // Delivered only: an order nobody has confirmed yet is not revenue.
      revenue: all
        .filter((o) => o.status === "delivered" && new Date(o.createdAt) >= month)
        .reduce((sum, o) => sum + o.totalAmount, 0),
      market: all[0]?.market ?? "VN",
    };
  }, [orders]);

  return (
    <>
      <div style={{ display: "flex", gap: 14, marginBottom: 18, flexWrap: "wrap" }}>
        <StatCard icon="clock" label="Đơn chờ xử lý" value={stats.waiting} tint="var(--color-primary-tint-10)" />
        <StatCard icon="send" label="Đang xác nhận / giao" value={stats.moving} tint="rgba(91,73,201,0.12)" />
        <StatCard icon="check" label="Đã giao" value={stats.delivered} tint="rgba(30,158,94,0.12)" />
        <StatCard icon="trending-up" label="Doanh thu đã giao tháng này" value={money(stats.revenue, stats.market)} tint="rgba(178,107,0,0.12)" />
      </div>

      <TableShell
        subtitle={
          orders === null
            ? "Đang tải..."
            : `${visible.length} đơn${visible.length !== (orders?.length ?? 0) ? ` / ${orders?.length}` : ""} · đặt trong ứng dụng`
        }
        action={<GhostBtn onClick={load}>Tải lại</GhostBtn>}
        searchPlaceholder="Tìm theo mã đơn, tên, số điện thoại..."
        searchValue={search}
        onSearchChange={setSearch}
        filterOptions={[FILTER_ALL, ...STATUS_ORDER.map((s) => STATUS[s].label)]}
        filterValue={filter}
        onFilterChange={setFilter}
        columns={["Mã đơn", "Khách hàng", "Sản phẩm", "SL", "Tổng cộng", "Đặt lúc", "Trạng thái", ""]}
        modals={open ? <OrderModal order={open} onClose={() => setOpen(null)} onSaved={(next) => {
          setOrders((prev) => (prev ?? []).map((o) => (o.id === next.id ? next : o)));
          setOpen(null);
        }} /> : null}
      >
        {orders === null ? (
          <tr><td colSpan={8} style={{ padding: 18, color: "var(--text-secondary)", fontSize: 13 }}>Đang tải...</td></tr>
        ) : visible.length === 0 ? (
          <tr>
            <td colSpan={8} style={{ padding: 18, color: "var(--text-muted)", fontSize: 13 }}>
              {orders.length === 0 ? "Chưa có đơn nào đặt trong ứng dụng." : "Không có đơn nào khớp bộ lọc."}
            </td>
          </tr>
        ) : (
          visible.map((order) => (
            <tr key={order.id} style={{ borderTop: "1px solid var(--divider)" }}>
              <td style={{ padding: "12px 20px", fontWeight: 700, fontSize: 13 }}>#{order.reference}</td>
              <td style={{ padding: "12px 20px", fontSize: 13 }}>
                <div style={{ fontWeight: 600 }}>{order.customerName}</div>
                <div style={{ color: "var(--text-muted)", fontSize: 12 }}>{order.phone}</div>
              </td>
              <td style={{ padding: "12px 20px", fontSize: 13 }}>{order.productName}</td>
              <td style={{ padding: "12px 20px", fontSize: 13 }}>{order.quantity}</td>
              <td style={{ padding: "12px 20px", fontSize: 13, fontWeight: 700 }}>{money(order.totalAmount, order.market)}</td>
              <td style={{ padding: "12px 20px", fontSize: 13, color: "var(--text-secondary)" }}>{dateVn(order.createdAt)}</td>
              <td style={{ padding: "12px 20px" }}>
                <Badge color={STATUS[order.status].color} bg={STATUS[order.status].bg}>{STATUS[order.status].label}</Badge>
              </td>
              <td style={{ padding: "12px 20px", textAlign: "right" }}>
                <GhostBtn onClick={() => setOpen(order)}>Xem</GhostBtn>
              </td>
            </tr>
          ))
        )}
      </TableShell>
    </>
  );
}

function OrderModal({ order, onClose, onSaved }: { order: AppOrder; onClose: () => void; onSaved: (next: AppOrder) => void }) {
  const [status, setStatus] = useState<AppOrderStatus>(order.status);
  const [staffNote, setStaffNote] = useState(order.staffNote ?? "");
  const [saving, setSaving] = useState(false);
  const dirty = status !== order.status || staffNote !== (order.staffNote ?? "");

  async function save() {
    setSaving(true);
    try {
      const next = await updateAppOrder(order.id, { status, staffNote: staffNote.trim() || null });
      pushToast("Đã lưu đơn hàng");
      onSaved(next);
    } catch (e) {
      pushToast(errorMessage(e) || "Không lưu được");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      title={`Đơn #${order.reference}`}
      onClose={onClose}
      width={520}
      footer={
        <>
          <GhostBtn onClick={onClose}>Đóng</GhostBtn>
          <PrimaryBtn onClick={save} disabled={saving || !dirty}>{saving ? "Đang lưu..." : "Lưu"}</PrimaryBtn>
        </>
      }
    >
      <div style={{ display: "grid", gap: 14 }}>
        <Row label="Sản phẩm" value={`${order.productName} × ${order.quantity}`} />
        <Row
          label="Giá"
          value={
            <>
              <span style={{ textDecoration: "line-through", color: "var(--text-muted)", marginRight: 8 }}>
                {money(order.listPrice, order.market)}
              </span>
              {money(order.unitPrice, order.market)}
              {order.discountPercent > 0 ? <span style={{ color: "#1E9E5E", marginLeft: 8 }}>-{order.discountPercent}%</span> : null}
            </>
          }
        />
        <Row label="Tổng cộng" value={<strong>{money(order.totalAmount, order.market)}</strong>} />
        <Row label="Khách hàng" value={order.customerName} />
        <Row label="Điện thoại" value={<a href={`tel:${order.phoneDigits}`} style={{ color: "var(--color-primary-dark)" }}>{order.phone}</a>} />
        <Row label="Địa chỉ" value={order.address} />
        {order.note ? <Row label="Ghi chú của khách" value={order.note} /> : null}
        <Row label="Đặt lúc" value={dateVn(order.createdAt)} />

        <div>
          <FieldLabel>Trạng thái</FieldLabel>
          <select value={status} onChange={(e) => setStatus(e.target.value as AppOrderStatus)} style={{ ...inputStyle, background: "#fff", cursor: "pointer" }}>
            {STATUS_ORDER.map((key) => (
              <option key={key} value={key}>{STATUS[key].label}</option>
            ))}
          </select>
        </div>

        <div>
          <FieldLabel>Ghi chú nội bộ</FieldLabel>
          <textarea
            value={staffNote}
            onChange={(e) => setStaffNote(e.target.value)}
            rows={3}
            placeholder="Đã gọi xác nhận, hẹn giao thứ 5..."
            style={{ ...inputStyle, resize: "vertical" }}
          />
        </div>
      </div>
    </Modal>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div style={{ display: "flex", gap: 12, fontSize: 13.5 }}>
      <div style={{ width: 150, flexShrink: 0, color: "var(--text-muted)" }}>{label}</div>
      <div style={{ color: "var(--text-primary)" }}>{value}</div>
    </div>
  );
}
