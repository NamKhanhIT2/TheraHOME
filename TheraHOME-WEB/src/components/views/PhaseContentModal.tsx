"use client";

// Per-phase quiz question bank + post-quiz promo content (cross-sell card +
// Apple IAP unlock card) — see RoutineView.tsx (opens this) and
// TheraHOME-APP/CLAUDE.md's "Quiz + phase unlock" entry for the full
// mobile-side picture.
import { Fragment, useEffect, useState } from "react";
import type { ProgramPhase } from "@/lib/mockData";
import {
  fetchQuizQuestions,
  saveQuizQuestion,
  deleteQuizQuestion,
  fetchPhasePromo,
  savePhasePromo,
  uploadPhasePromoImage,
  type QuizQuestionAdmin,
  type QuizLanguageContent,
  type PhasePromoAdmin,
  type PhasePromoTranslation,
} from "@/lib/db";
import { GhostBtn, PrimaryBtn, FieldLabel, inputStyle, PillTabs } from "@/components/ui/primitives";
import { Modal } from "@/components/ui/Modal";
import { Icon } from "@/components/ui/Icon";
import { pushToast } from "@/components/ui/Toast";

type ContentTab = "quiz" | "promo";
type QuizLangKey = "vi" | "en" | "ms";
const QUIZ_LANG_TABS: Array<[QuizLangKey, string]> = [["vi", "VN"], ["en", "EN"], ["ms", "MS"]];
const EMPTY_QUIZ_LANGUAGE: QuizLanguageContent = { question: "", options: ["", "", "", ""], correctIndex: 0 };

function emptyDraft(sortOrder: number): QuizQuestionAdmin {
  return { id: "", sortOrder, vi: { ...EMPTY_QUIZ_LANGUAGE, options: [...EMPTY_QUIZ_LANGUAGE.options] }, en: { ...EMPTY_QUIZ_LANGUAGE, options: [...EMPTY_QUIZ_LANGUAGE.options] }, ms: { ...EMPTY_QUIZ_LANGUAGE, options: [...EMPTY_QUIZ_LANGUAGE.options] } };
}

function QuestionEditor({ draft, onChange, onCancel, onSave, saving }: { draft: QuizQuestionAdmin; onChange: (d: QuizQuestionAdmin) => void; onCancel: () => void; onSave: () => void; saving: boolean }) {
  const [lang, setLang] = useState<QuizLangKey>("vi");
  const content = draft[lang];

  function updateContent(patch: Partial<QuizLanguageContent>) {
    onChange({ ...draft, [lang]: { ...content, ...patch } });
  }
  function updateOption(index: number, value: string) {
    const options = content.options.slice();
    options[index] = value;
    updateContent({ options });
  }
  function addOption() {
    if (content.options.length >= 6) return;
    updateContent({ options: [...content.options, ""] });
  }
  function removeOption(index: number) {
    if (content.options.length <= 2) return;
    const options = content.options.filter((_, i) => i !== index);
    const correctIndex = content.correctIndex >= options.length ? 0 : content.correctIndex;
    updateContent({ options, correctIndex });
  }

  return (
    <div style={{ background: "var(--bg-card-alt)", borderRadius: 12, padding: 16, marginBottom: 12 }}>
      <PillTabs options={QUIZ_LANG_TABS} value={lang} onChange={setLang} />
      <div style={{ marginTop: 10 }}>
        <FieldLabel>Câu hỏi</FieldLabel>
        <input value={content.question} onChange={(e) => updateContent({ question: e.target.value })} style={{ ...inputStyle, marginBottom: 12 }} placeholder="Nhập nội dung câu hỏi..." />
        <FieldLabel>Các lựa chọn trả lời (khảo sát/đánh giá — không có đáp án đúng/sai)</FieldLabel>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 8 }}>
          {content.options.map((opt, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <input value={opt} onChange={(e) => updateOption(i, e.target.value)} style={{ ...inputStyle, flex: 1 }} placeholder={`Lựa chọn ${i + 1}`} />
              {content.options.length > 2 ? (
                <button onClick={() => removeOption(i)} style={{ border: "none", background: "none", cursor: "pointer", display: "flex" }}>
                  <Icon name="x" size={15} color="var(--error)" />
                </button>
              ) : null}
            </div>
          ))}
        </div>
        {content.options.length < 6 ? (
          <GhostBtn onClick={addOption}>+ Thêm lựa chọn</GhostBtn>
        ) : null}
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: 14, justifyContent: "flex-end" }}>
        <GhostBtn onClick={onCancel}>Hủy</GhostBtn>
        <PrimaryBtn onClick={onSave} disabled={saving}>{saving ? "Đang lưu..." : "Lưu câu hỏi"}</PrimaryBtn>
      </div>
    </div>
  );
}

