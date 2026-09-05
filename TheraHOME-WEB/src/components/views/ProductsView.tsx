"use client";
/* eslint-disable @next/next/no-img-element -- public Supabase product image URLs are dynamic. */

// Real data: store_categories / store_items, grouped across markets by
// group_key (see src/lib/db.ts's fetchStoreCategoryGroups/
// saveStoreCategoryGroup/saveStoreItemGroup). The LIST has a top-row market
// dropdown (VN/UK/ML) and shows one market's content at a time; the edit
// MODALS hold all 3 markets in one form (opened at the selected market's
// tab) so staff always see what the other markets have.
//
// Per-market rule (owner, 2026-09-05): every market is independent. The
// trash icon removes the group/item from the market being VIEWED only —
// it used to wipe all 3 rows, so deleting a back-support group while on UK
// silently deleted it for VN too. A blank tab in the modal means "không
// bán ở thị trường này" (no row); the earlier all-3-required rule is gone,
// but the tabs flag blank markets so a half-filled catalog is visible at a
// glance rather than silent.
import { Fragment, useEffect, useState } from "react";
import {
  fetchStoreCategoryGroups,
  saveStoreCategoryGroup,
  deleteStoreCategoryGroup,
  deleteStoreCategoryMarket,
  saveStoreItemGroup,
  deleteStoreItemGroup,
  deleteStoreItemMarket,
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
import { translateDrafts } from "@/lib/translate";
import { fetchActivationProducts, type ActivationProduct } from "@/lib/db";

const MARKET_TABS: Array<[AdminMarket, string]> = [["VN", "VN"], ["US", "UK"], ["MALAY", "ML"]];
const MARKET_LABEL: Record<AdminMarket, string> = { VN: "VN", US: "UK", MALAY: "ML" };
const EMPTY_ITEM_FIELDS: StoreItemMarketFields = { name: "", desc: "", price: "", link: "", previewLink: "", imageUrl: "" };

/** "n/3 thị trường", plus which markets this is NOT sold in, so staff can
 * see the coverage at a glance (e.g. "1/3 thị trường · không bán: UK, ML"). */
function marketCompleteness(byMarket: StoreCategoryGroup["byMarket"] | StoreItemGroup["byMarket"]): string {
  const missing = MARKET_TABS.filter(([code]) => {
    const row = byMarket[code];
    if (!row) return true;
    return "title" in row ? !row.title.trim() : !row.name.trim();
  });
  const base = `${3 - missing.length}/3 thị trường`;
  return missing.length ? `${base} · không bán: ${missing.map(([, label]) => label).join(", ")}` : base;
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
    return `Nhóm sản phẩm này không bán ở thị trường ${label}. Hãy bấm "Sửa nhóm", điền tên nhóm ở tab ${label} và lưu trước — hoặc để trống tab ${label} của sản phẩm này.`;
  }
  if (message.startsWith("market_has_data_")) {
    const code = message.split("_").at(-1)?.toUpperCase() as AdminMarket | undefined;
    const label = code ? MARKET_LABEL[code] ?? code : "?";
    return `Thị trường ${label} đang có dữ liệu nên không thể để trống. Muốn ngừng bán ở ${label}: chọn thị trường ${label} ở đầu trang rồi bấm biểu tượng thùng rác.`;
  }
  if (message === "no_market_filled") return "Cần điền ít nhất một thị trường trước khi lưu.";
  if (message.includes("failed to fetch") || message.includes("network")) return "Mất kết nối mạng. Kiểm tra Internet rồi thử lại.";
  return `Không thể lưu ${subject}: ${error.message}`;
}

type CategoryModalState = { groupKey: string | "new" } | null;
type ItemModalState = { categoryGroupKey: string; groupKey: string | "new" } | null;
type DeleteConfirmState = { kind: "category" | "item"; groupKey: string; label: string; market: AdminMarket; marketsWithData: AdminMarket[] } | null;

