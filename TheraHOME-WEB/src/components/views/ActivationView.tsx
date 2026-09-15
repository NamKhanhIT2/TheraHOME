"use client";

// Kích hoạt: the phone/email allowed to activate each product. The mobile
// app's activation flow matches the user's entered contact against these rows
// — one product unlocks only if its own list contains that contact (see
// migration 202609011000_per_product_activation).
//
// Contacts arrive two ways. CSKH still types one in by hand, and since
// 202609151000 a Shopify order queues its own phone + email automatically,
// pending approval (`disabled = true` — listed here but granting nothing until
// someone presses Duyệt). An order's phone and email share a `sourceOrderId`,
// which is what lets one customer show as one line, "+84…/ khach@gmail.com",
// instead of two rows for the same person.
import { useEffect, useMemo, useState } from "react";
import {
  fetchActivationProducts,
  fetchProductActivationContacts,
  addProductActivationContact,
  deleteProductActivationContact,
  approveOrderActivationContacts,
  approveAllQueuedActivationContacts,
  dismissOrderActivationContacts,
  type ActivationProduct,
  type ActivationContact,
} from "@/lib/db";
import { SectionCard, PrimaryBtn, GhostBtn, Badge, inputStyle } from "@/components/ui/primitives";
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

/**
 * Dialling codes for the markets this store serves. The market cannot supply
 * one on its own — 'US' here covers "UK · Anh / EU / Mỹ", spanning +44, +1 and
 * the EU codes — so whoever types the number picks it.
 */
const DIALLING_CODES = ["84", "44", "60", "1"] as const;

/** How many queued orders to show before "Xem thêm". Deliberately small: the
 * per-product cards underneath are where a contact gets added BY HAND, and
 * that is still the only route for a customer who did not buy on Shopify. At
 * 20 rows the queue buried them under several screens of scrolling and the
 * manual box looked like it had been removed. */
const QUEUE_FIRST_PAGE = 6;
const QUEUE_MORE = 20;

/** What the database stores: E.164, no separators. The leading trunk zero of a
 * domestic number is dropped — it is not part of the international form, and a
 * contact saved as "+840912…" would match no customer. Emails pass through. */
function toStoredContact(diallingCode: string, typed: string): string {
  const value = typed.trim();
  if (value.includes("@")) return value;
  const digits = value.replace(/[^0-9]/g, "").replace(/^0+/, "");
  return digits ? `+${diallingCode}${digits}` : "";
}

/** Phone numbers stay in the stored E.164 form, only spaced out to be read.
 * The app serves VN, US and Malaysia, so the domestic "0902846888" is not an
 * option here: it is ambiguous across markets, and +1/+60 numbers have no
 * trunk zero to show in the first place. E.164 is also exactly the string the
 * customer has to match, so what CSKH reads is what the database compares.
 * The raw value is still one hover away (title=) and search accepts whatever
 * shape someone types. */
function formatContact(value: string, type: "email" | "phone"): string {
  if (type === "email" || !value.startsWith("+")) return value;
  const digits = value.slice(1);
  const code = DIALLING_CODES.find((c) => digits.startsWith(c));
  if (!code) return value;
  const national = digits.slice(code.length);
  const groups: string[] = [];
  for (let i = 0; i < national.length; i += 3) groups.push(national.slice(i, i + 3));
  // A trailing lone digit reads badly ("415 555 012 3") — fold it back.
  if (groups.length > 1 && groups[groups.length - 1].length === 1) {
    groups[groups.length - 2] += groups.pop();
  }
  return `+${code} ${groups.join(" ")}`;
}

/** One customer, not one contact: the phone and the email of a single order
 * are one entry. A hand-added contact has no order, so it stands alone. */
interface ContactGroup {
  key: string;
  productId: string;
  sourceOrderId: string | null;
  rows: ActivationContact[];
  /** "+84 856 239 030 / khach@gmail.com" — phone first, the way CSKH reads it. */
  label: string;
  /** Exact stored values, shown on hover and searched against. */
  rawLabel: string;
  /** Every digit of every contact, so a search typed in any shape still hits. */
  digits: string;
  note: string | null;
  claimedByUserId: string | null;
  claimedByName: string | null;
  pending: boolean;
}

