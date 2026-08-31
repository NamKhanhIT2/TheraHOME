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
        <FieldLabel>Đáp án (chọn nút tròn để đánh dấu đáp án đúng)</FieldLabel>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 8 }}>
          {content.options.map((opt, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <input
                type="radio"
                checked={content.correctIndex === i}
                onChange={() => updateContent({ correctIndex: i })}
                title="Đáp án đúng"
              />
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

function PromoTab({ phaseId }: { phaseId: string }) {
  const [promo, setPromo] = useState<PhasePromoAdmin | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState<"cross-sell" | "unlock" | null>(null);

  useEffect(() => {
    fetchPhasePromo(phaseId).then(setPromo).catch(() => pushToast("Không thể tải nội dung upsell"));
  }, [phaseId]);

  function set<K extends keyof PhasePromoAdmin>(key: K, value: PhasePromoAdmin[K]) {
    setPromo((p) => (p ? { ...p, [key]: value } : p));
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

  return (
    <div>
      <div style={{ background: "#fff", borderRadius: 12, padding: 14, boxShadow: "var(--shadow-card)", marginBottom: 14 }}>
        <div style={{ fontWeight: 700, fontSize: 13.5, color: "var(--text-primary)", marginBottom: 10 }}>Thẻ giới thiệu sản phẩm khác (không cần IAP)</div>
        <FieldLabel>Ảnh</FieldLabel>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
          {promo.crossSellImageUrl ? <img src={promo.crossSellImageUrl} alt="" style={{ width: 64, height: 64, borderRadius: 8, objectFit: "cover" }} /> : null}
          <input type="file" accept="image/*" onChange={(e) => handleUpload("cross-sell", e.target.files?.[0])} disabled={uploading === "cross-sell"} />
        </div>
        <FieldLabel>Nhãn (badge) — ví dụ &quot;PRO&quot;</FieldLabel>
        <input value={promo.crossSellBadge} onChange={(e) => set("crossSellBadge", e.target.value)} style={{ ...inputStyle, marginBottom: 12 }} />
        <FieldLabel>Tiêu đề</FieldLabel>
        <input value={promo.crossSellTitle} onChange={(e) => set("crossSellTitle", e.target.value)} style={{ ...inputStyle, marginBottom: 12 }} placeholder="Ví dụ: TheraNECK PRO" />
        <FieldLabel>Mô tả</FieldLabel>
        <textarea value={promo.crossSellDescription} onChange={(e) => set("crossSellDescription", e.target.value)} style={{ ...inputStyle, marginBottom: 12, minHeight: 64 }} />
        <FieldLabel>Link &quot;Tìm hiểu thêm&quot;</FieldLabel>
        <input value={promo.crossSellCtaUrl} onChange={(e) => set("crossSellCtaUrl", e.target.value)} style={{ ...inputStyle, marginBottom: 12 }} placeholder="https://..." />
        <FieldLabel>Link video giới thiệu</FieldLabel>
        <input value={promo.crossSellVideoUrl} onChange={(e) => set("crossSellVideoUrl", e.target.value)} style={inputStyle} placeholder="https://..." />
      </div>

      <div style={{ background: "#fff", borderRadius: 12, padding: 14, boxShadow: "var(--shadow-card)", marginBottom: 14 }}>
        <div style={{ fontWeight: 700, fontSize: 13.5, color: "var(--text-primary)", marginBottom: 4 }}>Màn paywall mở khoá giai đoạn</div>
        <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 10 }}>
          Bắt buộc qua Apple In-App Purchase — bỏ trống &quot;Apple Product ID&quot; nếu giai đoạn này không cần mua để mở khoá.
          Các trường nội dung để trống sẽ dùng nội dung mặc định trong app.
        </div>
        <FieldLabel>Ảnh (hero đầu màn paywall)</FieldLabel>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
          {promo.unlockImageUrl ? <img src={promo.unlockImageUrl} alt="" style={{ width: 64, height: 64, borderRadius: 8, objectFit: "cover" }} /> : null}
          <input type="file" accept="image/*" onChange={(e) => handleUpload("unlock", e.target.files?.[0])} disabled={uploading === "unlock"} />
        </div>
        <FieldLabel>Nhãn (badge) — ví dụ &quot;Nội dung cao cấp&quot;</FieldLabel>
        <input value={promo.unlockBadge} onChange={(e) => set("unlockBadge", e.target.value)} style={{ ...inputStyle, marginBottom: 12 }} placeholder="Nội dung cao cấp" />
        <FieldLabel>Tiêu đề</FieldLabel>
        <input value={promo.unlockTitle} onChange={(e) => set("unlockTitle", e.target.value)} style={{ ...inputStyle, marginBottom: 12 }} placeholder="Ví dụ: Mở khoá giai đoạn 3 · TheraNECK+" />
        <FieldLabel>Phụ đề (dòng mô tả ngắn dưới tiêu đề)</FieldLabel>
        <input value={promo.unlockSubtitle} onChange={(e) => set("unlockSubtitle", e.target.value)} style={{ ...inputStyle, marginBottom: 12 }} placeholder="Ví dụ: Chương trình phục hồi vùng cổ · vai · gáy" />
        <FieldLabel>Quyền lợi (mỗi dòng một mục)</FieldLabel>
        <textarea value={promo.unlockBenefits} onChange={(e) => set("unlockBenefits", e.target.value)} style={{ ...inputStyle, marginBottom: 12, minHeight: 84 }} placeholder={"Lộ trình 14 ngày cá nhân hoá theo mức độ đau\nVideo hướng dẫn bởi chuyên gia TheraHOME"} />
        <FieldLabel>Tên gói</FieldLabel>
        <input value={promo.unlockPackageName} onChange={(e) => set("unlockPackageName", e.target.value)} style={{ ...inputStyle, marginBottom: 12 }} placeholder="Gói Pro" />
        <FieldLabel>Mô tả gói</FieldLabel>
        <input value={promo.unlockPackageDesc} onChange={(e) => set("unlockPackageDesc", e.target.value)} style={{ ...inputStyle, marginBottom: 12 }} placeholder="Truy cập toàn bộ tính năng Pro" />
        <FieldLabel>Giá hiển thị dự phòng (khi app chưa lấy được giá từ App Store)</FieldLabel>
        <input value={promo.unlockPriceLabel} onChange={(e) => set("unlockPriceLabel", e.target.value)} style={{ ...inputStyle, marginBottom: 12 }} placeholder="299.000đ" />
        <FieldLabel>Mô tả (dự phòng khi chưa có phụ đề)</FieldLabel>
        <textarea value={promo.unlockDescription} onChange={(e) => set("unlockDescription", e.target.value)} style={{ ...inputStyle, marginBottom: 12, minHeight: 64 }} />
        <FieldLabel>Link video giới thiệu</FieldLabel>
        <input value={promo.unlockVideoUrl} onChange={(e) => set("unlockVideoUrl", e.target.value)} style={{ ...inputStyle, marginBottom: 12 }} placeholder="https://..." />
        <FieldLabel>Apple Product ID (đã tạo trên App Store Connect)</FieldLabel>
        <input value={promo.appleProductId} onChange={(e) => set("appleProductId", e.target.value)} style={inputStyle} placeholder="com.therahome.phase3_unlock" />
      </div>

      <PrimaryBtn onClick={handleSave} disabled={saving}>{saving ? "Đang lưu..." : "Lưu nội dung upsell"}</PrimaryBtn>
    </div>
  );
}

export function PhaseContentModal({ phase, onClose }: { phase: ProgramPhase; onClose: () => void }) {
  const [tab, setTab] = useState<ContentTab>("quiz");

  return (
    <Modal title={"Quiz & Upsell · " + phase.name} onClose={onClose} width={520} footer={<GhostBtn onClick={onClose}>Đóng</GhostBtn>}>
      <div style={{ marginBottom: 14 }}>
        <PillTabs
          options={[
            ["quiz", "Câu hỏi Quiz"],
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