export function ProductsView() {
  const [groups, setGroups] = useState<StoreCategoryGroup[] | null>(null);
  // Top-row market dropdown — the list below shows/manages ONE market's
  // content at a time, and the trash icon only touches that market.
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
  const [deleteAllMarkets, setDeleteAllMarkets] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [translating, setTranslating] = useState(false);
  // Roadmap products available to link a storefront entry to. Until now
  // nothing in Admin wrote store_items.product_id, so the Lộ trình tab could
  // never show a link for any product created after the seeded four.
  const [roadmapProducts, setRoadmapProducts] = useState<ActivationProduct[]>([]);
  const [itemProductId, setItemProductId] = useState<string>("");

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
  useEffect(() => {
    fetchActivationProducts().then(setRoadmapProducts).catch(() => setRoadmapProducts([]));
  }, []);

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
  /** Fills blank UK/ML titles from the VN one. Explicit, because a blank tab
   * means "not sold in that market" — auto-filling on save would put the
   * group on sale somewhere the admin never chose. */
  async function translateCategory() {
    const source = categoryFields.VN.title.trim();
    if (!source) {
      setCategoryError("Cần có tên nhóm ở tab VN trước khi dịch.");
      setCategoryTab("VN");
      return;
    }
    setTranslating(true);
    setCategoryError(null);
    try {
      const drafts = await translateDrafts({ title: source });
      if (!drafts) {
        setCategoryError("Không dịch được lúc này — thử lại sau hoặc nhập tay.");
        return;
      }
      setCategoryFields((f) => ({
        ...f,
        US: { ...f.US, title: f.US.title.trim() || drafts.en.title || "" },
        MALAY: { ...f.MALAY, title: f.MALAY.title.trim() || drafts.ms.title || "" },
      }));
      pushToast("Đã điền bản nháp UK/ML — kiểm tra lại rồi lưu");
    } finally {
      setTranslating(false);
    }
  }

  /** Text only (name + description). Price, links and image stay per-market:
   * they are not translations and a wrong auto-filled price would go live. */
  async function translateItem() {
    const name = itemFields.VN.name.trim();
    const desc = itemFields.VN.desc.trim();
    if (!name) {
      setItemError("Cần có tên sản phẩm ở tab VN trước khi dịch.");
      setItemTab("VN");
      return;
    }
    setTranslating(true);
    setItemError(null);
    try {
      const drafts = await translateDrafts(desc ? { name, desc } : { name });
      if (!drafts) {
        setItemError("Không dịch được lúc này — thử lại sau hoặc nhập tay.");
        return;
      }
      setItemFields((f) => ({
        ...f,
        US: { ...f.US, name: f.US.name.trim() || drafts.en.name || "", desc: f.US.desc.trim() || drafts.en.desc || "" },
        MALAY: { ...f.MALAY, name: f.MALAY.name.trim() || drafts.ms.name || "", desc: f.MALAY.desc.trim() || drafts.ms.desc || "" },
      }));
      pushToast("Đã điền tên & mô tả UK/ML — còn giá và link phải nhập riêng từng thị trường");
    } finally {
      setTranslating(false);
    }
  }

  async function saveCategory() {
    if (!categoryModal) return;
    if (!MARKET_TABS.some(([code]) => categoryFields[code].title.trim())) {
      setCategoryError("Cần điền tên nhóm cho ít nhất một thị trường.");
      return;
    }
    // A blank tab is "không bán ở đó" — but never for a market that already
    // has a row: that removal (which cascades into items) is the trash
    // icon's job. Jump to the offending tab and explain inside the modal.
    const current = groups?.find((g) => g.groupKey === categoryModal.groupKey);
    const blankWithData = MARKET_TABS.find(([code]) => !categoryFields[code].title.trim() && !!current?.byMarket[code]);
    if (blankWithData) {
      setCategoryTab(blankWithData[0]);
      setCategoryError(storeSaveErrorMessage(new Error(`market_has_data_${blankWithData[0]}`), "nhóm sản phẩm"));
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
    setItemProductId("");
    setItemTab(viewMarket);
    setItemFields(emptyItemFields());
    setItemImageFiles({});
    setItemError(null);
    setItemModal({ categoryGroupKey, groupKey: "new" });
  }
  function openEditItem(categoryGroupKey: string, item: StoreItemGroup) {
    setItemProductId(item.productId ?? "");
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
    const filled = (code: AdminMarket) => !!itemFields[code].name.trim() && !!itemFields[code].price.trim();
    const partial = MARKET_TABS.find(([code]) => !filled(code) && (itemFields[code].name.trim() || itemFields[code].price.trim()));
    if (partial) {
      setItemTab(partial[0]);
      setItemError(`Thị trường ${partial[1]} mới điền một nửa — cần cả tên và giá, hoặc để trống hoàn toàn nếu không bán ở ${partial[1]}.`);
      return;
    }
    if (!MARKET_TABS.some(([code]) => filled(code))) {
      setItemError("Cần điền tên và giá cho ít nhất một thị trường.");
      return;
    }
    const currentItem = groups?.find((g) => g.groupKey === itemModal.categoryGroupKey)?.items.find((it) => it.groupKey === itemModal.groupKey);
    const blankWithData = MARKET_TABS.find(([code]) => !filled(code) && !!currentItem?.byMarket[code].itemId);
    if (blankWithData) {
      setItemTab(blankWithData[0]);
      setItemError(storeSaveErrorMessage(new Error(`market_has_data_${blankWithData[0]}`)));
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
      await saveStoreItemGroup(itemModal.categoryGroupKey, itemModal.groupKey, resolvedFields, itemProductId || null);
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

  function closeDelete() {
    setDeleteConfirm(null);
    setDeleteAllMarkets(false);
  }
  async function confirmDelete() {
    if (!deleteConfirm) return;
    const isCategory = deleteConfirm.kind === "category";
    // Default is the market being viewed only; "all markets" needs the
    // explicit checkbox in the dialog.
    const everywhere = deleteAllMarkets || deleteConfirm.marketsWithData.length <= 1;
    try {
      setDeleting(true);
      if (everywhere) {
        if (isCategory) await deleteStoreCategoryGroup(deleteConfirm.groupKey);
        else await deleteStoreItemGroup(deleteConfirm.groupKey);
      } else if (isCategory) await deleteStoreCategoryMarket(deleteConfirm.groupKey, deleteConfirm.market);
      else await deleteStoreItemMarket(deleteConfirm.groupKey, deleteConfirm.market);
      closeDelete();
      const what = isCategory ? "nhóm sản phẩm" : "sản phẩm";
      pushToast(everywhere ? `Đã xoá ${what} ở mọi thị trường` : `Đã ngừng bán ${what} ở thị trường ${MARKET_LABEL[deleteConfirm.market]}`);
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
          title={group.byMarket[viewMarket]?.title.trim() || `${primaryLabel(group.byMarket)} (không bán ở ${MARKET_LABEL[viewMarket]})`}
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
              {group.byMarket[viewMarket] ? (
                <button
                  title={`Ngừng bán ở ${MARKET_LABEL[viewMarket]}`}
                  onClick={() =>
                    setDeleteConfirm({
                      kind: "category",
                      groupKey: group.groupKey,
                      label: group.byMarket[viewMarket]?.title.trim() || primaryLabel(group.byMarket),
                      market: viewMarket,
                      marketsWithData: MARKET_TABS.filter(([code]) => !!group.byMarket[code]).map(([code]) => code),
                    })
                  }
                  style={{ border: "none", background: "none", cursor: "pointer", display: "flex" }}
                >
                  <Icon name="trash-2" size={16} color="var(--error)" />
                </button>
              ) : null}
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
                      <div style={{ fontSize: 12.5, color: "var(--text-muted)" }}>Không bán ở thị trường {MARKET_LABEL[viewMarket]} — bấm sửa để thêm.</div>
                    )}
                    <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>{marketCompleteness(item.byMarket)}</div>
                  </div>
                  <div style={{ fontWeight: 700, fontSize: 13.5, color: "var(--text-primary)" }}>{row.price}</div>
                  <div style={{ display: "flex", gap: 10 }}>
                    <button onClick={() => openEditItem(group.groupKey, item)} style={{ border: "none", background: "none", cursor: "pointer", display: "flex" }}>
                      <Icon name="pencil" size={16} color="var(--color-primary)" />
                    </button>
                    {row.itemId ? (
                      <button
                        title={`Ngừng bán ở ${MARKET_LABEL[viewMarket]}`}
                        onClick={() =>
                          setDeleteConfirm({
                            kind: "item",
                            groupKey: item.groupKey,
                            label: filled ? row.name : primaryLabel(item.byMarket),
                            market: viewMarket,
                            marketsWithData: MARKET_TABS.filter(([code]) => !!item.byMarket[code].itemId).map(([code]) => code),
                          })
                        }
                        style={{ border: "none", background: "none", cursor: "pointer", display: "flex" }}
                      >
                        <Icon name="trash-2" size={16} color="var(--error)" />
                      </button>
                    ) : null}
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
            Nhóm chính = thiết bị có lộ trình tập; nhóm phụ = phụ kiện. Lưu ý: danh sách chọn thiết bị trên tab Lộ trình của app KHÔNG đọc cờ này — nó đọc trạng thái Xuất bản ở tab Lộ trình. Cờ này chỉ phân nhóm trong Cửa hàng.
          </div>
          <PillTabs
            options={MARKET_TABS.map(([code, label]): [AdminMarket, string] => [code, categoryFields[code].title.trim() ? label : `${label} · trống`])}
            value={categoryTab}
            onChange={setCategoryTab}
          />
          <div style={{ marginBottom: 12 }}>
            <GhostBtn onClick={translateCategory} disabled={translating}>
              {translating ? "Đang dịch..." : "Dịch tên nhóm từ bản VN sang UK/ML"}
            </GhostBtn>
          </div>
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
          <div style={{ marginTop: 10, fontSize: 12, color: "var(--text-muted)" }}>
            Để trống tab của một thị trường = không bán nhóm này ở đó. Cần ít nhất một thị trường có tên.
          </div>
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
          <FieldLabel>Lộ trình liên kết</FieldLabel>
          <select value={itemProductId} onChange={(e) => setItemProductId(e.target.value)} style={{ ...inputStyle, marginBottom: 6 }}>
            <option value="">Không gắn lộ trình (phụ kiện)</option>
            {roadmapProducts.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
          <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 14 }}>
            Gắn mục bán hàng này với một lộ trình để tab Lộ trình hiển thị đúng &quot;Link sản phẩm&quot;. Áp dụng cho cả 3 thị trường.
          </div>
          <PillTabs
            options={MARKET_TABS.map(([code, label]): [AdminMarket, string] => [code, itemFields[code].name.trim() || itemFields[code].price.trim() ? label : `${label} · trống`])}
            value={itemTab}
            onChange={setItemTab}
          />
          <div style={{ marginBottom: 6 }}>
            <GhostBtn onClick={translateItem} disabled={translating}>
              {translating ? "Đang dịch..." : "Dịch tên & mô tả từ bản VN sang UK/ML"}
            </GhostBtn>
          </div>
          <div style={{ marginBottom: 12, fontSize: 12, color: "var(--text-muted)" }}>
            Chỉ dịch chữ. Giá, link và ảnh vẫn phải nhập riêng cho từng thị trường.
          </div>
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
          <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
            JPG, PNG hoặc WebP, tối đa 15 MB (tự nén khi tải lên). Để trống tên và giá ở tab của một thị trường = không bán ở đó; cần ít nhất một thị trường.
          </div>
          {itemError ? (
            <div style={{ marginTop: 12, padding: "10px 12px", borderRadius: 10, background: "rgba(220,53,69,0.08)", fontSize: 12.5, fontWeight: 600, color: "var(--error)", lineHeight: 1.5 }}>
              {itemError}
            </div>
          ) : null}
        </Modal>
      ) : null}
      {deleteConfirm ? (() => {
        const marketLabel = MARKET_LABEL[deleteConfirm.market];
        const others = deleteConfirm.marketsWithData.filter((code) => code !== deleteConfirm.market).map((code) => MARKET_LABEL[code]);
        const lastMarket = others.length === 0;
        const everywhere = deleteAllMarkets || lastMarket;
        const what = deleteConfirm.kind === "category" ? "nhóm" : "sản phẩm";
        return (
          <ConfirmModal
            title={deleteConfirm.kind === "category" ? "Ngừng bán nhóm sản phẩm" : "Ngừng bán sản phẩm"}
            message={
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <div>
                  Ngừng bán {what} <strong>“{deleteConfirm.label}”</strong> ở thị trường <strong>{marketLabel}</strong>?
                  {deleteConfirm.kind === "category" ? ` Toàn bộ sản phẩm trong nhóm này ở ${marketLabel} cũng bị xoá.` : ""}
                </div>
                {lastMarket ? (
                  <div style={{ color: "var(--error)", fontWeight: 600 }}>
                    Đây là thị trường cuối cùng còn {what} này — xoá xong sẽ biến mất hoàn toàn.
                  </div>
                ) : (
                  <>
                    <div style={{ color: "var(--text-secondary)" }}>Bản {others.join(", ")} giữ nguyên.</div>
                    <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                      <input type="checkbox" checked={deleteAllMarkets} onChange={(e) => setDeleteAllMarkets(e.target.checked)} />
                      Xoá ở mọi thị trường ({deleteConfirm.marketsWithData.map((code) => MARKET_LABEL[code]).join(", ")})
                    </label>
                  </>
                )}
                <div style={{ color: "var(--text-muted)", fontSize: 12.5 }}>Hành động này không thể hoàn tác.</div>
              </div>
            }
            confirmLabel={everywhere ? "Xoá ở mọi thị trường" : `Ngừng bán ở ${marketLabel}`}
            busy={deleting}
            onConfirm={confirmDelete}
            onCancel={closeDelete}
          />
        );
      })() : null}
    </div>
  );
}