function QuizTab({ phaseId }: { phaseId: string }) {
  const [questions, setQuestions] = useState<QuizQuestionAdmin[] | null>(null);
  const [draft, setDraft] = useState<QuizQuestionAdmin | null>(null);
  const [saving, setSaving] = useState(false);

  function reload() {
    fetchQuizQuestions(phaseId).then(setQuestions).catch(() => pushToast("Không thể tải câu hỏi quiz"));
  }
  useEffect(reload, [phaseId]);

  async function handleSave() {
    if (!draft) return;
    const vi = draft.vi;
    if (!vi.question.trim() || vi.options.some((o) => !o.trim())) {
      pushToast("Vui lòng điền đầy đủ câu hỏi và các lựa chọn (ít nhất tiếng Việt)");
      return;
    }
    setSaving(true);
    try {
      await saveQuizQuestion(phaseId, { id: draft.id || null, sortOrder: draft.sortOrder, vi: draft.vi, en: draft.en, ms: draft.ms });
      setDraft(null);
      pushToast("Đã lưu câu hỏi");
      reload();
    } catch {
      pushToast("Không thể lưu câu hỏi");
    } finally {
      setSaving(false);
    }
  }
  async function handleDelete(id: string) {
    try {
      await deleteQuizQuestion(id);
      reload();
    } catch {
      pushToast("Không thể xoá câu hỏi");
    }
  }

  if (questions === null) return <div style={{ color: "var(--text-secondary)", padding: 10 }}>Đang tải...</div>;

  return (
    <div>
      {questions.map((q, i) => (
        <Fragment key={q.id}>
          {draft?.id === q.id ? (
            <QuestionEditor draft={draft} onChange={setDraft} onCancel={() => setDraft(null)} onSave={handleSave} saving={saving} />
          ) : (
            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 10, background: "#fff", boxShadow: "var(--shadow-card)", marginBottom: 8 }}>
              <div style={{ flex: 1, fontSize: 13.5, color: "var(--text-primary)" }}>
                <strong>Câu {i + 1}.</strong> {q.vi.question || <span style={{ color: "var(--text-muted)" }}>(chưa có nội dung)</span>}
              </div>
              <button onClick={() => setDraft(q)} style={{ border: "none", background: "none", cursor: "pointer", display: "flex" }}>
                <Icon name="pencil" size={15} color="var(--color-primary)" />
              </button>
              <button onClick={() => handleDelete(q.id)} style={{ border: "none", background: "none", cursor: "pointer", display: "flex" }}>
                <Icon name="trash-2" size={15} color="var(--error)" />
              </button>
            </div>
          )}
        </Fragment>
      ))}
      {draft && !draft.id ? (
        <QuestionEditor draft={draft} onChange={setDraft} onCancel={() => setDraft(null)} onSave={handleSave} saving={saving} />
      ) : (
        <GhostBtn onClick={() => setDraft(emptyDraft(questions.length))}>+ Thêm câu hỏi</GhostBtn>
      )}
    </div>
  );
}

type PromoLangTab = "vi" | "en" | "ms";
const PROMO_LANG_TABS: Array<[PromoLangTab, string]> = [["vi", "VN"], ["en", "EN"], ["ms", "MS"]];
/** Fields editable per language (text/urls). Images + Apple/Google Product
 * IDs are shared across languages and only shown on the VN tab. */
type PromoTextKey = keyof PhasePromoTranslation;

