"use client";
/* eslint-disable @next/next/no-img-element -- public Supabase product image URLs are dynamic. */

// Real data: store_categories / store_items, grouped across markets by
// group_key (see src/lib/db.ts's fetchStoreCategoryGroups/
// saveStoreCategoryGroup/saveStoreItemGroup). Display vs. edit differ by
// design (both per explicit requests): the LIST has a top-row market
// dropdown (VN/UK/ML) and shows one market's content at a time, but the
// edit MODALS still hold all 3 markets in one form with name/price required
// for all 3 before save — that all-3 rule exists because a per-market-only
// editor is exactly how the catalog ended up VN-only in practice, leaving
// UK/ML users an empty store.
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
import { SectionCard, PrimaryBtn, GhostBtn, FieldLabel, inputStyle, PillTabs, MarketSelect } from "@/components/ui/primitives";
import { HeaderAccessory } from "@/components/shell/HeaderAccessory";
import { Modal } from "@/components/ui/Modal";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { Icon } from "@/components/ui/Icon";
import { pushToast } from "@/components/ui/Toast";

const MARKET_TABS: Array<[AdminMarket, string]> = [["VN", "VN"], ["US", "UK"], ["MALAY", "ML"]];
const MARKET_LABEL: Record<AdminMarket, string> = { VN: "VN", US: "UK", MALAY: "ML" };
const EMPTY_ITEM_FIELDS: StoreItemMarketFields = { name: "", desc: "", price: "", link: "", previewLink: "", imageUrl: "" };

/** "n/3 thị trường", plus which markets are still missing so staff can see
 * at a glance what's left to fill in (e.g. "1/3 thị trường · thiếu UK, ML"). */
