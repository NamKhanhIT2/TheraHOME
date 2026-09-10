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
  fetchRoadmapReadiness,
  fetchAppConfig,
  saveAppConfig,
  type AppConfigRow,
} from "@/lib/db";
import { GhostBtn, PrimaryBtn, FieldLabel, inputStyle, PillTabs } from "@/components/ui/primitives";
import { Modal } from "@/components/ui/Modal";
import { Icon } from "@/components/ui/Icon";
import { pushToast } from "@/components/ui/Toast";
import { translateDrafts } from "@/lib/translate";

type ContentTab = "quiz" | "promo" | "suggest";
type QuizLangKey = "vi" | "en" | "ms";

// The whole modal follows the outer "Thị trường" selector (RoutineView) — no
// second per-tab language filter. A market maps 1:1 to the content language.
type Market = "vn" | "us" | "malay";
const MARKET_TO_LANG: Record<Market, QuizLangKey> = { vn: "vi", us: "en", malay: "ms" };
const MARKET_LABEL: Record<Market, string> = { vn: "VN", us: "UK", malay: "ML" };
const QUIZ_LANG_TABS: Array<[QuizLangKey, string]> = [["vi", "VN"], ["en", "EN"], ["ms", "MS"]];
const EMPTY_QUIZ_LANGUAGE: QuizLanguageContent = { question: "", options: ["", "", "", ""], correctIndex: 0 };

function emptyDraft(sortOrder: number): QuizQuestionAdmin {
  return { id: "", sortOrder, vi: { ...EMPTY_QUIZ_LANGUAGE, options: [...EMPTY_QUIZ_LANGUAGE.options] }, en: { ...EMPTY_QUIZ_LANGUAGE, options: [...EMPTY_QUIZ_LANGUAGE.options] }, ms: { ...EMPTY_QUIZ_LANGUAGE, options: [...EMPTY_QUIZ_LANGUAGE.options] } };
}

function QuestionEditor({ draft, lang, onChange, onCancel, onSave, saving }: { draft: QuizQuestionAdmin; lang: QuizLangKey; onChange: (d: QuizQuestionAdmin) => void; onCancel: () => void; onSave: () => void; saving: boolean }) {
  const content = draft[lang];
  const langLabel = QUIZ_LANG_TABS.find(([k]) => k === lang)?.[1] ?? "VN";

  function updateContent(patch: Partial<QuizLanguageContent>) {
    onChange({ ...draft, [lang]: { ...content, ...patch } });
  }
  function updateOption(index: number, value: string) {
    const options = content.options.slice();
    options[index] = value;
    updateContent({ options });
  }
  // Add/remove apply to EVERY language at once. The app maps a saved answer
  // by option POSITION, so vi/en/ms must always have the same count — a
  // 5-option VN quiz with a 4-option EN version silently re-maps answers.
  function addOption() {
    if (content.options.length >= 6) return;
    const next = { ...draft };
    for (const [code] of QUIZ_LANG_TABS) {
      const entry = next[code] ?? { question: "", options: [], correctIndex: 0 };
      next[code] = { ...entry, options: [...entry.options, ""] };
    }
    onChange(next);
  }
  function removeOption(index: number) {
    if (content.options.length <= 2) return;
    const next = { ...draft };
    for (const [code] of QUIZ_LANG_TABS) {
      const entry = next[code];
      if (!entry) continue;
      const options = entry.options.filter((_, i) => i !== index);
      next[code] = { ...entry, options, correctIndex: entry.correctIndex >= options.length ? 0 : entry.correctIndex };
    }
    onChange(next);
  }

  return (
    <div style={{ background: "var(--bg-card-alt)", borderRadius: 12, padding: 16, marginBottom: 12 }}>
      <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 10 }}>
        {lang === "vi"
          ? "Soạn câu hỏi bằng bản VN (gốc) — bản EN/MS sẽ tự dịch khi lưu."
          : `Đang sửa bản ${langLabel} (chỉnh lại bản dịch tự động). Để trống = dùng bản VN.`}
      </div>
      <div>
        <FieldLabel>Câu hỏi ({langLabel})</FieldLabel>
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