function PromoTab({ phaseId }: { phaseId: string }) {
  const [promo, setPromo] = useState<PhasePromoAdmin | null>(null);
  const [langTab, setLangTab] = useState<PromoLangTab>("vi");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState<"cross-sell" | "unlock" | null>(null);

  useEffect(() => {
    fetchPhasePromo(phaseId).then(setPromo).catch(() => pushToast("Không thể tải nội dung upsell"));
  }, [phaseId]);

  function set<K extends keyof PhasePromoAdmin>(key: K, value: PhasePromoAdmin[K]) {
    setPromo((p) => (p ? { ...p, [key]: value } : p));
  }

  // Per-language accessors: the VN tab edits the base fields; EN/MS edit
  // the translations overrides (empty override = mobile falls back to VN).
  function getText(key: PromoTextKey): string {
    if (!promo) return "";
    return langTab === "vi" ? promo[key] : promo.translations[langTab][key];
  }
  function setText(key: PromoTextKey, value: string) {
    setPromo((p) => {
      if (!p) return p;
      if (langTab === "vi") return { ...p, [key]: value };
      return { ...p, translations: { ...p.translations, [langTab]: { ...p.translations[langTab], [key]: value } } };
    });
  }
  function hint(key: PromoTextKey, viPlaceholder?: string): string | undefined {
    if (!promo) return viPlaceholder;
    if (langTab === "vi") return viPlaceholder;
    const viValue = promo[key].trim();
    return viValue ? `VN: ${viValue.split("\n")[0]}` : "Để trống = dùng bản VN";
  }

  async function handleUpload(kind: "cross-sell" | "unlock", file: File | undefined) {
    if (!file) return;
    setUploading(kind);
    try {
      const url = await uploadPhasePromoImage(phaseId, kind, file);
      set(kind === "cross-sell" ? "crossSellImageUrl" : "unlockImageUrl", url);
    } catch {
      pushToast("Không thể tải ảnh lên");
    } finally {
      setUploading(null);
    }
  }

  async function handleSave() {
    if (!promo) return;
    setSaving(true);
    try {
      await savePhasePromo(phaseId, promo);
      pushToast("Đã lưu nội dung upsell");
    } catch {
      pushToast("Không thể lưu nội dung upsell");
    } finally {
      setSaving(false);
    }
  }

  if (!promo) return <div style={{ color: "var(--text-secondary)", padding: 10 }}>Đang tải...</div>;

  const isVi = langTab === "vi";

  return (
    <div>
      <PillTabs options={PROMO_LANG_TABS} value={langTab} onChange={setLangTab} />
      {!isVi ? (
        <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 12, marginTop: -6 }}>
          Bản dịch cho người dùng {langTab === "en" ? "tiếng Anh (thị trường UK)" : "tiếng Malay (thị trường ML)"}. Trường nào để trống, app sẽ dùng bản VN. Ảnh và Apple/Google Product ID dùng chung — chỉnh ở tab VN.
        </div>
      ) : null}
      <div style={{ background: "#fff", borderRadius: 12, padding: 14, boxShadow: "var(--shadow-card)", marginBottom: 14 }}>
        <div style={{ fontWeight: 700, fontSize: 13.5, color: "var(--text-primary)", marginBottom: 10 }}>Thẻ giới thiệu sản phẩm khác (không cần IAP)</div>
        {isVi ? (
          <Fragment>
            <FieldLabel>Ảnh (dùng chung 3 ngôn ngữ)</FieldLabel>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
              {promo.crossSellImageUrl ? <img src={promo.crossSellImageUrl} alt="" style={{ width: 64, height: 64, borderRadius: 8, objectFit: "cover" }} /> : null}
              <input type="file" accept="image/*" onChange={(e) => handleUpload("cross-sell", e.target.files?.[0])} disabled={uploading === "cross-sell"} />
            </div>
          </Fragment>
        ) : null}
        <FieldLabel>Nhãn (badge) — ví dụ &quot;PRO&quot;</FieldLabel>
        <input value={getText("crossSellBadge")} onChange={(e) => setText("crossSellBadge", e.target.value)} style={{ ...inputStyle, marginBottom: 12 }} placeholder={hint("crossSellBadge")} />
        <FieldLabel>Tiêu đề</FieldLabel>
        <input value={getText("crossSellTitle")} onChange={(e) => setText("crossSellTitle", e.target.value)} style={{ ...inputStyle, marginBottom: 12 }} placeholder={hint("crossSellTitle", "Ví dụ: TheraNECK PRO")} />
        <FieldLabel>Mô tả</FieldLabel>
        <textarea value={getText("crossSellDescription")} onChange={(e) => setText("crossSellDescription", e.target.value)} style={{ ...inputStyle, marginBottom: 12, minHeight: 64 }} placeholder={hint("crossSellDescription")} />
        <FieldLabel>Link &quot;Tìm hiểu thêm&quot;</FieldLabel>
        <input value={getText("crossSellCtaUrl")} onChange={(e) => setText("crossSellCtaUrl", e.target.value)} style={{ ...inputStyle, marginBottom: 12 }} placeholder={hint("crossSellCtaUrl", "https://...")} />
        <FieldLabel>Link video giới thiệu</FieldLabel>
        <input value={getText("crossSellVideoUrl")} onChange={(e) => setText("crossSellVideoUrl", e.target.value)} style={inputStyle} placeholder={hint("crossSellVideoUrl", "https://...")} />
      </div>

      <div style={{ background: "#fff", borderRadius: 12, padding: 14, boxShadow: "var(--shadow-card)", marginBottom: 14 }}>
        <div style={{ fontWeight: 700, fontSize: 13.5, color: "var(--text-primary)", marginBottom: 4 }}>Thẻ mở khoá giai đoạn (hiện trên tab Lộ trình)</div>
        {isVi ? (
          <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 10 }}>
            Thẻ &quot;Mở khoá {"{tên giai đoạn}"}&quot; hiện ở cuối giai đoạn trước, dẫn vào màn paywall bên dưới.
            Chỉ hiển thị khi đã điền Product ID của nền tảng tương ứng (Apple cho iOS, Google cho Android — ở phần paywall) và người dùng chưa mua.
          </div>
        ) : null}
        {isVi ? (
          <Fragment>
            <FieldLabel>Ảnh (dùng chung với hero màn paywall, chung 3 ngôn ngữ)</FieldLabel>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
              {promo.unlockImageUrl ? <img src={promo.unlockImageUrl} alt="" style={{ width: 64, height: 64, borderRadius: 8, objectFit: "cover" }} /> : null}
              <input type="file" accept="image/*" onChange={(e) => handleUpload("unlock", e.target.files?.[0])} disabled={uploading === "unlock"} />
            </div>
          </Fragment>
        ) : null}
        <FieldLabel>Mô tả trên thẻ</FieldLabel>
        <textarea value={getText("unlockDescription")} onChange={(e) => setText("unlockDescription", e.target.value)} style={{ ...inputStyle, marginBottom: 12, minHeight: 64 }} placeholder={hint("unlockDescription")} />
        <FieldLabel>Link video giới thiệu</FieldLabel>
        <input value={getText("unlockVideoUrl")} onChange={(e) => setText("unlockVideoUrl", e.target.value)} style={inputStyle} placeholder={hint("unlockVideoUrl", "https://...")} />
      </div>

      <div style={{ background: "#fff", borderRadius: 12, padding: 14, boxShadow: "var(--shadow-card)", marginBottom: 14 }}>
        <div style={{ fontWeight: 700, fontSize: 13.5, color: "var(--text-primary)", marginBottom: 4 }}>Màn paywall mở khoá giai đoạn</div>
        {isVi ? (
          <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 10 }}>
            Bắt buộc qua Apple In-App Purchase — bỏ trống &quot;Apple Product ID&quot; nếu giai đoạn này không cần mua để mở khoá.
            Các trường nội dung để trống sẽ dùng nội dung mặc định trong app.
          </div>
        ) : null}
        <FieldLabel>Nhãn (badge) — ví dụ &quot;Nội dung cao cấp&quot;</FieldLabel>
        <input value={getText("unlockBadge")} onChange={(e) => setText("unlockBadge", e.target.value)} style={{ ...inputStyle, marginBottom: 12 }} placeholder={hint("unlockBadge", "Nội dung cao cấp")} />
        <FieldLabel>Tiêu đề</FieldLabel>
        <input value={getText("unlockTitle")} onChange={(e) => setText("unlockTitle", e.target.value)} style={{ ...inputStyle, marginBottom: 12 }} placeholder={hint("unlockTitle", "Ví dụ: Mở khoá giai đoạn 3 · TheraNECK+")} />
        <FieldLabel>Phụ đề (dòng mô tả ngắn dưới tiêu đề)</FieldLabel>
        <input value={getText("unlockSubtitle")} onChange={(e) => setText("unlockSubtitle", e.target.value)} style={{ ...inputStyle, marginBottom: 12 }} placeholder={hint("unlockSubtitle", "Ví dụ: Chương trình phục hồi vùng cổ · vai · gáy")} />
        <FieldLabel>Quyền lợi (mỗi dòng một mục)</FieldLabel>
        <textarea value={getText("unlockBenefits")} onChange={(e) => setText("unlockBenefits", e.target.value)} style={{ ...inputStyle, marginBottom: 12, minHeight: 84 }} placeholder={hint("unlockBenefits", "Lộ trình 14 ngày cá nhân hoá theo mức độ đau\nVideo hướng dẫn bởi chuyên gia TheraHOME")} />
        <FieldLabel>Tên gói</FieldLabel>
        <input value={getText("unlockPackageName")} onChange={(e) => setText("unlockPackageName", e.target.value)} style={{ ...inputStyle, marginBottom: 12 }} placeholder={hint("unlockPackageName", "Gói Pro")} />
        <FieldLabel>Mô tả gói</FieldLabel>
        <input value={getText("unlockPackageDesc")} onChange={(e) => setText("unlockPackageDesc", e.target.value)} style={{ ...inputStyle, marginBottom: 12 }} placeholder={hint("unlockPackageDesc", "Truy cập toàn bộ tính năng Pro")} />
        <FieldLabel>Giá hiển thị dự phòng (khi app chưa lấy được giá từ App Store)</FieldLabel>
        <input value={getText("unlockPriceLabel")} onChange={(e) => setText("unlockPriceLabel", e.target.value)} style={{ ...inputStyle, marginBottom: 12 }} placeholder={hint("unlockPriceLabel", "299.000đ")} />
        {isVi ? (
          <Fragment>
            <FieldLabel>Apple Product ID (đã tạo trên App Store Connect, dùng chung 3 ngôn ngữ)</FieldLabel>
            <input value={promo.appleProductId} onChange={(e) => set("appleProductId", e.target.value)} style={{ ...inputStyle, marginBottom: 12 }} placeholder="com.therahome.phase3_unlock" />
            <FieldLabel>Google Product ID (đã tạo trên Google Play Console, dùng chung 3 ngôn ngữ)</FieldLabel>
            <input value={promo.googleProductId} onChange={(e) => set("googleProductId", e.target.value)} style={inputStyle} placeholder="phase3_unlock" />
          </Fragment>
        ) : null}
      </div>

      <PrimaryBtn onClick={handleSave} disabled={saving}>{saving ? "Đang lưu..." : "Lưu nội dung upsell"}</PrimaryBtn>
    </div>
  );
}

export function PhaseContentModal({ phase, onClose }: { phase: ProgramPhase; onClose: () => void }) {
  const [tab, setTab] = useState<ContentTab>("quiz");

  return (
    <Modal title={"Khảo sát & Upsell · " + phase.name} onClose={onClose} width={520} footer={<GhostBtn onClick={onClose}>Đóng</GhostBtn>}>
      <div style={{ marginBottom: 14 }}>
        <PillTabs
          options={[
            ["quiz", "Câu hỏi khảo sát"],
            ["promo", "Nội dung Upsell"],
          ]}
          value={tab}
          onChange={setTab}
        />
      </div>
      {tab === "quiz" ? <QuizTab phaseId={phase.id} /> : <PromoTab phaseId={phase.id} />}
    </Modal>
  );
}
