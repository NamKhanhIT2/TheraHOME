"use client";
/* eslint-disable @next/next/no-img-element -- public Supabase product image URLs are dynamic. */

// Real data: store_categories / store_items, grouped across markets by
// group_key (see src/lib/db.ts's fetchStoreCategoryGroups/
// saveStoreCategoryGroup/saveStoreItemGroup). Previously this view took a
// single `market` prop from an app-wide dropdown in AppShell.tsx and edited
// one market at a time — replaced per explicit request: staff now fill all
// 3 markets (VN/UK/ML) for a product/category in one form, required before
// save, instead of a country picker that made it easy to forget 2 of 3
// markets (which is exactly how the catalog ended up VN-only in practice).
import { Fragment, useEffect, useState } from "react";
import {
  fetchStoreCategoryGroups,
  saveStoreCategoryGroup,
  deleteStoreCategoryGroup,
  saveStoreItemGroup,
  deleteStoreItemGroup,
  uploadStoreItemImage,
  type AdminMarket,
  type StoreCategoryGroup,
  type StoreItemGroup,
  type StoreItemMarketFields,
} from "@/lib/db";
import { SectionCard, PrimaryBtn, GhostBtn, FieldLabel, inputStyle, PillTabs } from "@/components/ui/primitives";
import { Modal } from "@/components/ui/Modal";
import { Icon } from "@/components/ui/Icon";
import { pushToast } from "@/components/ui/Toast";

const MARKET_TABS: Array<[AdminMarket, string]> = [["VN", "VN"], ["US", "UK"], ["MALAY", "ML"]];
const EMPTY_ITEM_FIELDS: StoreItemMarketFields = { name: "", desc: "", price: "", link: "", previewLink: "", imageUrl: "" };

function marketCompleteness(byMarket: StoreCategoryGroup["byMarket"] | StoreItemGroup["byMarket"]): string {
  const filled = MARKET_TABS.filter(([code]) => {
    const row = byMarket[code];
    if (!row) return false;
    return "title" in row ? !!row.title.trim() : !!row.name.trim();
  });
  return `${filled.length}/3 thị trường`;
}

/** Best-effort display name for a group in the list — prefers VN, falls
 * back to whichever market actually has content (a group mid-setup, not
 * fully filled in across all 3 yet, still needs to show up in the list). */
function primaryLabel(byMarket: Record<AdminMarket, { title: string } | { name: string } | null>): string {
  for (const [code] of MARKET_TABS) {
    const row = byMarket[code];
    if (!row) continue;
    const label = "title" in row ? row.title : row.name;
    if (label.trim()) return label.trim();
  }
  return "(Chưa đặt tên)";
}

type CategoryModalState = { groupKey: string | "new" } | null;
type ItemModalState = { categoryGroupKey: string; groupKey: string | "new" } | null;