function QuizTab({ phaseId, lang }: { phaseId: string; lang: QuizLangKey }) {
  const [questions, setQuestions] = useState<QuizQuestionAdmin[] | null>(null);
  const [draft, setDraft] = useState<QuizQuestionAdmin | null>(null);
  const [saving, setSaving] = useState(false);

  function reload() {
    fetchQuizQuestions(phaseId).then(setQuestions).catch(() => pushToast("Không thể tải câu hỏi quiz"));
  }
  useEffect(reload, [phaseId]);

  async function handleSave() {
    if (saving) return;
    if (!draft) return;
    const vi = draft.vi;
    if (!vi.question.trim() || vi.options.some((o) => !o.trim())) {
      pushToast("Vui lòng điền đầy đủ câu hỏi và các lựa chọn (ít nhất tiếng Việt)");
      return;
    }
    // A language that HAS a question must have every option filled and the
    // same option count as VN — otherwise UK/ML users get blank buttons or
    // answers that map to the wrong VN option.
    for (const [code, label] of QUIZ_LANG_TABS) {
      if (code === "vi") continue;
      const entry = draft[code];
      if (!entry?.question.trim()) continue;
      if (entry.options.length !== vi.options.length || entry.options.some((o) => !o.trim())) {
        pushToast(`Bản ${label}: cần đủ ${vi.options.length} lựa chọn, không để trống lựa chọn nào`);
        return;
      }
    }
    setSaving(true);
    try {
      // Auto-draft EN/MS from the VN content when a language was left
      // untouched (per explicit request 2026-09-04): staff only writes VN,
      // the drafts land in the same en/ms slots the app reads, and stay
      // editable here afterwards. A failed translation saves VN-only —
      // the app then falls back per its normal language logic.
      let { en, ms } = draft;
      const needsEn = !en.question.trim();
      const needsMs = !ms.question.trim();
      let drafted = false;
      if (needsEn || needsMs) {
        const texts: Record<string, string> = { question: vi.question };
        vi.options.forEach((option, i) => {
          texts[`option_${i}`] = option;
        });
        const drafts = await translateDrafts(texts);
        if (drafts) {
          const fill = (lang: "en" | "ms"): QuizLanguageContent => ({
            question: drafts[lang].question ?? vi.question,
            options: vi.options.map((option, i) => drafts[lang][`option_${i}`] ?? option),
            correctIndex: vi.correctIndex,
          });
          if (needsEn) en = fill("en");
          if (needsMs) ms = fill("ms");
          drafted = true;
        }
      }
      await saveQuizQuestion(phaseId, { id: draft.id || null, sortOrder: draft.sortOrder, vi: draft.vi, en, ms });
      setDraft(null);
      pushToast(drafted ? "Đã lưu câu hỏi + tự dịch nháp EN/MS (kiểm tra lại ở 2 tab)" : "Đã lưu câu hỏi");
      reload();
    } catch {
      pushToast("Không thể lưu câu hỏi");
    } finally {
      setSaving(false);
    }
  }
  async function handleDelete(id: string) {
    if (saving) return;
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
            <QuestionEditor draft={draft} lang={lang} onChange={setDraft} onCancel={() => setDraft(null)} onSave={handleSave} saving={saving} />
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
        // A new question is authored in VN (the required base); EN/MS are
        // auto-drafted on save regardless of the market being viewed.
        <QuestionEditor draft={draft} lang="vi" onChange={setDraft} onCancel={() => setDraft(null)} onSave={handleSave} saving={saving} />
      ) : (
        <GhostBtn onClick={() => setDraft(emptyDraft(questions.length))}>+ Thêm câu hỏi</GhostBtn>
      )}
    </div>
  );
}

