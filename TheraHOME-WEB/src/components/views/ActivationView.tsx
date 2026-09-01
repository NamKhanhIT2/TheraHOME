"use client";

// Kích hoạt: CSKH manually lists the phone/email allowed to activate each
// product. The mobile app's activation flow matches the user's entered
// contact against these rows — one product unlocks only if its own list
// contains that contact (see migration 202609011000_per_product_activation).
import { useEffect, useMemo, useState } from "react";
import {
  fetchActivationProducts,
  fetchProductActivationContacts,
  addProductActivationContact,
  deleteProductActivationContact,
  type ActivationProduct,
  type ActivationContact,
} from "@/lib/db";
import { SectionCard, PrimaryBtn, Badge, inputStyle } from "@/components/ui/primitives";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { Icon } from "@/components/ui/Icon";
import { pushToast } from "@/components/ui/Toast";

function addErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message.toLowerCase() : "";
  if (message.includes("invalid_contact")) return "Số điện thoại/email không đúng định dạng.";
  if (message.includes("duplicate") || message.includes("unique")) return "Số điện thoại/email này đã có trong danh sách của sản phẩm.";
  if (message.includes("row-level security") || message.includes("permission")) return "Tài khoản hiện tại không có quyền quản lý kích hoạt.";
  return "Không thể thêm. Vui lòng thử lại.";
}

