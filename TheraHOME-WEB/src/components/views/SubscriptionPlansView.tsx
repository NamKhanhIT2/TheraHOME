"use client";

// Real data: subscription_plans — the tier cards on the mobile app's paywall.
//
// Copy only. Saving here changes what the paywall SAYS; it grants nothing.
// The quotas written into the feature lines are enforced elsewhere, by
// server-side functions of their own (chấm dáng tập by
// `form_review_monthly_allowance()`), so raising "4 lượt" to "8 lượt" in this
// editor without changing that function makes the app promise more than it
// delivers. The warning under the table says so to whoever is editing.
import { Fragment, useState, useEffect, useCallback } from "react";
import { TableShell } from "@/components/ui/TableShell";
import { SectionCard } from "@/components/ui/primitives";
import { Modal } from "@/components/ui/Modal";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { PrimaryBtn, GhostBtn, Badge, FieldLabel, inputStyle, PillTabs, MissingTranslationNote } from "@/components/ui/primitives";
import { Icon } from "@/components/ui/Icon";
import { pushToast } from "@/components/ui/Toast";
import { errorMessage } from "@/lib/errorMessage";
import {
  fetchSubscriptionPlans,
  saveSubscriptionPlan,
  deleteSubscriptionPlan,
  reorderSubscriptionPlans,
  type SubscriptionPlanAdmin,
  type PlanFeature,
  type PlanBilling,
  fetchSubscriptionOps,
  type SubscriptionOps,
  fetchSubscriptionHolders,
  grantSubscription,
  revokeSubscription,
  searchCustomers,
  type SubscriptionHolder,
} from "@/lib/db";
import { translateDrafts } from "@/lib/translate";

type Lang = "vi" | "en" | "ms";
const LANGS: Array<[Lang, string]> = [
  ["vi", "VN"],
  ["en", "UK"],
  ["ms", "ML"],
];

// Every name here must exist in BOTH icon sets — web's
// src/components/ui/Icon.tsx (a switch) and the app's
// src/components/icons/Icon.tsx (a lucide map). A name missing from the app
// falls back to a plain circle there, which looks like a bug; one missing
// from web renders nothing at all in this editor. The list is deliberately
// short and checked against both files rather than open to free text.
const ICON_CHOICES: Array<[string, string]> = [
  ["check", "Dấu tích (mặc định)"],
  ["sparkles", "AI / Chat AI"],
  ["phone", "Gọi điện / gọi video"],
  ["film", "Video / chấm dáng tập"],
  ["camera", "Máy ảnh"],
  ["clipboard-check", "Lộ trình"],
  ["dumbbell", "Bài tập"],
  ["activity", "Nhật ký đau"],
  ["droplet", "Uống nước"],
  ["users", "Cộng đồng"],
  ["message-circle", "Nhắn tin"],
  ["bell", "Nhắc nhở"],
  ["clock", "Thời gian phản hồi"],
  ["trending-up", "Báo cáo tiến độ"],
  ["star", "Ưu tiên"],
  ["shield", "Hỗ trợ / bảo đảm"],
  ["heart", "Sức khoẻ"],
  ["shopping-bag", "Ưu đãi mua hàng"],
  ["calendar", "Lịch"],
  ["download", "Tải về"],
];

function emptyPlan(sortOrder: number): SubscriptionPlanAdmin {
  return {
    id: "new",
    code: "",
    billing: "subscription",
    sortOrder,
    active: true,
    highlighted: false,
    nameVi: "",
    nameEn: "",
    nameMs: "",
    taglineVi: "",
    taglineEn: "",
    taglineMs: "",
    badgeVi: "",
    badgeEn: "",
    badgeMs: "",
    priceLabelVi: "",
    priceLabelEn: "",
    priceLabelMs: "",
    periodLabelVi: "mỗi tháng",
    periodLabelEn: "per month",
    periodLabelMs: "sebulan",
    features: [],
    appleProductId: "",
    googleProductId: "",
    aiChatPerDay: "",
    callMinutesPerMonth: "",
    formReviewMbPerMonth: "",
    perkDiscountPercent: "",
    perkDiscountCode: "",
  };
}

const SUFFIX: Record<Lang, "Vi" | "En" | "Ms"> = { vi: "Vi", en: "En", ms: "Ms" };
type ScalarField = "name" | "tagline" | "badge" | "priceLabel" | "periodLabel";