type PromoLangTab = "vi" | "en" | "ms";
/** Fields editable per language (text/urls). Images + Apple/Google Product
 * IDs are shared across languages and only shown on the VN tab. */
type PromoTextKey = keyof PhasePromoTranslation;

function PromoTab({ phaseId, productId, phaseRange, lang }: { phaseId: string; productId: string; phaseRange: [number, number]; lang: PromoLangTab }) {
  const [promo, setPromo] = useState<PhasePromoAdmin | null>(null);
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
    return lang === "vi" ? promo[key] : promo.translations[lang][key];
  }
  function setText(key: PromoTextKey, value: string) {
    setPromo((p) => {
      if (!p) return p;
      if (lang === "vi") return { ...p, [key]: value };
      return { ...p, translations: { ...p.translations, [lang]: { ...p.translations[lang], [key]: value } } };
    });
  }
  function hint(key: PromoTextKey, viPlaceholder?: string): string | undefined {
    if (!promo) return viPlaceholder;
    if (lang === "vi") return viPlaceholder;
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
    if (saving) return;
    if (!promo) return;
    setSaving(true);
    try {
      // Auto-draft EN/MS overrides for text fields staff left empty (per
      // explicit request 2026-09-04). URLs and the fallback price label are
      // deliberately NOT translated — they're shared/market-specific. A
      // failed translation just saves VN-only (app falls back per field).
      const TRANSLATABLE: PromoTextKey[] = [
        "crossSellBadge", "crossSellTitle", "crossSellDescription",
        "unlockDescription", "unlockBadge", "unlockTitle", "unlockSubtitle",
        "unlockBenefits", "unlockPackageName", "unlockPackageDesc",
      ];
      let toSave = promo;
      const needed = TRANSLATABLE.filter(
        (key) => promo[key].trim() && (!promo.translations.en[key].trim() || !promo.translations.ms[key].trim()),
      );
      if (needed.length) {
        const drafts = await translateDrafts(Object.fromEntries(needed.map((key) => [key, promo[key]])));
        if (drafts) {
          const merge = (lang: "en" | "ms"): PhasePromoTranslation => {
            const entry = { ...promo.translations[lang] };
            for (const key of needed) {
              if (!entry[key].trim() && drafts[lang][key]) entry[key] = drafts[lang][key];
            }
            return entry;
          };
          toSave = { ...promo, translations: { en: merge("en"), ms: merge("ms") } };
          setPromo(toSave);
        }
      }
      // Selling a phase whose days lack videos or merely repeat earlier days'
      // videos (the phase-3 placeholder state, owner 2026-09-05) would charge
      // customers for empty content — hard block, VN market as the baseline.
      if (toSave.salesEnabled) {
        const readiness = await fetchRoadmapReadiness(productId);
        const vn = readiness.find((r) => r.market === "VN");
        const inPhase = (day: number) => day >= phaseRange[0] && day <= phaseRange[1];
        const missing = vn?.missingDays.filter(inPhase) ?? [];
        const duplicated = vn?.duplicateDays.filter(inPhase) ?? [];
        if (missing.length || duplicated.length) {
          pushToast(
            `Chưa thể mở bán: giai đoạn này ${missing.length ? `thiếu video ngày ${missing.join(", ")}` : ""}${missing.length && duplicated.length ? "; " : ""}${duplicated.length ? `lặp lại video ngày trước ở ngày ${duplicated.join(", ")}` : ""}. Bổ sung video ở tab Lộ trình rồi mới bật.`,
          );
          return;
        }
      }
      await savePhasePromo(phaseId, toSave);
      pushToast(toSave !== promo ? "Đã lưu + tự dịch nháp EN/MS (kiểm tra lại ở 2 tab)" : "Đã lưu nội dung upsell");
    } catch {
      pushToast("Không thể lưu nội dung upsell");
    } finally {
      setSaving(false);
    }
  }

  if (!promo) return <div style={{ color: "var(--text-secondary)", padding: 10 }}>Đang tải...</div>;

  const isVi = lang === "vi";

  return (
    <div>
      {!isVi ? (
        <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 12 }}>
          Đang sửa cho thị trường {lang === "en" ? "UK" : "ML"}: chữ hiển thị cho người dùng đặt ngôn ngữ {lang === "en" ? "tiếng Anh" : "tiếng Malay"}, VÀ giá + link mua cho khách thuộc thị trường {lang === "en" ? "UK" : "ML"} (giá/link đi theo QUỐC GIA của khách). Trường nào để trống, app dùng bản VN. Ảnh và Apple/Google Product ID dùng chung — chỉnh ở thị trường VN.
        </div>
      ) : null}
      {isVi ? (
        <div style={{ background: "#fff", borderRadius: 12, padding: 14, boxShadow: "var(--shadow-card)", marginBottom: 14, display: "flex", gap: 10, alignItems: "flex-start" }}>
          <input
            type="checkbox"
            id="promo-sales-enabled"
            checked={promo.salesEnabled}
            onChange={(e) => set("salesEnabled", e.target.checked)}
            style={{ marginTop: 3, cursor: "pointer" }}
          />
          <label htmlFor="promo-sales-enabled" style={{ fontSize: 13, color: "var(--text-primary)", cursor: "pointer" }}>
            <strong>Đang mở bán giai đoạn này</strong>
            <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>
              Bỏ chọn khi chưa thể bán IAP (ví dụ chờ Paid Apps Agreement active): app sẽ ẨN hẳn header giai đoạn khoá,
              cả 2 thẻ giới thiệu và màn paywall — nội dung vẫn bị khoá, không ai truy cập được. Tick lại là hiện ngay
              trên mọi máy, không cần build mới.
            </div>
          </label>
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

type SuggestLang = "vi" | "en" | "ms";
const SUGGEST_LANG_TABS: Array<[SuggestLang, string]> = [["vi", "VN"], ["en", "EN"], ["ms", "MS"]];
const SUGGEST_TITLE_KEY = "survey_suggestion_title";
const SUGGEST_BODY_KEY = "survey_suggestion_body";
const emptyConfigRow = (key: string): AppConfigRow => ({ key, valueVi: "", valueEn: "", valueMs: "" });

/** The "Gợi ý từ TheraHOME" screen shown after any phase survey is submitted.
 * Content is GLOBAL (app_config, shared by every phase) — the note says so —
 * with two parts: a title and a body. Kept here (not in "Nội dung ứng dụng")
 * because this is where staff manage the survey, so it's where they look. */
function SuggestTab({ lang }: { lang: SuggestLang }) {
  const [title, setTitle] = useState<AppConfigRow | null>(null);
  const [body, setBody] = useState<AppConfigRow | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchAppConfig()
      .then((rows) => {
        setTitle(rows.find((r) => r.key === SUGGEST_TITLE_KEY) ?? emptyConfigRow(SUGGEST_TITLE_KEY));
        setBody(rows.find((r) => r.key === SUGGEST_BODY_KEY) ?? emptyConfigRow(SUGGEST_BODY_KEY));
      })
      .catch(() => pushToast("Không thể tải nội dung gợi ý"));
  }, []);

  const col: keyof AppConfigRow = lang === "vi" ? "valueVi" : lang === "en" ? "valueEn" : "valueMs";
  const langLabel = SUGGEST_LANG_TABS.find(([k]) => k === lang)?.[1] ?? "VN";

  async function handleSave() {
    if (saving || !title || !body) return;
    if (!title.valueVi.trim() || !body.valueVi.trim()) {
      pushToast("Vui lòng điền Tiêu đề và Nội dung (ít nhất bản VN)");
      return;
    }
    setSaving(true);
    try {
      await saveAppConfig([title, body]);
      pushToast("Đã lưu nội dung gợi ý — app cập nhật trong vài phút, không cần bản build mới");
    } catch {
      pushToast("Không thể lưu nội dung gợi ý");
    } finally {
      setSaving(false);
    }
  }

  if (!title || !body) return <div style={{ color: "var(--text-secondary)", padding: 10 }}>Đang tải...</div>;

  return (
    <div>
      <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 12 }}>
        Màn <b>&quot;Gợi ý từ TheraHOME&quot;</b> hiện ra sau khi người dùng gửi khảo sát (và khi mở lại khảo sát đã trả lời).{" "}
        <b>Dùng chung cho mọi giai đoạn</b> — sửa ở đây áp dụng cho tất cả khảo sát.
      </div>
      {lang !== "vi" ? (
        <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 12 }}>
          Đang sửa bản {langLabel}. Để trống = dùng bản VN.
        </div>
      ) : null}
      <div style={{ marginTop: 10 }}>
        <FieldLabel>Phần 1 · Tiêu đề ({langLabel})</FieldLabel>
        <div style={{ fontSize: 11.5, color: "var(--text-muted)", marginBottom: 6, lineHeight: 1.5 }}>
          Xuống dòng để tách đoạn. <b>Phần 1</b>: dòng đầu to + căn giữa, các dòng sau căn giữa.{" "}
          <b>Phần 2</b>: dòng cuối căn giữa, các dòng trên căn trái.<br />
          Đánh dấu: <b>*chữ*</b> = làm nổi bật (màu thương hiệu), <b>~chữ~</b> = làm mờ.
        </div>
        <textarea
          value={title[col]}
          onChange={(e) => setTitle({ ...title, [col]: e.target.value })}
          style={{ ...inputStyle, minHeight: 72, lineHeight: 1.5, marginBottom: 16 }}
          placeholder={lang === "vi" ? "Chúng tôi đã hiểu bạn hơn\n(xuống dòng)..." : title.valueVi || "Gợi ý từ TheraHOME"}
        />
        <FieldLabel>Phần 2 · Nội dung ({langLabel})</FieldLabel>
        <textarea
          value={body[col]}
          onChange={(e) => setBody({ ...body, [col]: e.target.value })}
          style={{ ...inputStyle, minHeight: 150, lineHeight: 1.5, marginBottom: 16 }}
          placeholder={lang === "vi" ? "Lời khuyên / gợi ý cho người dùng sau khi hoàn thành khảo sát..." : body.valueVi || "..."}
        />
      </div>
      <PrimaryBtn onClick={handleSave} disabled={saving}>{saving ? "Đang lưu..." : "Lưu nội dung gợi ý"}</PrimaryBtn>
    </div>
  );
}