function marketCompleteness(byMarket: StoreCategoryGroup["byMarket"] | StoreItemGroup["byMarket"]): string {
  const missing = MARKET_TABS.filter(([code]) => {
    const row = byMarket[code];
    if (!row) return true;
    return "title" in row ? !row.title.trim() : !row.name.trim();
  });
  const base = `${3 - missing.length}/3 thị trường`;
  return missing.length ? `${base} · thiếu ${missing.map(([, label]) => label).join(", ")}` : base;
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

function storeSaveErrorMessage(error: unknown, subject = "sản phẩm"): string {
  if (!(error instanceof Error)) return `Không thể lưu ${subject}. Vui lòng thử lại.`;
  const message = error.message.toLowerCase();
  if (message === "image_too_large") return "Ảnh quá lớn. Hãy chọn ảnh gốc dưới 15 MB; hệ thống sẽ tự nén khi tải lên.";
  if (message === "invalid_image_type") return "Định dạng ảnh không hợp lệ. Chỉ hỗ trợ JPG, PNG hoặc WebP.";
  if (message.includes("row-level security") || message.includes("permission") || message.includes("not authorized") || message.includes("unauthorized")) {
    return `Tài khoản hiện tại không có quyền lưu ${subject}. Vui lòng đăng nhập bằng tài khoản Admin.`;
  }
  if (message.includes("bucket") && message.includes("not found")) return "Chưa có kho ảnh store-images trên Supabase.";
  if (message.startsWith("missing_category_for_market_")) {
    const code = message.split("_").at(-1)?.toUpperCase() as AdminMarket | undefined;
    const label = code ? MARKET_LABEL[code] ?? code : "?";
    return `Nhóm sản phẩm này chưa được lưu cho thị trường ${label}. Hãy bấm "Sửa nhóm", điền đủ tên cho cả 3 thị trường và lưu nhóm trước, rồi lưu lại sản phẩm.`;
  }
  if (message.includes("failed to fetch") || message.includes("network")) return "Mất kết nối mạng. Kiểm tra Internet rồi thử lại.";
  return `Không thể lưu ${subject}: ${error.message}`;
}

type CategoryModalState = { groupKey: string | "new" } | null;
type ItemModalState = { categoryGroupKey: string; groupKey: string | "new" } | null;
type DeleteConfirmState = { kind: "category" | "item"; groupKey: string; label: string } | null;

export function ProductsView() {
  const [groups, setGroups] = useState<StoreCategoryGroup[] | null>(null);
  // Top-row market dropdown — the list below shows/manages ONE market's
  // content at a time (per explicit request). The edit modals still hold
  // all 3 markets' fields (opened at the selected market's tab) so the
  // all-3-required save rule keeps the catalog complete for UK/ML users.
  const [viewMarket, setViewMarket] = useState<AdminMarket>("VN");
  const [categoryModal, setCategoryModal] = useState<CategoryModalState>(null);
  const [categoryTab, setCategoryTab] = useState<AdminMarket>("VN");
  const [categoryFields, setCategoryFields] = useState<Record<AdminMarket, { title: string; hasTrial: boolean }>>(emptyCategoryFields());
  const [categoryIsPrimary, setCategoryIsPrimary] = useState(false);
  const [categoryError, setCategoryError] = useState<string | null>(null);
  const [itemModal, setItemModal] = useState<ItemModalState>(null);
  const [itemTab, setItemTab] = useState<AdminMarket>("VN");
  const [itemFields, setItemFields] = useState<Record<AdminMarket, StoreItemMarketFields>>(emptyItemFields());
  const [itemImageFiles, setItemImageFiles] = useState<Partial<Record<AdminMarket, File>>>({});
  const [itemError, setItemError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<DeleteConfirmState>(null);
  const [deleting, setDeleting] = useState(false);

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
    setCategoryTab(viewMarket);
    setCategoryFields(emptyCategoryFields());
    setCategoryIsPrimary(false);
    setCategoryError(null);
    setCategoryModal({ groupKey: "new" });
  }
  function openEditCategory(group: StoreCategoryGroup) {
    setCategoryTab(viewMarket);
    const fields = emptyCategoryFields();
    for (const [code] of MARKET_TABS) {
      const row = group.byMarket[code];
      if (row) fields[code] = { title: row.title, hasTrial: row.hasTrial };
    }
    setCategoryFields(fields);
    setCategoryIsPrimary(group.isPrimary);
    setCategoryError(null);
    setCategoryModal({ groupKey: group.groupKey });
  }
  async function saveCategory() {
    if (!categoryModal) return;
    const missing = MARKET_TABS.find(([code]) => !categoryFields[code].title.trim());
    if (missing) {
      // Jump to the offending market's tab so the empty field is on screen,
      // and keep the message inside the modal instead of a transient toast.
      setCategoryTab(missing[0]);
      setCategoryError(`Chưa nhập tên nhóm sản phẩm cho thị trường ${missing[1]}. Hãy điền tên ở tab ${missing[1]} rồi lưu lại.`);
      return;
    }
    try {
      setSaving(true);
      setCategoryError(null);
      await saveStoreCategoryGroup(categoryModal.groupKey, categoryFields, categoryIsPrimary);
      setCategoryModal(null);
      pushToast("Đã lưu nhóm sản phẩm");
      reload();
    } catch (error) {
      console.error("Unable to save store category group", error);
      setCategoryError(storeSaveErrorMessage(error, "nhóm sản phẩm"));
    } finally {
      setSaving(false);
    }
  }

  function openNewItem(categoryGroupKey: string) {
    setItemTab(viewMarket);
    setItemFields(emptyItemFields());
    setItemImageFiles({});
    setItemError(null);
    setItemModal({ categoryGroupKey, groupKey: "new" });
  }
  function openEditItem(categoryGroupKey: string, item: StoreItemGroup) {
    setItemTab(viewMarket);
    const fields = emptyItemFields();
    for (const [code] of MARKET_TABS) {
      const row = item.byMarket[code];
      fields[code] = { name: row.name, desc: row.desc, price: row.price, link: row.link, previewLink: row.previewLink, imageUrl: row.imageUrl };
    }
    setItemFields(fields);
    setItemImageFiles({});
    setItemError(null);
    setItemModal({ categoryGroupKey, groupKey: item.groupKey });
  }
  async function saveItem() {
    if (!itemModal) return;
    const missing = MARKET_TABS.find(([code]) => !itemFields[code].name.trim() || !itemFields[code].price.trim());
    if (missing) {
      setItemTab(missing[0]);
      setItemError(`Chưa nhập tên và giá sản phẩm cho thị trường ${missing[1]}. Hãy điền ở tab ${missing[1]} rồi lưu lại.`);
      return;
    }
    try {
      setSaving(true);
      setItemError(null);
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
      console.error("Unable to save store item", error);
      setItemError(storeSaveErrorMessage(error));
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete() {
    if (!deleteConfirm) return;
    const isCategory = deleteConfirm.kind === "category";
    try {
      setDeleting(true);
      if (isCategory) await deleteStoreCategoryGroup(deleteConfirm.groupKey);
      else await deleteStoreItemGroup(deleteConfirm.groupKey);
      setDeleteConfirm(null);
      pushToast(isCategory ? "Đã xoá nhóm sản phẩm" : "Đã xoá sản phẩm");
      reload();
    } catch (error) {
      console.error("Unable to delete store group", error);
      pushToast(isCategory ? "Không thể xoá nhóm sản phẩm" : "Không thể xoá sản phẩm");
    } finally {
      setDeleting(false);
    }
  }

  if (!groups) return <div style={{ color: "var(--text-secondary)" }}>Đang tải...</div>;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <HeaderAccessory>
        <MarketSelect options={MARKET_TABS} value={viewMarket} onChange={setViewMarket} />
      </HeaderAccessory>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>Danh sách hiển thị nội dung của thị trường đang chọn ({MARKET_LABEL[viewMarket]}).</div>
        <PrimaryBtn icon="plus" onClick={openNewCategory}>Thêm nhóm sản phẩm</PrimaryBtn>
      </div>
      {groups.map((group) => (
        <SectionCard
          key={group.groupKey}
          title={group.byMarket[viewMarket]?.title.trim() || `${primaryLabel(group.byMarket)} (chưa có tên ${MARKET_LABEL[viewMarket]})`}
          action={
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span
                style={{
                  fontSize: 11.5,
                  fontWeight: 700,
                  padding: "3px 9px",
                  borderRadius: 999,
                  color: group.isPrimary ? "var(--color-primary)" : "var(--text-muted)",
                  background: group.isPrimary ? "var(--color-primary-tint-10)" : "rgba(138,147,163,0.12)",
                }}
              >
                {group.isPrimary ? "Nhóm chính" : "Nhóm phụ"}
              </span>
              <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{marketCompleteness(group.byMarket)}</span>
              <GhostBtn onClick={() => openEditCategory(group)}>Sửa nhóm</GhostBtn>
              <PrimaryBtn icon="plus" onClick={() => openNewItem(group.groupKey)}>Thêm sản phẩm</PrimaryBtn>
              <button
                onClick={() => setDeleteConfirm({ kind: "category", groupKey: group.groupKey, label: primaryLabel(group.byMarket) })}
                style={{ border: "none", background: "none", cursor: "pointer", display: "flex" }}
              >
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
              const row = item.byMarket[viewMarket];
              const filled = !!row.name.trim();
              return (
                <div key={item.groupKey} style={{ display: "flex", alignItems: "center", gap: 14, padding: "12px 0", borderTop: i > 0 ? "1px solid var(--divider)" : "none" }}>
                  {row.imageUrl ? (
                    <img src={row.imageUrl} alt="" style={{ width: 44, height: 44, objectFit: "cover", borderRadius: 10, flexShrink: 0, border: "1px solid var(--divider)" }} />
                  ) : (
                    <div style={{ width: 38, height: 38, borderRadius: 10, border: "2px solid " + item.accent, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <Icon name="box" size={16} color={item.accent} />
                    </div>
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 13.5, color: "var(--text-primary)" }}>
                      {filled ? row.name : primaryLabel(item.byMarket)}
                    </div>
                    {filled ? (
                      <div style={{ fontSize: 12.5, color: "var(--text-secondary)" }}>{row.desc}</div>
                    ) : (
                      <div style={{ fontSize: 12.5, color: "var(--error)" }}>Chưa có nội dung cho thị trường {MARKET_LABEL[viewMarket]} — bấm sửa để điền.</div>
                    )}
                    <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>{marketCompleteness(item.byMarket)}</div>
                  </div>
                  <div style={{ fontWeight: 700, fontSize: 13.5, color: "var(--text-primary)" }}>{row.price}</div>
                  <div style={{ display: "flex", gap: 10 }}>
                    <button onClick={() => openEditItem(group.groupKey, item)} style={{ border: "none", background: "none", cursor: "pointer", display: "flex" }}>
                      <Icon name="pencil" size={16} color="var(--color-primary)" />
                    </button>
                    <button
                      onClick={() => setDeleteConfirm({ kind: "item", groupKey: item.groupKey, label: primaryLabel(item.byMarket) })}
                      style={{ border: "none", background: "none", cursor: "pointer", display: "flex" }}
                    >
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
              <PrimaryBtn onClick={saveCategory} disabled={saving}>{saving ? "Đang lưu..." : categoryModal.groupKey === "new" ? "Thêm nhóm" : "Lưu thay đổi"}</PrimaryBtn>
            </Fragment>
          }
        >
          <FieldLabel>Loại nhóm (chung cho cả 3 thị trường)</FieldLabel>
          <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
            {([[true, "Nhóm chính"], [false, "Nhóm phụ"]] as const).map(([value, label]) => (
              <button
                key={label}
                type="button"
                onClick={() => setCategoryIsPrimary(value)}
                style={{
                  flex: 1,
                  border: categoryIsPrimary === value ? "none" : "1px solid var(--border-input)",
                  background: categoryIsPrimary === value ? "var(--color-primary)" : "none",
                  color: categoryIsPrimary === value ? "#fff" : "var(--text-primary)",
                  borderRadius: 10,
                  padding: "9px 0",
                  fontFamily: "var(--font-family)",
                  fontWeight: 600,
                  fontSize: 13,
                  cursor: "pointer",
                }}
              >
                {label}
              </button>
            ))}
          </div>
          <div style={{ marginTop: -6, marginBottom: 14, fontSize: 12, color: "var(--text-muted)" }}>
            Nhóm chính = thiết bị có lộ trình; sản phẩm trong nhóm chính hiển thị ở danh sách chọn thiết bị trên tab Lộ trình của mobile app. Nhóm phụ = phụ kiện, chỉ hiện trong Cửa hàng.
          </div>
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
          {categoryError ? (
            <div style={{ marginTop: 12, padding: "10px 12px", borderRadius: 10, background: "rgba(220,53,69,0.08)", fontSize: 12.5, fontWeight: 600, color: "var(--error)", lineHeight: 1.5 }}>
              {categoryError}
            </div>
          ) : null}
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
          {itemError ? (
            <div style={{ marginTop: 12, padding: "10px 12px", borderRadius: 10, background: "rgba(220,53,69,0.08)", fontSize: 12.5, fontWeight: 600, color: "var(--error)", lineHeight: 1.5 }}>
              {itemError}
            </div>
          ) : null}
        </Modal>
      ) : null}
      {deleteConfirm ? (
        <ConfirmModal
          title={deleteConfirm.kind === "category" ? "Xoá nhóm sản phẩm" : "Xoá sản phẩm"}
          message={
            deleteConfirm.kind === "category"
              ? `Xoá nhóm "${deleteConfirm.label}"? Toàn bộ sản phẩm trong nhóm này ở cả 3 thị trường sẽ bị xoá vĩnh viễn và không thể hoàn tác.`
              : `Xoá sản phẩm "${deleteConfirm.label}" khỏi cả 3 thị trường? Hành động này không thể hoàn tác.`
          }
          confirmLabel="Xoá vĩnh viễn"
          busy={deleting}
          onConfirm={confirmDelete}
          onCancel={() => setDeleteConfirm(null)}
        />
      ) : null}
    </div>
  );
}