function groupContacts(rows: ActivationContact[]): ContactGroup[] {
  const groups: ContactGroup[] = [];
  const byOrder = new Map<string, ContactGroup>();
  for (const row of rows) {
    const existing = row.sourceOrderId ? byOrder.get(row.sourceOrderId) : undefined;
    if (existing) {
      existing.rows.push(row);
      continue;
    }
    const group: ContactGroup = {
      key: row.sourceOrderId ?? row.id,
      productId: row.productId,
      sourceOrderId: row.sourceOrderId,
      rows: [row],
      label: "",
      rawLabel: "",
      digits: "",
      note: row.note,
      claimedByUserId: null,
      claimedByName: null,
      pending: row.disabled,
    };
    groups.push(group);
    if (row.sourceOrderId) byOrder.set(row.sourceOrderId, group);
  }
  for (const group of groups) {
    // Phone first — it is the contact the customer actually ordered with and
    // the one they are most likely to type into the app.
    group.rows.sort((a, b) => (a.contactType === b.contactType ? 0 : a.contactType === "phone" ? -1 : 1));
    group.label = group.rows.map((r) => formatContact(r.contactValue, r.contactType)).join(" / ");
    group.rawLabel = group.rows.map((r) => r.contactValue).join(" / ");
    group.digits = group.rows.map((r) => r.contactValue.replace(/[^0-9]/g, "")).join(" ");
    // `some`, not the first row: approving moves an order's phone and email
    // together, but if a pair ever ends up half-approved the order belongs in
    // the queue so someone can finish it, not silently in the granted list.
    group.pending = group.rows.some((r) => r.disabled);
    const claimed = group.rows.find((r) => r.claimedByUserId);
    group.claimedByUserId = claimed?.claimedByUserId ?? null;
    group.claimedByName = claimed?.claimedByName ?? null;
  }
  return groups;
}

function matchesFilter(group: ContactGroup, needle: string): boolean {
  if (!needle) return true;
  if (group.rawLabel.toLowerCase().includes(needle)) return true;
  if (group.label.toLowerCase().includes(needle)) return true;
  if ((group.claimedByName ?? "").toLowerCase().includes(needle)) return true;
  if ((group.note ?? "").toLowerCase().includes(needle)) return true;
  // Typing a number in any shape should find it: "0902846888", "902 846 888"
  // and "+84902846888" all reduce to the same digits, minus the trunk zero
  // that the E.164 form never carries.
  const typedDigits = needle.replace(/[^0-9]/g, "").replace(/^0+/, "");
  return typedDigits.length >= 4 && group.digits.includes(typedDigits);
}