export function ProductsView() {
  const [groups, setGroups] = useState<StoreCategoryGroup[] | null>(null);
  const [categoryModal, setCategoryModal] = useState<CategoryModalState>(null);
  const [categoryTab, setCategoryTab] = useState<AdminMarket>("VN");
  const [categoryFields, setCategoryFields] = useState<Record<AdminMarket, { title: string; hasTrial: boolean }>>(emptyCategoryFields());
  const [itemModal, setItemModal] = useState<ItemModalState>(null);
  const [itemTab, setItemTab] = useState<AdminMarket>("VN");
  const [itemFields, setItemFields] = useState<Record<AdminMarket, StoreItemMarketFields>>(emptyItemFields());
  const [itemImageFiles, setItemImageFiles] = useState<Partial<Record<AdminMarket, File>>>({});
  const [saving, setSaving] = useState(false);

  function emptyCategoryFields(): Record<AdminMarket, { title: string; hasTrial: boolean }> {
    return { VN: { title: "", hasTrial: false }, US: { title: "", hasTrial: false }, MALAY: { title: "", hasTrial: false } };
  }
  function emptyItemFields(): Record<AdminMarket, StoreItemMarketFields> {
    return { VN: { ...EMPTY_ITEM_FIELDS }, US: { ...EMPTY_ITEM_FIELDS }, MALAY: { ...EMPTY_ITEM_FIELDS } };
  }

  function reload() {
    fetchStoreCategoryGroups().then(setGroups).catch(() => pushToast("Không thể tải danh mục sản phẩm"));
  }
  useEffect(reload, []);

  function openNewCategory() {
    setCategoryTab("VN");
    setCategoryFields(emptyCategoryFields());
    setCategoryModal({ groupKey: "new" });
  }
  function openEditCategory(group: StoreCategoryGroup) {
    setCategoryTab("VN");
    const fields = emptyCategoryFields();
    for (const [code] of MARKET_TABS) {
      const row = group.byMarket[code];
      if (row) fields[code] = { title: row.title, hasTrial: row.hasTrial };
    }
    setCategoryFields(fields);
    setCategoryModal({ groupKey: group.groupKey });
  }
  async function saveCategory() {
    if (!categoryModal) return;
    const missing = MARKET_TABS.find(([code]) => !categoryFields[code].title.trim());
    if (missing) {
      pushToast(`Vui lòng nhập tên nhóm sản phẩm cho thị trường ${missing[1]}`);
      return;
    }
    try {
      await saveStoreCategoryGroup(categoryModal.groupKey, categoryFields);
      setCategoryModal(null);
      pushToast("Đã lưu nhóm sản phẩm");
      reload();
    } catch {
      pushToast("Không thể lưu nhóm sản phẩm");
    }
  }
  async function removeCategory(groupKey: string) {
    try {
      await deleteStoreCategoryGroup(groupKey);
      reload();
    } catch {
      pushToast("Không thể xoá nhóm sản phẩm");
    }
  }

  function openNewItem(categoryGroupKey: string) {
    setItemTab("VN");
    setItemFields(emptyItemFields());
    setItemImageFiles({});
    setItemModal({ categoryGroupKey, groupKey: "new" });
  }
  function openEditItem(categoryGroupKey: string, item: StoreItemGroup) {
    setItemTab("VN");
    const fields = emptyItemFields();
    for (const [code] of MARKET_TABS) {
      const row = item.byMarket[code];
      fields[code] = { name: row.name, desc: row.desc, price: row.price, link: row.link, previewLink: row.previewLink, imageUrl: row.imageUrl };
    }
    setItemFields(fields);
    setItemImageFiles({});
    setItemModal({ categoryGroupKey, groupKey: item.groupKey });
  }
  async function saveItem() {
    if (!itemModal) return;
    const missing = MARKET_TABS.find(([code]) => !itemFields[code].name.trim() || !itemFields[code].price.trim());
    if (missing) {
      pushToast(`Vui lòng nhập tên và giá sản phẩm cho thị trường ${missing[1]}`);
      return;
    }
    try {
      setSaving(true);
      const resolvedFields: Record<AdminMarket, StoreItemMarketFields> = { ...itemFields };
      for (const [code] of MARKET_TABS) {
        const file = itemImageFiles[code];
        if (file) {
          const placeholderId = `${itemModal.groupKey === "new" ? "item-" + Date.now() : itemModal.groupKey}-${code.toLowerCase()}`;
          resolvedFields[code] = { ...resolvedFields[code], imageUrl: await uploadStoreItemImage(placeholderId, file) };
        }
      }
      await saveStoreItemGroup(itemModal.categoryGroupKey, itemModal.groupKey, resolvedFields);
      setItemModal(null);
      pushToast("Đã lưu sản phẩm");
      reload();
    } catch (error) {
      pushToast(error instanceof Error && error.message === "image_too_large" ? "Ảnh phải nhỏ hơn 5 MB" : "Không thể lưu sản phẩm");
    } finally {
      setSaving(false);
    }
  }
  async function removeItem(groupKey: string) {
    try {
      await deleteStoreItemGroup(groupKey);
      reload();
    } catch {
      pushToast("Không thể xoá sản phẩm");
    }
  }

  if (!groups) return <div style={{ color: "var(--text-secondary)" }}>Đang tải...</div>;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
        <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>Mỗi nhóm/sản phẩm được điền đầy đủ cho cả 3 thị trường VN/UK/ML trong một biểu mẫu.</div>
        <PrimaryBtn icon="plus" onClick={openNewCategory}>Thêm nhóm sản phẩm</PrimaryBtn>
      </div>
      {groups.map((group) => (
        <SectionCard
          key={group.groupKey}
          title={primaryLabel(group.byMarket)}
          action={
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{marketCompleteness(group.byMarket)}</span>
              <GhostBtn onClick={() => openEditCategory(group)}>Sửa nhóm</GhostBtn>
              <PrimaryBtn icon="plus" onClick={() => openNewItem(group.groupKey)}>Thêm sản phẩm</PrimaryBtn>
              <button onClick={() => removeCategory(group.groupKey)} style={{ border: "none", background: "none", cursor: "pointer", display: "flex" }}>
                <Icon name="trash-2" size={16} color="var(--error)" />
              </button>
            </div>
          }
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
            {group.items.length === 0 ? (
              <div style={{ padding: "18px 0", textAlign: "center", color: "var(--text-muted)", fontSize: 13.5 }}>
                Nhóm này chưa có sản phẩm. Nhấn “Thêm sản phẩm” để bắt đầu.
              </div>
            ) : null}
            {group.items.map((item, i) => {
              const vn = item.byMarket.VN;
              return (
                <div key={item.groupKey} style={{ display: "flex", alignItems: "center", gap: 14, padding: "12px 0", borderTop: i > 0 ? "1px solid var(--divider)" : "none" }}>
                  {vn.imageUrl ? (
                    <img src={vn.imageUrl} alt="" style={{ width: 44, height: 44, objectFit: "cover", borderRadius: 10, flexShrink: 0, border: "1px solid var(--divider)" }} />
                  ) : (
                    <div style={{ width: 38, height: 38, borderRadius: 10, border: "2px solid " + item.accent, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <Icon name="box" size={16} color={item.accent} />
                    </div>
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 13.5, color: "var(--text-primary)" }}>{primaryLabel(item.byMarket)}</div>
                    <div style={{ fontSize: 12.5, color: "var(--text-secondary)" }}>{vn.desc}</div>
                    <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>{marketCompleteness(item.byMarket)}</div>
                  </div>
                  <div style={{ fontWeight: 700, fontSize: 13.5, color: "var(--text-primary)" }}>{vn.price}</div>
                  <div style={{ display: "flex", gap: 10 }}>
                    <button onClick={() => openEditItem(group.groupKey, item)} style={{ border: "none", background: "none", cursor: "pointer", display: "flex" }}>
                      <Icon name="pencil" size={16} color="var(--color-primary)" />
                    </button>
                    <button onClick={() => removeItem(item.groupKey)} style={{ border: "none", background: "none", cursor: "pointer", display: "flex" }}>
                      <Icon name="trash-2" size={16} color="var(--error)" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </SectionCard>
      ))}
      {categoryModal ? (
        <Modal
          title={categoryModal.groupKey === "new" ? "Thêm nhóm sản phẩm" : "Sửa nhóm sản phẩm"}
          onClose={() => setCategoryModal(null)}
          width={440}
          footer={
            <Fragment>
              <GhostBtn onClick={() => setCategoryModal(null)}>Hủy</GhostBtn>
              <PrimaryBtn onClick={saveCategory}>{categoryModal.groupKey === "new" ? "Thêm nhóm" : "Lưu thay đổi"}</PrimaryBtn>
            </Fragment>
          }
        >
          <PillTabs options={MARKET_TABS} value={categoryTab} onChange={setCategoryTab} />
          <FieldLabel>Tên nhóm sản phẩm</FieldLabel>
          <input
            value={categoryFields[categoryTab].title}
            onChange={(e) => setCategoryFields((f) => ({ ...f, [categoryTab]: { ...f[categoryTab], title: e.target.value } }))}
            placeholder="Ví dụ: Thiết bị hỗ trợ gối"
            style={{ ...inputStyle, marginBottom: 16 }}
          />
          <label style={{ display: "flex", alignItems: "center", gap: 9, fontSize: 13.5, color: "var(--text-primary)", cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={categoryFields[categoryTab].hasTrial}
              onChange={(e) => setCategoryFields((f) => ({ ...f, [categoryTab]: { ...f[categoryTab], hasTrial: e.target.checked } }))}
            />
            Cho phép dùng thử sản phẩm trong nhóm
          </label>
          <div style={{ marginTop: 10, fontSize: 12, color: "var(--text-muted)" }}>Bắt buộc điền tên cho cả 3 thị trường trước khi lưu.</div>
        </Modal>
      ) : null}
      {itemModal ? (
        <Modal
          title={itemModal.groupKey === "new" ? "Thêm sản phẩm mới" : "Sửa sản phẩm"}
          onClose={() => setItemModal(null)}
          width={440}
          footer={
            <Fragment>
              <GhostBtn onClick={() => setItemModal(null)}>Hủy</GhostBtn>
              <PrimaryBtn onClick={saveItem} disabled={saving}>{saving ? "Đang lưu..." : itemModal.groupKey === "new" ? "Thêm sản phẩm" : "Lưu thay đổi"}</PrimaryBtn>
            </Fragment>
          }
        >
          <PillTabs options={MARKET_TABS} value={itemTab} onChange={setItemTab} />
          <FieldLabel>Tên sản phẩm</FieldLabel>
          <input
            value={itemFields[itemTab].name}
            onChange={(e) => setItemFields((f) => ({ ...f, [itemTab]: { ...f[itemTab], name: e.target.value } }))}
            style={{ ...inputStyle, marginBottom: 14 }}
          />
          <FieldLabel>Mô tả</FieldLabel>
          <input
            value={itemFields[itemTab].desc}
            onChange={(e) => setItemFields((f) => ({ ...f, [itemTab]: { ...f[itemTab], desc: e.target.value } }))}
            style={{ ...inputStyle, marginBottom: 14 }}
          />
          <FieldLabel>Giá</FieldLabel>
          <input
            value={itemFields[itemTab].price}
            onChange={(e) => setItemFields((f) => ({ ...f, [itemTab]: { ...f[itemTab], price: e.target.value } }))}
            placeholder="Ví dụ: 1.490.000₫"
            style={{ ...inputStyle, marginBottom: 14 }}
          />
          <FieldLabel>Link trang sản phẩm</FieldLabel>
          <input
            value={itemFields[itemTab].link}
            onChange={(e) => setItemFields((f) => ({ ...f, [itemTab]: { ...f[itemTab], link: e.target.value } }))}
            placeholder="https://..."
            style={{ ...inputStyle, marginBottom: 14 }}
          />
          <FieldLabel>Link Xem thử (video)</FieldLabel>
          <input
            value={itemFields[itemTab].previewLink}
            onChange={(e) => setItemFields((f) => ({ ...f, [itemTab]: { ...f[itemTab], previewLink: e.target.value } }))}
            placeholder="https://youtube.com/..."
            style={{ ...inputStyle, marginBottom: 14 }}
          />
          <FieldLabel>Ảnh sản phẩm</FieldLabel>
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={(e) => setItemImageFiles((f) => ({ ...f, [itemTab]: e.target.files?.[0] ?? undefined }))}
            style={{ ...inputStyle, padding: 8, marginBottom: 10 }}
          />
          {itemImageFiles[itemTab] ? (
            <div style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 8 }}>Sẵn sàng tải lên: {itemImageFiles[itemTab]!.name}</div>
          ) : itemFields[itemTab].imageUrl ? (
            <img src={itemFields[itemTab].imageUrl} alt="Ảnh sản phẩm hiện tại" style={{ width: 84, height: 84, objectFit: "cover", borderRadius: 10, border: "1px solid var(--divider)", marginBottom: 8 }} />
          ) : null}
          <div style={{ fontSize: 12, color: "var(--text-muted)" }}>JPG, PNG hoặc WebP, tối đa 5 MB. Bắt buộc điền tên và giá cho cả 3 thị trường trước khi lưu.</div>
        </Modal>
      ) : null}
    </div>
  );
}