export function ActivationView() {
  const [products, setProducts] = useState<ActivationProduct[] | null>(null);
  const [contacts, setContacts] = useState<ActivationContact[] | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [addingFor, setAddingFor] = useState<string | null>(null);
  const [addErrors, setAddErrors] = useState<Record<string, string>>({});
  const [filter, setFilter] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<ActivationContact | null>(null);
  const [deleting, setDeleting] = useState(false);

  function reload() {
    Promise.all([fetchActivationProducts(), fetchProductActivationContacts()])
      .then(([prods, rows]) => {
        setProducts(prods);
        setContacts(rows);
      })
      .catch(() => pushToast("Không thể tải danh sách kích hoạt"));
  }
  useEffect(reload, []);

  const contactsByProduct = useMemo(() => {
    const map = new Map<string, ActivationContact[]>();
    const needle = filter.trim().toLowerCase();
    for (const row of contacts ?? []) {
      if (needle && !row.contactValue.toLowerCase().includes(needle) && !(row.claimedByName ?? "").toLowerCase().includes(needle)) continue;
      const list = map.get(row.productId) ?? [];
      list.push(row);
      map.set(row.productId, list);
    }
    return map;
  }, [contacts, filter]);

  async function addContact(productId: string) {
    const draft = (drafts[productId] ?? "").trim();
    if (!draft || addingFor) return;
    try {
      setAddingFor(productId);
      setAddErrors((cur) => ({ ...cur, [productId]: "" }));
      await addProductActivationContact(productId, draft);
      setDrafts((cur) => ({ ...cur, [productId]: "" }));
      pushToast("Đã thêm vào danh sách kích hoạt");
      reload();
    } catch (error) {
      console.error("Unable to add activation contact", error);
      setAddErrors((cur) => ({ ...cur, [productId]: addErrorMessage(error) }));
    } finally {
      setAddingFor(null);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    try {
      setDeleting(true);
      await deleteProductActivationContact(deleteTarget.id);
      setDeleteTarget(null);
      pushToast("Đã xoá khỏi danh sách kích hoạt");
      reload();
    } catch (error) {
      console.error("Unable to delete activation contact", error);
      pushToast("Không thể xoá. Vui lòng thử lại.");
    } finally {
      setDeleting(false);
    }
  }

  if (!products || !contacts) return <div style={{ color: "var(--text-secondary)" }}>Đang tải...</div>;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <div style={{ fontSize: 13, color: "var(--text-secondary)", maxWidth: 620 }}>
          Thêm số điện thoại/email của khách vào đúng sản phẩm họ đã mua. Khi khách nhập thông tin này trong app, chỉ lộ trình của các sản phẩm có tên họ trong danh sách mới được mở khoá.
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, background: "#fff", border: "1px solid var(--border-input)", borderRadius: 10, padding: "8px 12px", width: 260 }}>
          <Icon name="search" size={15} color="var(--text-muted)" />
          <input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Tìm SĐT/email/tên khách..."
            style={{ border: "none", outline: "none", flex: 1, fontFamily: "var(--font-family)", fontSize: 13 }}
          />
        </div>
      </div>
      {products.map((product) => {
        const rows = contactsByProduct.get(product.id) ?? [];
        const total = (contacts ?? []).filter((c) => c.productId === product.id).length;
        return (
          <SectionCard
            key={product.id}
            title={product.name}
            action={<span style={{ fontSize: 12, color: "var(--text-muted)" }}>{total} liên hệ</span>}
          >
            <div style={{ display: "flex", gap: 10, marginBottom: 6 }}>
              <input
                value={drafts[product.id] ?? ""}
                onChange={(e) => {
                  const value = e.target.value;
                  setDrafts((cur) => ({ ...cur, [product.id]: value }));
                  setAddErrors((cur) => ({ ...cur, [product.id]: "" }));
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void addContact(product.id);
                }}
                placeholder="Số điện thoại hoặc email của khách"
                style={{ ...inputStyle, flex: 1 }}
              />
              <PrimaryBtn icon="plus" onClick={() => addContact(product.id)} disabled={addingFor === product.id || !(drafts[product.id] ?? "").trim()}>
                {addingFor === product.id ? "Đang thêm..." : "Thêm"}
              </PrimaryBtn>
            </div>
            {addErrors[product.id] ? (
              <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--error)", marginBottom: 6 }}>{addErrors[product.id]}</div>
            ) : null}
            {rows.length === 0 ? (
              <div style={{ padding: "16px 0", textAlign: "center", color: "var(--text-muted)", fontSize: 13 }}>
                {filter.trim() ? "Không có liên hệ khớp tìm kiếm." : "Chưa có liên hệ nào cho sản phẩm này."}
              </div>
            ) : (
              rows.map((row, i) => (
                <div key={row.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0", borderTop: i > 0 ? "1px solid var(--divider)" : "none" }}>
                  <Icon name={row.contactType === "email" ? "send" : "phone"} size={15} color="var(--text-muted)" />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 13.5, color: "var(--text-primary)" }}>{row.contactValue}</div>
                    {row.note ? <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 1 }}>{row.note}</div> : null}
                  </div>
                  {row.claimedByUserId ? (
                    <Badge color="#1E9E5E" bg="rgba(30,158,94,0.12)">
                      Đã kích hoạt{row.claimedByName ? ` · ${row.claimedByName}` : ""}
                    </Badge>
                  ) : (
                    <Badge color="#8A93A3" bg="rgba(138,147,163,0.12)">Chưa sử dụng</Badge>
                  )}
                  <button onClick={() => setDeleteTarget(row)} style={{ border: "none", background: "none", cursor: "pointer", display: "flex" }}>
                    <Icon name="trash-2" size={16} color="var(--error)" />
                  </button>
                </div>
              ))
            )}
          </SectionCard>
        );
      })}
      {deleteTarget ? (
        <ConfirmModal
          title="Xoá liên hệ kích hoạt"
          message={
            `Xoá "${deleteTarget.contactValue}" khỏi danh sách kích hoạt của sản phẩm này?` +
            (deleteTarget.claimedByUserId
              ? " Người dùng đã kích hoạt bằng liên hệ này vẫn giữ lộ trình hiện có; chỉ việc kích hoạt lại trong tương lai bị chặn."
              : " Liên hệ này sẽ không thể dùng để kích hoạt sản phẩm nữa.")
          }
          confirmLabel="Xoá"
          busy={deleting}
          onConfirm={confirmDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      ) : null}
    </div>
  );
}