export function ActivationView() {
  const [products, setProducts] = useState<ActivationProduct[] | null>(null);
  const [contacts, setContacts] = useState<ActivationContact[] | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [addingFor, setAddingFor] = useState<string | null>(null);
  const [addErrors, setAddErrors] = useState<Record<string, string>>({});
  const [codes, setCodes] = useState<Record<string, string>>({});
  const [filter, setFilter] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<ContactGroup | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [busyOrderId, setBusyOrderId] = useState<string | null>(null);
  const [queueShown, setQueueShown] = useState(QUEUE_FIRST_PAGE);
  const [approveAllOpen, setApproveAllOpen] = useState(false);
  const [approvingAll, setApprovingAll] = useState(false);
  const [dismissTarget, setDismissTarget] = useState<ContactGroup | null>(null);
  const [queueOpen, setQueueOpen] = useState(true);

  function reload() {
    Promise.all([fetchActivationProducts(), fetchProductActivationContacts()])
      .then(([prods, rows]) => {
        setProducts(prods);
        setContacts(rows);
      })
      .catch(() => pushToast("Không thể tải danh sách kích hoạt"));
  }
  useEffect(reload, []);

  const allGroups = useMemo(() => groupContacts(contacts ?? []), [contacts]);
  const needle = filter.trim().toLowerCase();

  /** Queued orders, newest first — the order they were placed in is what CSKH
   * cares about, and fetchProductActivationContacts already sorts by created. */
  const queue = useMemo(
    () => allGroups.filter((g) => g.pending).filter((g) => matchesFilter(g, needle)),
    [allGroups, needle],
  );
  const queueTotal = useMemo(() => allGroups.filter((g) => g.pending).length, [allGroups]);

  const liveByProduct = useMemo(() => {
    const map = new Map<string, ContactGroup[]>();
    for (const group of allGroups) {
      if (group.pending) continue;
      if (!matchesFilter(group, needle)) continue;
      const list = map.get(group.productId) ?? [];
      list.push(group);
      map.set(group.productId, list);
    }
    return map;
  }, [allGroups, needle]);

  const productNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of products ?? []) map.set(p.id, p.name);
    return map;
  }, [products]);

  async function addContact(productId: string) {
    const draft = (drafts[productId] ?? "").trim();
    // Was `|| addingFor`: adding a contact to product B while product A's
    // add was in flight was silently dropped.
    if (!draft || addingFor === productId) return;
    try {
      setAddingFor(productId);
      setAddErrors((cur) => ({ ...cur, [productId]: "" }));
      await addProductActivationContact(productId, toStoredContact(codes[productId] ?? "84", draft));
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

  async function approveOrder(group: ContactGroup) {
    if (!group.sourceOrderId || busyOrderId) return;
    try {
      setBusyOrderId(group.sourceOrderId);
      await approveOrderActivationContacts(group.sourceOrderId);
      pushToast("Đã duyệt · khách kích hoạt được ngay");
      reload();
    } catch (error) {
      console.error("Unable to approve order activation contacts", error);
      pushToast("Không thể duyệt. Vui lòng thử lại.");
    } finally {
      setBusyOrderId(null);
    }
  }

  async function dismissOrder(group: ContactGroup) {
    if (!group.sourceOrderId || busyOrderId) return;
    try {
      setBusyOrderId(group.sourceOrderId);
      await dismissOrderActivationContacts(group.sourceOrderId);
      setDismissTarget(null);
      pushToast("Đã bỏ qua đơn này");
      reload();
    } catch (error) {
      console.error("Unable to dismiss order activation contacts", error);
      pushToast("Không thể bỏ qua. Vui lòng thử lại.");
    } finally {
      setBusyOrderId(null);
    }
  }

  async function confirmApproveAll() {
    try {
      setApprovingAll(true);
      const count = await approveAllQueuedActivationContacts();
      setApproveAllOpen(false);
      pushToast(`Đã duyệt ${count} liên hệ từ đơn Shopify`);
      reload();
    } catch (error) {
      console.error("Unable to approve the activation queue", error);
      pushToast("Không thể duyệt hàng loạt. Vui lòng thử lại.");
    } finally {
      setApprovingAll(false);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    try {
      setDeleting(true);
      // A grouped row is one customer, so deleting it removes both their phone
      // and their email — leaving one behind would keep the product unlockable.
      for (const row of deleteTarget.rows) await deleteProductActivationContact(row.id);
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
          Thêm số điện thoại/email của khách vào đúng sản phẩm họ đã mua. Khi khách nhập thông tin này trong app, chỉ lộ trình của các sản phẩm có tên họ trong danh sách mới được mở khoá. Hai đường vào: đơn Shopify tự rơi vào mục &quot;chờ duyệt&quot;, còn khách mua ngoài Shopify thì thêm tay ở ô của từng sản phẩm.
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, background: "#fff", border: "1px solid var(--border-input)", borderRadius: 10, padding: "8px 12px", width: 260 }}>
          <Icon name="search" size={15} color="var(--text-muted)" />
          <input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Tìm SĐT/email/mã đơn/tên khách..."
            style={{ border: "none", outline: "none", flex: 1, fontFamily: "var(--font-family)", fontSize: 13 }}
          />
        </div>
      </div>

      {queueTotal > 0 ? (
        <SectionCard
          title="Đơn Shopify chờ duyệt"
          action={
            <span style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 12, color: "var(--text-muted)" }}>
              <span style={{ fontWeight: 700, color: "#B9860B", background: "rgba(185,134,11,0.12)", borderRadius: 999, padding: "2px 8px" }}>
                {queueTotal} đơn
              </span>
              <PrimaryBtn icon="check" onClick={() => setApproveAllOpen(true)} disabled={approvingAll}>
                Duyệt tất cả
              </PrimaryBtn>
              <button
                onClick={() => setQueueOpen((open) => !open)}
                aria-label={queueOpen ? "Thu gọn hàng chờ" : "Mở hàng chờ"}
                title={queueOpen ? "Thu gọn để xem danh sách sản phẩm bên dưới" : "Mở hàng chờ"}
                style={{ border: "none", background: "none", cursor: "pointer", display: "flex", padding: 4 }}
              >
                <Icon name={queueOpen ? "chevron-down" : "chevron-right"} size={18} color="var(--text-muted)" />
              </button>
            </span>
          }
        >
          <div style={{ fontSize: 12.5, color: "var(--text-secondary)", marginBottom: queueOpen ? 8 : 0 }}>
            Đơn từ Shopify về đây tự động và <strong>chưa cấp quyền gì</strong>. Bấm Duyệt thì khách kích hoạt được bằng SĐT hoặc email của đơn; nếu khách đã có tài khoản, lộ trình mở khoá ngay.{" "}
            <strong>Khách không mua qua Shopify</strong> thì thêm tay ở ô của từng sản phẩm bên dưới, như trước nay.
          </div>
          {queueOpen ? (
          <>
          {queue.length === 0 ? (
            <div style={{ padding: "16px 0", textAlign: "center", color: "var(--text-muted)", fontSize: 13 }}>
              Không có đơn nào khớp tìm kiếm.
            </div>
          ) : (
            queue.slice(0, queueShown).map((group, i) => (
              <div key={group.key} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0", borderTop: i > 0 ? "1px solid var(--divider)" : "none" }}>
                <Icon name="shopping-bag" size={15} color="var(--text-muted)" />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div title={group.rawLabel} style={{ fontWeight: 600, fontSize: 13.5, color: "var(--text-primary)", wordBreak: "break-word" }}>{group.label}</div>
                  <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 1 }}>
                    {group.note ?? "Đơn Shopify"}
                    {products.length > 1 ? ` · ${productNameById.get(group.productId) ?? group.productId}` : ""}
                  </div>
                </div>
                <PrimaryBtn icon="check" onClick={() => approveOrder(group)} disabled={busyOrderId !== null}>
                  {busyOrderId === group.sourceOrderId ? "Đang xử lý..." : "Duyệt"}
                </PrimaryBtn>
                <GhostBtn color="var(--error)" onClick={() => setDismissTarget(group)} disabled={busyOrderId !== null}>
                  Bỏ qua
                </GhostBtn>
              </div>
            ))
          )}
          {queue.length > queueShown ? (
            <div style={{ textAlign: "center", paddingTop: 12 }}>
              <GhostBtn onClick={() => setQueueShown((n) => n + QUEUE_MORE)}>
                Xem thêm ({queue.length - queueShown} đơn)
              </GhostBtn>
            </div>
          ) : null}
          </>
          ) : null}
        </SectionCard>
      ) : null}

      {products.map((product) => {
        const rows = liveByProduct.get(product.id) ?? [];
        const total = allGroups.filter((g) => !g.pending && g.productId === product.id).length;
        return (
          <SectionCard
            key={product.id}
            title={product.name}
            action={
              <span style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 12, color: "var(--text-muted)" }}>
                {!product.roadmapPublished ? (
                  <span title="Khách kích hoạt sẽ thấy thẻ 'Lộ trình đang hoàn thiện' cho tới khi Admin xuất bản ở tab Lộ trình" style={{ fontWeight: 700, color: "#B9860B", background: "rgba(185,134,11,0.12)", borderRadius: 999, padding: "2px 8px" }}>
                    Lộ trình chưa xuất bản
                  </span>
                ) : null}
                {total} khách
              </span>
            }
          >
            <div style={{ display: "flex", gap: 10, marginBottom: 6 }}>
              {!(drafts[product.id] ?? "").includes("@") ? (
                <select
                  value={codes[product.id] ?? "84"}
                  onChange={(e) => setCodes((cur) => ({ ...cur, [product.id]: e.target.value }))}
                  aria-label="Mã quốc gia"
                  style={{ ...inputStyle, width: 92, flex: "none" }}
                >
                  {DIALLING_CODES.map((code) => (
                    <option key={code} value={code}>+{code}</option>
                  ))}
                </select>
              ) : null}
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
              rows.map((group, i) => (
                <div key={group.key} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0", borderTop: i > 0 ? "1px solid var(--divider)" : "none" }}>
                  <Icon
                    name={group.sourceOrderId ? "shopping-bag" : group.rows[0].contactType === "email" ? "send" : "phone"}
                    size={15}
                    color="var(--text-muted)"
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div title={group.rawLabel} style={{ fontWeight: 600, fontSize: 13.5, color: "var(--text-primary)", wordBreak: "break-word" }}>{group.label}</div>
                    {group.note ? <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 1 }}>{group.note}</div> : null}
                  </div>
                  {group.claimedByUserId ? (
                    <Badge color="#1E9E5E" bg="rgba(30,158,94,0.12)">
                      Đã kích hoạt{group.claimedByName ? ` · ${group.claimedByName}` : ""}
                    </Badge>
                  ) : (
                    <Badge color="#8A93A3" bg="rgba(138,147,163,0.12)">Chưa sử dụng</Badge>
                  )}
                  <button onClick={() => setDeleteTarget(group)} style={{ border: "none", background: "none", cursor: "pointer", display: "flex" }}>
                    <Icon name="trash-2" size={16} color="var(--error)" />
                  </button>
                </div>
              ))
            )}
          </SectionCard>
        );
      })}

      {dismissTarget ? (
        <ConfirmModal
          title="Bỏ qua đơn này"
          message={
            `Bỏ "${dismissTarget.label}" khỏi hàng chờ? Đơn hàng vẫn còn trong hệ thống, ` +
            "nhưng dòng chờ duyệt bị xoá hẳn và sẽ không tự hiện lại — muốn cấp quyền sau thì phải thêm tay."
          }
          confirmLabel="Bỏ qua"
          busy={busyOrderId === dismissTarget.sourceOrderId}
          onConfirm={() => dismissOrder(dismissTarget)}
          onCancel={() => setDismissTarget(null)}
        />
      ) : null}

      {approveAllOpen ? (
        <ConfirmModal
          title="Duyệt toàn bộ hàng chờ"
          message={
            `Duyệt tất cả ${queueTotal} đơn Shopify đang chờ? Mọi SĐT/email trong đó sẽ kích hoạt được ngay, ` +
            "và khách nào đã có tài khoản sẽ được mở lộ trình lập tức. Đơn huỷ hoặc đơn thử nghiệm (nếu có) cũng được duyệt theo — " +
            "nên bỏ qua chúng trước nếu bạn muốn lọc."
          }
          confirmLabel="Duyệt tất cả"
          busy={approvingAll}
          onConfirm={confirmApproveAll}
          onCancel={() => setApproveAllOpen(false)}
        />
      ) : null}

      {deleteTarget ? (
        <ConfirmModal
          title="Xoá liên hệ kích hoạt"
          message={
            `Xoá "${deleteTarget.label}" khỏi danh sách kích hoạt của sản phẩm này?` +
            (deleteTarget.rows.length > 1 ? " Cả số điện thoại lẫn email của khách này đều bị xoá." : "") +
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