export function SubscriptionPlansView() {
  const [plans, setPlans] = useState<SubscriptionPlanAdmin[] | null>(null);
  const [draft, setDraft] = useState<SubscriptionPlanAdmin | null>(null);
  const [lang, setLang] = useState<Lang>("vi");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<SubscriptionPlanAdmin | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [rowBusy, setRowBusy] = useState<string | null>(null);
  const [ops, setOps] = useState<SubscriptionOps | null>(null);

  function reload() {
    // Reloaded with the plans because editing a price changes every number in
    // the panel. A failure here must not hide the editor: the panel is for
    // watching, the table is for working.
    void fetchSubscriptionOps()
      .then(setOps)
      .catch(() => setOps(null));
    return fetchSubscriptionPlans()
      .then(setPlans)
      .catch(() => pushToast("Không thể tải danh sách gói"));
  }
  useEffect(() => {
    void reload();
  }, []);

  function get(plan: SubscriptionPlanAdmin, field: ScalarField, language: Lang): string {
    return String(plan[`${field}${SUFFIX[language]}` as keyof SubscriptionPlanAdmin] ?? "");
  }
  function set(field: ScalarField, language: Lang, value: string) {
    setDraft((current) => (current ? { ...current, [`${field}${SUFFIX[language]}`]: value } : current));
  }
  function setFeature(index: number, patch: Partial<PlanFeature>) {
    setDraft((current) => {
      if (!current) return current;
      const features = current.features.slice();
      features[index] = { ...features[index], ...patch };
      return { ...current, features };
    });
  }
  function moveFeature(index: number, direction: -1 | 1) {
    setDraft((current) => {
      if (!current) return current;
      const target = index + direction;
      if (target < 0 || target >= current.features.length) return current;
      const features = current.features.slice();
      [features[index], features[target]] = [features[target], features[index]];
      return { ...current, features };
    });
  }

  async function save() {
    if (!draft || saving) return;
    if (!draft.code.trim()) {
      pushToast("Cần nhập mã gói (code)");
      return;
    }
    if (!draft.nameVi.trim()) {
      pushToast("Cần nhập tên gói tiếng Việt");
      return;
    }
    // `code` is the stable key the app recognises a tier by, and it is
    // unique in the database — catching the clash here gives a sentence
    // instead of a Postgres constraint name.
    if (plans?.some((p) => p.id !== draft.id && p.code.trim() === draft.code.trim())) {
      pushToast("Mã gói này đã tồn tại");
      return;
    }
    setSaving(true);
    try {
      let toSave = draft;
      // Auto-draft UK/ML from the Vietnamese, same as the FAQ/quiz editors.
      // Price is deliberately NOT sent: "99.000đ" is a number in a currency,
      // not a sentence, and a translator turns it into something wrong. Staff
      // types each market's price, or leaves it blank to show the Vietnamese.
      const source: Record<string, string> = {};
      if (!draft.nameEn.trim() || !draft.nameMs.trim()) source.name = draft.nameVi;
      if (draft.taglineVi.trim() && (!draft.taglineEn.trim() || !draft.taglineMs.trim())) source.tagline = draft.taglineVi;
      if (draft.badgeVi.trim() && (!draft.badgeEn.trim() || !draft.badgeMs.trim())) source.badge = draft.badgeVi;
      if (draft.periodLabelVi.trim() && (!draft.periodLabelEn.trim() || !draft.periodLabelMs.trim())) {
        source.period = draft.periodLabelVi;
      }
      draft.features.forEach((feature, index) => {
        if (feature.vi.trim() && (!feature.en.trim() || !feature.ms.trim())) source[`f${index}`] = feature.vi;
      });

      let drafted = false;
      const drafts = Object.keys(source).length ? await translateDrafts(source) : null;
      if (drafts) {
        const pick = (key: string, existing: string, language: "en" | "ms") =>
          existing.trim() || drafts[language][key] || "";
        toSave = {
          ...draft,
          nameEn: pick("name", draft.nameEn, "en"),
          nameMs: pick("name", draft.nameMs, "ms"),
          taglineEn: pick("tagline", draft.taglineEn, "en"),
          taglineMs: pick("tagline", draft.taglineMs, "ms"),
          badgeEn: pick("badge", draft.badgeEn, "en"),
          badgeMs: pick("badge", draft.badgeMs, "ms"),
          periodLabelEn: pick("period", draft.periodLabelEn, "en"),
          periodLabelMs: pick("period", draft.periodLabelMs, "ms"),
          features: draft.features.map((feature, index) => ({
            ...feature,
            en: pick(`f${index}`, feature.en, "en"),
            ms: pick(`f${index}`, feature.ms, "ms"),
          })),
        };
        drafted = true;
      }
      await saveSubscriptionPlan(toSave);
      setDraft(null);
      await reload();
      pushToast(drafted ? "Đã lưu · đã tự dịch nháp UK/ML" : "Đã lưu gói");
    } catch {
      pushToast("Không thể lưu — kiểm tra kết nối hoặc quyền admin");
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!deleting || deleteBusy) return;
    setDeleteBusy(true);
    try {
      await deleteSubscriptionPlan(deleting.id);
      await reload();
      pushToast("Đã xoá gói");
    } catch {
      pushToast("Không thể xoá");
    } finally {
      setDeleteBusy(false);
      setDeleting(null);
    }
  }

  async function move(index: number, direction: -1 | 1) {
    if (!plans || rowBusy) return;
    const next = plans.slice();
    const target = index + direction;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    setPlans(next);
    setRowBusy("reorder");
    try {
      await reorderSubscriptionPlans(next.map((p) => p.id));
    } catch {
      pushToast("Không thể đổi thứ tự");
      void reload();
    } finally {
      setRowBusy(null);
    }
  }

  /** Writes the WHOLE row, so it re-reads the current copy first — a stale
   * render would republish old prices. Same guard as the FAQ editor. */
  async function patchRow(plan: SubscriptionPlanAdmin, patch: Partial<SubscriptionPlanAdmin>) {
    if (rowBusy) return;
    setRowBusy(plan.id);
    try {
      const current = plans?.find((p) => p.id === plan.id) ?? plan;
      await saveSubscriptionPlan({ ...current, ...patch });
      await reload();
    } catch {
      pushToast("Không thể cập nhật");
    } finally {
      setRowBusy(null);
    }
  }

  /** Only one card can carry the accent/"nổi bật" treatment — turning one on
   * turns the others off, or the paywall shows three "recommended" tiers. */
  async function highlight(plan: SubscriptionPlanAdmin) {
    if (rowBusy || !plans) return;
    setRowBusy(plan.id);
    try {
      for (const row of plans) {
        const wanted = row.id === plan.id ? !plan.highlighted : false;
        if (row.highlighted !== wanted) await saveSubscriptionPlan({ ...row, highlighted: wanted });
      }
      await reload();
    } catch {
      pushToast("Không thể cập nhật");
    } finally {
      setRowBusy(null);
    }
  }

  if (!plans) return <div style={{ color: "var(--text-secondary)", padding: 20 }}>Đang tải...</div>;

  const label = lang === "vi" ? "VN" : lang === "en" ? "UK" : "ML";

  return (
    <div>
      {ops ? <OpsPanel ops={ops} /> : null}
      <TableShell
      subtitle="Các gói hiển thị trên màn hình nâng cấp của app. Sửa ở đây là app cập nhật trong ít phút, không cần bản build mới."
      action={<PrimaryBtn icon="plus" onClick={() => { setDraft(emptyPlan(plans.length + 1)); setLang("vi"); }}>Thêm gói</PrimaryBtn>}
      columns={["Thứ tự", "Gói", "Giá", "Quyền lợi", "Sản phẩm store", "Trạng thái", "Thao tác"]}
      modals={
        <Fragment>
          {draft ? (
            <Modal
              title={draft.id === "new" ? "Thêm gói" : `Sửa gói · ${draft.nameVi || draft.code}`}
              onClose={() => setDraft(null)}
              width={720}
              footer={
                <Fragment>
                  <GhostBtn onClick={() => setDraft(null)}>Hủy</GhostBtn>
                  <PrimaryBtn onClick={save} disabled={saving}>{saving ? "Đang lưu..." : "Lưu"}</PrimaryBtn>
                </Fragment>
              }
            >
              <PillTabs options={LANGS} value={lang} onChange={setLang} />
              {lang !== "vi" ? (
                <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 12 }}>
                  Để trống thì app hiển thị bản tiếng Việt. Khi lưu, hệ thống tự dịch nháp các ô còn trống —
                  riêng giá thì không, giá phải tự nhập cho từng thị trường.
                </div>
              ) : null}

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                <div>
                  <FieldLabel>Tên gói ({label})</FieldLabel>
                  <input
                    value={get(draft, "name", lang)}
                    onChange={(e) => set("name", lang, e.target.value)}
                    placeholder={lang === "vi" ? "Ví dụ: Đồng hành" : draft.nameVi}
                    style={inputStyle}
                  />
                </div>
                <div>
                  <FieldLabel>Nhãn nổi bật ({label})</FieldLabel>
                  <input
                    value={get(draft, "badge", lang)}
                    onChange={(e) => set("badge", lang, e.target.value)}
                    placeholder={lang === "vi" ? "Ví dụ: Gói nên thử — để trống là không hiện nhãn" : draft.badgeVi}
                    style={inputStyle}
                  />
                </div>
              </div>

              <div style={{ marginTop: 14 }}>
                <FieldLabel>Mô tả ngắn ({label})</FieldLabel>
                <input
                  value={get(draft, "tagline", lang)}
                  onChange={(e) => set("tagline", lang, e.target.value)}
                  placeholder={lang === "vi" ? "Một câu dưới tên gói" : draft.taglineVi}
                  style={inputStyle}
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginTop: 14 }}>
                <div>
                  <FieldLabel>Giá hiển thị ({label})</FieldLabel>
                  <input
                    value={get(draft, "priceLabel", lang)}
                    onChange={(e) => set("priceLabel", lang, e.target.value)}
                    placeholder={lang === "vi" ? "Ví dụ: 99.000đ" : "Ví dụ: $3.99"}
                    style={inputStyle}
                  />
                </div>
                <div>
                  <FieldLabel>Đơn vị ({label})</FieldLabel>
                  <input
                    value={get(draft, "periodLabel", lang)}
                    onChange={(e) => set("periodLabel", lang, e.target.value)}
                    placeholder={lang === "vi" ? "mỗi tháng — để trống nếu là gói miễn phí" : draft.periodLabelVi}
                    style={inputStyle}
                  />
                </div>
              </div>
              {lang === "vi" ? (
                <div style={{ fontSize: 11.5, color: "var(--text-muted)", marginTop: 6 }}>
                  Khi gói đã có mã sản phẩm trên store, app hiển thị giá thật do Apple/Google trả về; ô này chỉ là giá dự phòng.
                </div>
              ) : null}

              {/* Quyền lợi */}
              <div style={{ marginTop: 20, borderTop: "1px solid var(--divider)", paddingTop: 16 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                  <FieldLabel>Quyền lợi ({label})</FieldLabel>
                  {lang === "vi" ? (
                    <GhostBtn onClick={() => setDraft({ ...draft, features: [...draft.features, { icon: "check", vi: "", en: "", ms: "" }] })}>
                      + Thêm dòng
                    </GhostBtn>
                  ) : null}
                </div>
                {draft.features.length === 0 ? (
                  <div style={{ fontSize: 12.5, color: "var(--text-muted)" }}>Chưa có dòng quyền lợi nào.</div>
                ) : null}
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {draft.features.map((feature, index) => (
                    <div key={index} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      {lang === "vi" ? (
                        <select
                          value={feature.icon || "check"}
                          onChange={(e) => setFeature(index, { icon: e.target.value })}
                          style={{ ...inputStyle, width: 190, flexShrink: 0 }}
                        >
                          {ICON_CHOICES.map(([value, text]) => (
                            <option key={value} value={value}>{text}</option>
                          ))}
                        </select>
                      ) : (
                        <div style={{ width: 28, flexShrink: 0, display: "flex", justifyContent: "center" }}>
                          <Icon name={feature.icon || "check"} size={16} color="var(--text-muted)" />
                        </div>
                      )}
                      <input
                        value={lang === "vi" ? feature.vi : lang === "en" ? feature.en : feature.ms}
                        onChange={(e) => setFeature(index, lang === "vi" ? { vi: e.target.value } : lang === "en" ? { en: e.target.value } : { ms: e.target.value })}
                        placeholder={lang === "vi" ? "Ví dụ: Chat AI không giới hạn" : feature.vi}
                        style={{ ...inputStyle, flex: 1 }}
                      />
                      {lang === "vi" ? (
                        <Fragment>
                          <button onClick={() => moveFeature(index, -1)} disabled={index === 0} style={arrowStyle(index === 0)} title="Lên">
                            <Icon name="chevron-down" size={14} color="var(--text-secondary)" />
                          </button>
                          <button onClick={() => moveFeature(index, 1)} disabled={index === draft.features.length - 1} style={arrowStyle(index === draft.features.length - 1)} title="Xuống">
                            <Icon name="chevron-down" size={14} color="var(--text-secondary)" />
                          </button>
                          <GhostBtn color="var(--error)" onClick={() => setDraft({ ...draft, features: draft.features.filter((_, i) => i !== index) })}>
                            Xoá
                          </GhostBtn>
                        </Fragment>
                      ) : null}
                    </div>
                  ))}
                </div>
              </div>

              {/* Cấu hình chung — không phụ thuộc ngôn ngữ */}
              {lang === "vi" ? (
                <div style={{ marginTop: 20, borderTop: "1px solid var(--divider)", paddingTop: 16 }}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                    <div>
                      <FieldLabel>Mã gói (code)</FieldLabel>
                      <input
                        value={draft.code}
                        onChange={(e) => setDraft({ ...draft, code: e.target.value })}
                        placeholder="free / companion / intensive"
                        style={inputStyle}
                      />
                      <div style={{ fontSize: 11.5, color: "var(--text-muted)", marginTop: 6 }}>
                        Khoá cố định để app nhận ra gói. Đổi tên gói thì giữ nguyên mã này.
                      </div>
                    </div>
                    <div>
                      <FieldLabel>Loại thanh toán</FieldLabel>
                      <select
                        value={draft.billing}
                        onChange={(e) => setDraft({ ...draft, billing: e.target.value as PlanBilling })}
                        style={inputStyle}
                      >
                        <option value="subscription">Thuê bao — tự gia hạn</option>
                        <option value="lifetime">Trọn đời — trả một lần</option>
                      </select>
                      <div style={{ fontSize: 11.5, color: "var(--text-muted)", marginTop: 6 }}>
                        Không chỉ là nhãn: hai loại này là hai kiểu sản phẩm khác nhau trên store. Trọn đời phải tạo bằng
                        Non-Consumable (Apple) / sản phẩm một lần (Google), không nằm trong nhóm thuê bao.
                      </div>
                    </div>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginTop: 14 }}>
                    <div>
                      <FieldLabel>Hiển thị nổi bật</FieldLabel>
                      <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--text-primary)", marginTop: 8 }}>
                        <input
                          type="checkbox"
                          checked={draft.highlighted}
                          onChange={(e) => setDraft({ ...draft, highlighted: e.target.checked })}
                        />
                        Thẻ này được tô viền và đứng trước
                      </label>
                    </div>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginTop: 14 }}>
                    <div>
                      <FieldLabel>Mã sản phẩm Apple</FieldLabel>
                      <input
                        value={draft.appleProductId}
                        onChange={(e) => setDraft({ ...draft, appleProductId: e.target.value })}
                        placeholder="Để trống nếu chưa tạo trên App Store Connect"
                        style={inputStyle}
                      />
                    </div>
                    <div>
                      <FieldLabel>Mã sản phẩm Google</FieldLabel>
                      <input
                        value={draft.googleProductId}
                        onChange={(e) => setDraft({ ...draft, googleProductId: e.target.value })}
                        placeholder="Để trống nếu chưa tạo trên Play Console"
                        style={inputStyle}
                      />
                    </div>
                  </div>
                  <div style={{ fontSize: 11.5, color: "var(--text-muted)", marginTop: 6 }}>
                    Thiếu mã của nền tảng nào thì app ẩn nút mua trên nền tảng đó, thay vì mở một giao dịch không thể hoàn tất.
                  </div>

                  <div style={{ marginTop: 20, borderTop: "1px solid var(--divider)", paddingTop: 16 }}>
                    <FieldLabel>Hạn mức của gói</FieldLabel>
                    <div style={{ fontSize: 11.5, color: "var(--text-muted)", marginBottom: 10 }}>
                      Đây là số mà máy chủ thực sự kiểm tra, không phải chữ hiển thị. Nhớ sửa dòng quyền lợi ở trên cho khớp —
                      thẻ ghi một con số mà hệ thống cho một con số khác là lỗi người dùng nhìn thấy đầu tiên.
                      Để trống = không giới hạn. Nhập 0 = không có quyền dùng.
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14 }}>
                      <div>
                        <FieldLabel>Chat AI (lượt/ngày)</FieldLabel>
                        <input
                          value={draft.aiChatPerDay}
                          onChange={(e) => setDraft({ ...draft, aiChatPerDay: e.target.value })}
                          placeholder="trống = vô hạn"
                          inputMode="numeric"
                          style={inputStyle}
                        />
                      </div>
                      <div>
                        <FieldLabel>Gọi video (phút/tháng)</FieldLabel>
                        <input
                          value={draft.callMinutesPerMonth}
                          onChange={(e) => setDraft({ ...draft, callMinutesPerMonth: e.target.value })}
                          placeholder="trống = vô hạn"
                          inputMode="numeric"
                          style={inputStyle}
                        />
                      </div>
                      <div>
                        <FieldLabel>Chấm dáng tập (MB/tháng)</FieldLabel>
                        <input
                          value={draft.formReviewMbPerMonth}
                          onChange={(e) => setDraft({ ...draft, formReviewMbPerMonth: e.target.value })}
                          placeholder="trống = vô hạn"
                          inputMode="numeric"
                          style={inputStyle}
                        />
                      </div>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 14, marginTop: 14 }}>
                      <div>
                        <FieldLabel>Giảm giá thiết bị (%)</FieldLabel>
                        <input
                          value={draft.perkDiscountPercent}
                          onChange={(e) => setDraft({ ...draft, perkDiscountPercent: e.target.value })}
                          placeholder="trống = không có"
                          inputMode="numeric"
                          style={inputStyle}
                        />
                      </div>
                      <div>
                        <FieldLabel>Mã giảm giá Shopify</FieldLabel>
                        <input
                          value={draft.perkDiscountCode}
                          onChange={(e) => setDraft({ ...draft, perkDiscountCode: e.target.value })}
                          placeholder="THERAPLUS10"
                          style={inputStyle}
                        />
                        <div style={{ fontSize: 11.5, color: "var(--text-muted)", marginTop: 6 }}>
                          <strong>Phải tạo mã này trong Shopify trước.</strong> App chỉ hiện mã cho người đang giữ gói, không
                          kiểm tra được nó có hiệu lực hay không — mã sai thì khách đọc ra một lời hứa bị gãy.
                        </div>
                      </div>
                    </div>
                    <div style={{ fontSize: 11.5, color: "var(--text-muted)", marginTop: 8 }}>
                      Số buổi gọi và số clip đều không bị giới hạn — chỉ tổng số phút và tổng dung lượng. Một clip 15 giây nặng
                      khoảng 5 MB, nên 200 MB ≈ 40 clip. Cả ba gói đang để gọi &quot;vô hạn&quot; (ô phút để trống), nghĩa là
                      không có mức chặn nào phía sau: hạn mức miễn phí của LiveKit là khoảng 41 giờ gọi mỗi tháng cho toàn bộ app.
                    </div>
                  </div>
                </div>
              ) : null}
            </Modal>
          ) : null}
          {deleting ? (
            <ConfirmModal
              title="Xoá gói"
              message={`Xoá gói "${deleting.nameVi}" khỏi màn hình nâng cấp trong app?`}
              confirmLabel="Xoá"
              busy={deleteBusy}
              onConfirm={remove}
              onCancel={() => setDeleting(null)}
            />
          ) : null}
        </Fragment>
      }
    >
      {plans.map((plan, index) => {
        const missing: Array<"en" | "ms"> = [];
        if (!plan.nameEn.trim() || plan.features.some((f) => !f.en.trim())) missing.push("en");
        if (!plan.nameMs.trim() || plan.features.some((f) => !f.ms.trim())) missing.push("ms");
        return (
          <tr key={plan.id} style={{ borderTop: "1px solid var(--divider)" }}>
            <td style={{ padding: "14px 20px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <button onClick={() => move(index, -1)} disabled={index === 0 || !!rowBusy} style={arrowStyle(index === 0)}>
                  <Icon name="chevron-down" size={14} color="var(--text-secondary)" />
                </button>
                <span style={{ fontSize: 13, color: "var(--text-secondary)", minWidth: 16, textAlign: "center" }}>{index + 1}</span>
                <button onClick={() => move(index, 1)} disabled={index === plans.length - 1 || !!rowBusy} style={arrowStyle(index === plans.length - 1)}>
                  <Icon name="chevron-down" size={14} color="var(--text-secondary)" />
                </button>
              </div>
            </td>
            <td style={{ padding: "14px 20px", maxWidth: 300 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <span style={{ fontWeight: 600, color: "var(--text-primary)" }}>{plan.nameVi}</span>
                {plan.badgeVi ? <Badge color="var(--color-primary)" bg="var(--color-primary-tint-10)">{plan.badgeVi}</Badge> : null}
                <MissingTranslationNote languages={missing} />
              </div>
              <div style={{ fontSize: 12.5, color: "var(--text-muted)", marginTop: 3 }}>
                {plan.code} · {plan.billing === "lifetime" ? "trả một lần" : "tự gia hạn"}
                {plan.taglineVi ? ` · ${plan.taglineVi}` : ""}
              </div>
            </td>
            <td style={{ padding: "14px 20px", whiteSpace: "nowrap" }}>
              <div style={{ fontWeight: 600, color: "var(--text-primary)" }}>{plan.priceLabelVi || "—"}</div>
              {plan.periodLabelVi ? <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{plan.periodLabelVi}</div> : null}
            </td>
            <td style={{ padding: "14px 20px", fontSize: 13, color: "var(--text-secondary)" }}>
              {plan.features.length} mục
              <div style={{ fontSize: 11.5, color: "var(--text-muted)", marginTop: 3, whiteSpace: "nowrap" }}>
                {plan.aiChatPerDay || "∞"} AI/ngày · {plan.callMinutesPerMonth || "∞"} phút · {plan.formReviewMbPerMonth || "∞"} MB
              </div>
            </td>
            <td style={{ padding: "14px 20px" }}>
              <div style={{ display: "flex", gap: 6 }}>
                {plan.appleProductId ? (
                  <Badge color="#1E9E5E" bg="rgba(30,158,94,0.12)">iOS</Badge>
                ) : (
                  <Badge color="#8A93A3" bg="rgba(138,147,163,0.12)">iOS · chưa có</Badge>
                )}
                {plan.googleProductId ? (
                  <Badge color="#1E9E5E" bg="rgba(30,158,94,0.12)">Android</Badge>
                ) : (
                  <Badge color="#8A93A3" bg="rgba(138,147,163,0.12)">Android · chưa có</Badge>
                )}
              </div>
            </td>
            <td style={{ padding: "14px 20px" }}>
              {plan.active ? (
                <Badge color="#1E9E5E" bg="rgba(30,158,94,0.12)">Đang hiện</Badge>
              ) : (
                <Badge color="#8A93A3" bg="rgba(138,147,163,0.12)">Đã ẩn</Badge>
              )}
            </td>
            <td style={{ padding: "14px 20px" }}>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <GhostBtn onClick={() => { setDraft(plan); setLang("vi"); }}>Sửa</GhostBtn>
                <GhostBtn onClick={() => highlight(plan)} disabled={rowBusy === plan.id}>
                  {plan.highlighted ? "Bỏ nổi bật" : "Nổi bật"}
                </GhostBtn>
                <GhostBtn onClick={() => patchRow(plan, { active: !plan.active })} disabled={rowBusy === plan.id}>
                  {plan.active ? "Ẩn" : "Hiện"}
                </GhostBtn>
                <GhostBtn color="var(--error)" onClick={() => setDeleting(plan)}>Xoá</GhostBtn>
              </div>
            </td>
          </tr>
        );
      })}
      </TableShell>
      <HoldersPanel plans={plans} onChanged={reload} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Who actually holds a plan
// ---------------------------------------------------------------------------
//
// The panel above answers "is this working": totals, holders, money. It
// cannot answer the question support actually gets — "I paid and the app
// says I didn't" — because that needs one named customer's row, with the
// store's own identifier beside it to check against App Store Connect.
//
// `is_live` is computed by the RPC with the same test the app applies, not
// read off `status`: a subscription whose period ended yesterday still says
// 'active' in that column, and it is exactly that discrepancy somebody is
// here to find.

function statusOf(holder: SubscriptionHolder): { label: string; color: string; bg: string } {
  if (holder.revokedAt) return { label: "Đã hoàn tiền", color: "var(--error)", bg: "var(--error-tint)" };
  if (holder.isLive) return { label: "Đang dùng", color: "#1E9E5E", bg: "rgba(30,158,94,0.12)" };
  return { label: "Hết hạn", color: "#8A93A3", bg: "rgba(138,147,163,0.12)" };
}

const SOURCE_LABEL: Record<string, string> = { ios: "App Store", android: "Google Play", manual: "Cấp thủ công" };

function dateVn(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function HoldersPanel({ plans, onChanged }: { plans: SubscriptionPlanAdmin[]; onChanged: () => void }) {
  const [holders, setHolders] = useState<SubscriptionHolder[] | null>(null);
  const [granting, setGranting] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [revoking, setRevoking] = useState<SubscriptionHolder | null>(null);

  const load = useCallback(() => {
    fetchSubscriptionHolders()
      .then(setHolders)
      .catch(() => setHolders([]));
  }, []);
  useEffect(() => { load(); }, [load]);

  async function revoke(holder: SubscriptionHolder) {
    setBusy(holder.subscriptionId);
    try {
      await revokeSubscription(holder.subscriptionId);
      pushToast("Đã thu hồi gói");
      setRevoking(null);
      load();
      onChanged();
    } catch (e) {
      pushToast(errorMessage(e) || "Không thu hồi được");
    } finally {
      setBusy(null);
    }
  }

  return (
    <SectionCard
      title="Người đăng ký"
      action={<PrimaryBtn icon="plus" onClick={() => setGranting(true)}>Cấp gói thủ công</PrimaryBtn>}
    >
      {holders === null ? (
        <div style={{ padding: 16, color: "var(--text-secondary)", fontSize: 13 }}>Đang tải...</div>
      ) : holders.length === 0 ? (
        <div style={{ padding: 16, color: "var(--text-muted)", fontSize: 13 }}>
          Chưa có ai đăng ký gói nào.
        </div>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ textAlign: "left", color: "var(--text-muted)", fontSize: 12 }}>
                <th style={{ padding: "8px 10px", fontWeight: 600 }}>Khách hàng</th>
                <th style={{ padding: "8px 10px", fontWeight: 600 }}>Gói</th>
                <th style={{ padding: "8px 10px", fontWeight: 600 }}>Nguồn</th>
                <th style={{ padding: "8px 10px", fontWeight: 600 }}>Mua lúc</th>
                <th style={{ padding: "8px 10px", fontWeight: 600 }}>Hết hạn</th>
                <th style={{ padding: "8px 10px", fontWeight: 600 }}>Trạng thái</th>
                <th style={{ padding: "8px 10px", fontWeight: 600 }}>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {holders.map((holder) => {
                const status = statusOf(holder);
                return (
                  <tr key={holder.subscriptionId} style={{ borderTop: "1px solid var(--divider)" }}>
                    <td style={{ padding: "10px", maxWidth: 220 }}>
                      <div style={{ fontWeight: 600, color: "var(--text-primary)" }}>{holder.fullName || "Chưa đặt tên"}</div>
                      <div style={{ fontSize: 11.5, color: "var(--text-muted)", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {holder.email || holder.phone || holder.userId}
                      </div>
                    </td>
                    <td style={{ padding: "10px", whiteSpace: "nowrap" }}>
                      <div style={{ color: "var(--text-primary)" }}>{holder.planName || holder.planCode}</div>
                      <div style={{ fontSize: 11.5, color: "var(--text-muted)" }}>
                        {holder.billingType === "lifetime" ? "trọn đời" : "tự gia hạn"}
                      </div>
                    </td>
                    <td style={{ padding: "10px", whiteSpace: "nowrap" }}>
                      <div style={{ color: "var(--text-secondary)" }}>{SOURCE_LABEL[holder.platform] ?? holder.platform}</div>
                      {/* The store's own id. This is the string to paste into
                          App Store Connect when a customer and the app
                          disagree about what was bought. */}
                      {holder.storeSubscriptionId ? (
                        <div style={{ fontSize: 10.5, color: "var(--text-muted)", fontFamily: "monospace", maxWidth: 140, overflow: "hidden", textOverflow: "ellipsis" }}>
                          {holder.storeSubscriptionId}
                        </div>
                      ) : null}
                    </td>
                    <td style={{ padding: "10px", whiteSpace: "nowrap", color: "var(--text-secondary)" }}>{dateVn(holder.purchasedAt)}</td>
                    <td style={{ padding: "10px", whiteSpace: "nowrap", color: "var(--text-secondary)" }}>
                      {holder.billingType === "lifetime" && !holder.currentPeriodEnd ? "không hết hạn" : dateVn(holder.currentPeriodEnd)}
                    </td>
                    <td style={{ padding: "10px" }}>
                      <Badge color={status.color} bg={status.bg}>{status.label}</Badge>
                    </td>
                    <td style={{ padding: "10px" }}>
                      {holder.revokedAt ? (
                        <span style={{ fontSize: 12, color: "var(--text-muted)" }}>—</span>
                      ) : (
                        <GhostBtn color="var(--error)" onClick={() => setRevoking(holder)} disabled={busy === holder.subscriptionId}>
                          Thu hồi
                        </GhostBtn>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {granting ? (
        <GrantModal
          plans={plans}
          onClose={() => setGranting(false)}
          onDone={() => { setGranting(false); load(); onChanged(); }}
        />
      ) : null}

      {revoking ? (
        <ConfirmModal
          title="Thu hồi gói"
          confirmLabel={busy === revoking.subscriptionId ? "Đang thu hồi..." : "Thu hồi"}
          busy={busy === revoking.subscriptionId}
          onCancel={() => setRevoking(null)}
          onConfirm={() => revoke(revoking)}
          message={
            <div style={{ lineHeight: 1.6 }}>
              <b style={{ color: "var(--text-primary)" }}>{revoking.fullName || revoking.email || "Khách hàng"}</b> sẽ mất
              quyền lợi của {revoking.planName || revoking.planCode} ngay lập tức.
              <div style={{ marginTop: 10 }}>
                {/* Said plainly because it is the part people get wrong: this
                    touches our database only. Apple and Google learn nothing
                    from it, and a store subscription left renewing will keep
                    charging the customer. */}
                Thao tác này chỉ thu hồi quyền trong app. Nếu khách mua qua App Store hoặc Google Play,
                <b> việc hoàn tiền và huỷ gia hạn vẫn phải làm bên store</b> — nếu không, họ vẫn bị trừ tiền kỳ sau.
              </div>
            </div>
          }
        />
      ) : null}
    </SectionCard>
  );
}

function GrantModal({ plans, onClose, onDone }: { plans: SubscriptionPlanAdmin[]; onClose: () => void; onDone: () => void }) {
  const [term, setTerm] = useState("");
  const [results, setResults] = useState<Array<{ id: string; name: string | null; email: string | null; phone: string | null }>>([]);
  const [picked, setPicked] = useState<{ id: string; name: string | null; email: string | null } | null>(null);
  const [planCode, setPlanCode] = useState(plans[0]?.code ?? "");
  const [months, setMonths] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  // Debounced so typing a name does not fire a query per keystroke.
  useEffect(() => {
    if (picked) return;
    const handle = setTimeout(() => {
      searchCustomers(term).then(setResults).catch(() => setResults([]));
    }, 250);
    return () => clearTimeout(handle);
  }, [term, picked]);

  const plan = plans.find((p) => p.code === planCode);

  async function submit() {
    if (!picked || !planCode) return;
    setBusy(true);
    try {
      await grantSubscription(picked.id, planCode, months ? Number(months) : null, note);
      pushToast("Đã cấp gói");
      onDone();
    } catch (e) {
      pushToast(errorMessage(e) || "Không cấp được gói");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      title="Cấp gói thủ công"
      onClose={onClose}
      width={520}
      footer={
        <Fragment>
          <GhostBtn onClick={onClose}>Huỷ</GhostBtn>
          <PrimaryBtn onClick={submit} disabled={!picked || !planCode || busy}>
            {busy ? "Đang cấp..." : "Cấp gói"}
          </PrimaryBtn>
        </Fragment>
      }
    >
      <div style={{ display: "grid", gap: 14 }}>
        <div style={{ fontSize: 12.5, color: "var(--text-muted)", lineHeight: 1.6 }}>
          Dùng khi khách trả tiền ngoài store, hoặc đã trả trong store mà hoá đơn không về.
          Gói cấp tay <b>không</b> được tính vào doanh thu — nó không phải tiền store thu.
        </div>

        <div>
          <FieldLabel>Khách hàng</FieldLabel>
          {picked ? (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "10px 12px", border: "1px solid var(--border-input)", borderRadius: 10 }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 600, color: "var(--text-primary)" }}>{picked.name || "Chưa đặt tên"}</div>
                <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{picked.email}</div>
              </div>
              <GhostBtn onClick={() => { setPicked(null); setTerm(""); }}>Đổi</GhostBtn>
            </div>
          ) : (
            <Fragment>
              <input
                value={term}
                onChange={(e) => setTerm(e.target.value)}
                placeholder="Tên, email hoặc số điện thoại"
                style={{ width: "100%", padding: "10px 12px", border: "1px solid var(--border-input)", borderRadius: 10, fontFamily: "var(--font-family)", fontSize: 13.5 }}
              />
              {results.length > 0 && (
                <div style={{ marginTop: 6, border: "1px solid var(--divider)", borderRadius: 10, overflow: "hidden" }}>
                  {results.map((row) => (
                    <button
                      key={row.id}
                      onClick={() => setPicked(row)}
                      style={{ display: "block", width: "100%", textAlign: "left", padding: "9px 12px", border: "none", borderBottom: "1px solid var(--divider)", background: "#fff", cursor: "pointer", fontFamily: "var(--font-family)" }}
                    >
                      <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>{row.name || "Chưa đặt tên"}</div>
                      <div style={{ fontSize: 11.5, color: "var(--text-muted)" }}>{row.email || row.phone}</div>
                    </button>
                  ))}
                </div>
              )}
            </Fragment>
          )}
        </div>

        <div>
          <FieldLabel>Gói</FieldLabel>
          <select
            value={planCode}
            onChange={(e) => setPlanCode(e.target.value)}
            style={{ width: "100%", padding: "10px 12px", border: "1px solid var(--border-input)", borderRadius: 10, fontFamily: "var(--font-family)", fontSize: 13.5, background: "#fff" }}
          >
            {plans.map((p) => (
              <option key={p.code} value={p.code}>{p.nameVi || p.code}</option>
            ))}
          </select>
        </div>

        {plan?.billing === "lifetime" ? (
          <div style={{ fontSize: 12.5, color: "var(--text-muted)" }}>Gói trọn đời không có hạn, nên không cần nhập số tháng.</div>
        ) : (
          <div>
            <FieldLabel>Số tháng</FieldLabel>
            <input
              value={months}
              onChange={(e) => setMonths(e.target.value.replace(/[^0-9]/g, ""))}
              placeholder="1"
              style={{ width: "100%", padding: "10px 12px", border: "1px solid var(--border-input)", borderRadius: 10, fontFamily: "var(--font-family)", fontSize: 13.5 }}
            />
            <div style={{ fontSize: 11.5, color: "var(--text-muted)", marginTop: 4 }}>
              Để trống thì dùng đúng kỳ của gói đã cấu hình.
            </div>
          </div>
        )}

        <div>
          <FieldLabel>Ghi chú</FieldLabel>
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Vì sao cấp — hiện trong cột nguồn"
            style={{ width: "100%", padding: "10px 12px", border: "1px solid var(--border-input)", borderRadius: 10, fontFamily: "var(--font-family)", fontSize: 13.5 }}
          />
        </div>
      </div>
    </Modal>
  );
}

const vnd = (amount: number) => amount.toLocaleString("vi-VN") + "đ";
const mb = (bytes: number) => (bytes / 1048576).toFixed(0) + " MB";

/** A used-of-limit bar. `warnAt` is the fraction where it turns amber — the
 * point of this panel is to see a ceiling coming, not to discover it. */
function Meter({ label, used, limit, note, warnAt = 0.7 }: { label: string; used: number; limit: number; note: string; warnAt?: number }) {
  const fraction = limit > 0 ? Math.min(1, used / limit) : 0;
  const colour = fraction >= 0.9 ? "var(--error)" : fraction >= warnAt ? "#B8740E" : "var(--color-primary)";
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, marginBottom: 6 }}>
        <span style={{ color: "var(--text-secondary)", fontWeight: 600 }}>{label}</span>
        <span style={{ color: colour, fontWeight: 700 }}>{Math.round(fraction * 100)}%</span>
      </div>
      <div style={{ height: 7, borderRadius: 999, background: "var(--bg-card-alt)", overflow: "hidden" }}>
        <div style={{ width: `${fraction * 100}%`, height: "100%", background: colour, borderRadius: 999 }} />
      </div>
      <div style={{ fontSize: 11.5, color: "var(--text-muted)", marginTop: 5 }}>{note}</div>
    </div>
  );
}

function Stat({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div>
      <div style={{ fontSize: 12.5, color: "var(--text-secondary)", fontWeight: 600 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 700, color: "var(--text-primary)", marginTop: 2 }}>{value}</div>
      {note ? <div style={{ fontSize: 11.5, color: "var(--text-muted)", marginTop: 2 }}>{note}</div> : null}
    </div>
  );
}

function OpsPanel({ ops }: { ops: SubscriptionOps }) {
  const { revenue, infra, plans } = ops;
  const holders = plans.reduce((total, plan) => total + plan.holdersLive, 0);
  // LiveKit meters PARTICIPANT minutes and a 1-1 call has two of them, so the
  // quota drains twice as fast as the call clock reads. Showing call minutes
  // against the 5,000 would understate it by half.
  const participantMinutes = infra.callMinutesThisMonth * 2;

  return (
    <div style={{ display: "grid", gap: 18, marginBottom: 22 }}>
      <SectionCard title="Tiền đã thu">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 20 }}>
          <Stat label="Đang có gói" value={String(holders)} note={`${revenue.newThisMonth} người mua trong tháng này`} />
          <Stat label="Tổng đã thu" value={vnd(revenue.grossVnd)} note="giá niêm yết × số kỳ đã trả" />
          <Stat label="Sau phí store" value={vnd(revenue.netVndEstimate)} note="trừ ước tính 15%" />
          <Stat label="Hoàn tiền / hết hạn" value={`${revenue.refunded} / ${revenue.lapsed}`} note="đã hoàn tiền / đã hết hạn" />
        </div>
        {holders === 0 ? (
          <div style={{ fontSize: 12.5, color: "var(--text-muted)", marginTop: 16, paddingTop: 14, borderTop: "1px solid var(--divider)" }}>
            Chưa có ai mua gói. Các số sẽ chạy ngay khi có giao dịch đầu tiên được máy chủ xác minh.
          </div>
        ) : (
          <div style={{ marginTop: 16, paddingTop: 14, borderTop: "1px solid var(--divider)", display: "grid", gap: 8 }}>
            {plans.filter((plan) => plan.holdersEver > 0).map((plan) => (
              <div key={plan.code} style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                <span style={{ color: "var(--text-primary)", fontWeight: 600 }}>{plan.name}</span>
                <span style={{ color: "var(--text-secondary)" }}>
                  {plan.holdersLive} đang dùng · {plan.holdersEver} từng mua · {plan.periodsPaid} kỳ · {vnd(plan.grossVnd)}
                </span>
              </div>
            ))}
          </div>
        )}
        <div style={{ fontSize: 11.5, color: "var(--text-muted)", marginTop: 14, lineHeight: 1.6 }}>
          <strong>Đây là số để đối soát, không phải số kế toán.</strong> Nó đếm số kỳ đã trả nhân giá niêm yết đặt trong tab
          này. Tiền thật nằm ở báo cáo thanh toán của App Store Connect và Play Console — đã trừ phí store, thuế và quy đổi
          tiền cho người mua ngoài Việt Nam. Dùng bảng này để so với báo cáo đó và phát hiện khi hai bên lệch nhau.
        </div>
      </SectionCard>

      <SectionCard title="Hạ tầng — còn bao nhiêu trước khi phải nâng cấp">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 24 }}>
          <Meter
            label="Dung lượng file (Supabase free)"
            used={infra.storageBytes}
            limit={infra.storageLimitBytes}
            note={`${mb(infra.storageBytes)} / ${mb(infra.storageLimitBytes)} · video chấm bài đang giữ: ${mb(infra.clipBytesLive)}`}
          />
          <Meter
            label="Phút gọi (LiveKit free)"
            used={participantMinutes}
            limit={infra.participantMinutesLimit}
            note={`${infra.callMinutesThisMonth} phút gọi tháng này = ${participantMinutes} participant-minute / ${infra.participantMinutesLimit}`}
          />
          <Stat
            label="Chat AI tháng này"
            value={String(infra.aiMessagesThisMonth)}
            note="tin nhắn người dùng gửi · Groq, chưa có ngưỡng cứng"
          />
        </div>
        <div style={{ fontSize: 11.5, color: "var(--text-muted)", marginTop: 16, lineHeight: 1.6 }}>
          Dung lượng là <strong>hard cap</strong>: vượt 1 GB thì Supabase ngắt dịch vụ chứ không tính thêm tiền — nên nâng lên
          Pro ($25/tháng, 100 GB) <em>trước</em> khi đầy. Video chấm bài tự xoá 14 ngày sau khi chấm xong, nên con số đang giữ
          chỉ bằng khoảng nửa tháng upload ({infra.clipsPending} clip đang chờ chấm, {infra.clipsPruned} clip đã xoá). Hết phút
          LiveKit thì cuộc gọi mới không kết nối được — lên plan Ship khi thanh này chạm 70%.
        </div>
      </SectionCard>
    </div>
  );
}

function arrowStyle(disabled: boolean): React.CSSProperties {
  return {
    border: "1px solid var(--border-input)",
    background: "#fff",
    borderRadius: 6,
    padding: "2px 4px",
    cursor: disabled ? "default" : "pointer",
    opacity: disabled ? 0.35 : 1,
    display: "flex",
    alignItems: "center",
  };
}