export function PhaseContentModal({ phase, productId, market, onClose }: { phase: ProgramPhase; productId: string; market: Market; onClose: () => void }) {
  const [tab, setTab] = useState<ContentTab>("quiz");
  const lang = MARKET_TO_LANG[market];

  return (
    <Modal title={"Khảo sát & Upsell · " + phase.name} onClose={onClose} width={520} footer={<GhostBtn onClick={onClose}>Đóng</GhostBtn>}>
      <div style={{ marginBottom: 12 }}>
        <PillTabs
          options={[
            ["quiz", "Câu hỏi khảo sát"],
            ["suggest", "Gợi ý sau khảo sát"],
            ["promo", "Nội dung Upsell"],
          ]}
          value={tab}
          onChange={setTab}
        />
      </div>
      <div style={{ marginBottom: 14, fontSize: 12, color: "var(--text-secondary)", background: "var(--bg-card-alt)", borderRadius: 8, padding: "8px 10px" }}>
        Đang sửa nội dung cho thị trường <b>{MARKET_LABEL[market]}</b> — đổi ở ô <b>Thị trường</b> trên trang Lộ trình.
      </div>
      {tab === "quiz" ? (
        <QuizTab phaseId={phase.id} lang={lang} />
      ) : tab === "suggest" ? (
        <SuggestTab lang={lang} />
      ) : (
        <PromoTab phaseId={phase.id} productId={productId} phaseRange={phase.range} lang={lang} />
      )}
    </Modal>
  );
}
