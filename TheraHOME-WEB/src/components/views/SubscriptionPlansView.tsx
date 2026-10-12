"use client";

// Real data: subscription_plans — the tier cards on the mobile app's paywall.
//
// Copy only. Saving here changes what the paywall SAYS; it grants nothing.
// The quotas written into the feature lines are enforced elsewhere, by
// server-side functions of their own (chấm dáng tập by
// `form_review_monthly_allowance()`), so raising "4 lượt" to "8 lượt" in this
// editor without changing that function makes the app promise more than it
// delivers. The warning under the table says so to whoever is editing.
import { Fragment, useState, useEffect } from "react";
import { TableShell } from "@/components/ui/TableShell";
import { Modal } from "@/components/ui/Modal";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { PrimaryBtn, GhostBtn, Badge, FieldLabel, inputStyle, PillTabs, MissingTranslationNote } from "@/components/ui/primitives";
import { Icon } from "@/components/ui/Icon";
import { pushToast } from "@/components/ui/Toast";
import {
  fetchSubscriptionPlans,
  saveSubscriptionPlan,
  deleteSubscriptionPlan,
  reorderSubscriptionPlans,
  type SubscriptionPlanAdmin,
  type PlanFeature,
  type PlanBilling,
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

  function reload() {
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
            <td style={{ padding: "14px 20px", fontSize: 13, color: "var(--text-secondary)" }}>{plan.features.length} mục</td>
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
