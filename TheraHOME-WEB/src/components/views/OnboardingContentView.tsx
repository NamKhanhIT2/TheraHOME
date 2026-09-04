"use client";

// Real data: onboarding_question_texts — wording for the 8-question intake
// the app shows before activation. WORDING ONLY, on purpose:
//
// The app saves each answer as the option TEXT and translates a saved answer
// across languages by its POSITION in the option list. Adding, removing or
// reordering an option would silently re-map every existing profile to a
// different answer, so this editor exposes a FIXED number of option boxes
// with no add/remove control, and the question keys are read-only.
import { Fragment, useEffect, useMemo, useState } from "react";
import { SectionCard, PrimaryBtn, GhostBtn, FieldLabel, inputStyle, PillTabs, Badge } from "@/components/ui/primitives";
import { pushToast } from "@/components/ui/Toast";
import { fetchOnboardingTexts, saveOnboardingText, type OnboardingQuestionText, type LegalLang } from "@/lib/db";

const LANGS: Array<[LegalLang, string]> = [
  ["vi", "VN"],
  ["en", "UK"],
  ["ms", "ML"],
];

/** Plain-language description of what each answer drives, so staff know what
 * they are rewording. */
const PURPOSE: Record<string, string> = {
  goal_main: "Mục tiêu chính — hiển thị lại ở Hồ sơ → Chỉnh sửa (Mục tiêu tập luyện).",
  priority_zone: "Vùng ưu tiên — hiển thị lại ở Hồ sơ → Chỉnh sửa (Vùng đang tập).",
  home_reason: "Lý do chọn chăm sóc tại nhà (chọn nhiều).",
  tension_level: "Mức căng mỏi thường gặp.",
  tension_timing: "Thời điểm căng mỏi nhất (chọn nhiều).",
  age_group: "Nhóm tuổi.",
  daily_activity: "Mức vận động hằng ngày.",
  daily_time: "Thời gian có thể dành mỗi ngày.",
};

export function OnboardingContentView() {
  const [rows, setRows] = useState<OnboardingQuestionText[] | null>(null);
  const [lang, setLang] = useState<LegalLang>("vi");
  const [drafts, setDrafts] = useState<Record<string, OnboardingQuestionText>>({});
  const [savingKey, setSavingKey] = useState<string | null>(null);

  function reload() {
    return fetchOnboardingTexts()
      .then((data) => {
        setRows(data);
        setDrafts({});
      })
      .catch(() => pushToast("Không thể tải câu hỏi onboarding"));
  }
  useEffect(() => {
    void reload();
  }, []);

  // Keep the questionnaire in its real order by using the Vietnamese rows as
  // the canonical list (every language has the same 8 keys).
  const orderedKeys = useMemo(() => {
    const order = ["goal_main", "priority_zone", "home_reason", "tension_level", "tension_timing", "age_group", "daily_activity", "daily_time"];
    const present = [...new Set((rows ?? []).map((r) => r.questionKey))];
    return present.sort((a, b) => {
      const ia = order.indexOf(a);
      const ib = order.indexOf(b);
      return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
    });
  }, [rows]);

  function rowFor(key: string): OnboardingQuestionText | undefined {
    return rows?.find((r) => r.questionKey === key && r.language === lang);
  }
  function draftFor(key: string): OnboardingQuestionText | undefined {
    return drafts[`${key}:${lang}`] ?? rowFor(key);
  }
  function update(key: string, patch: Partial<OnboardingQuestionText>) {
    const base = draftFor(key);
    if (!base) return;
    setDrafts((current) => ({ ...current, [`${key}:${lang}`]: { ...base, ...patch } }));
  }

  async function save(key: string) {
    const draft = drafts[`${key}:${lang}`];
    const original = rowFor(key);
    if (!draft || !original || savingKey) return;
    if (!draft.title.trim() || draft.options.some((o) => !o.trim())) {
      pushToast("Tiêu đề và tất cả đáp án không được để trống");
      return;
    }
    setSavingKey(key);
    try {
      await saveOnboardingText(draft, original.options.length);
      await reload();
      pushToast("Đã lưu — app cập nhật trong ít phút");
    } catch (error) {
      pushToast(
        error instanceof Error && error.message === "option_count_mismatch"
          ? "Số lượng đáp án phải giữ nguyên"
          : "Không thể lưu (cần quyền admin/CSKH)",
      );
    } finally {
      setSavingKey(null);
    }
  }

  if (!rows) return <div style={{ color: "var(--text-secondary)", padding: 20 }}>Đang tải...</div>;

  return (
    <SectionCard title="Câu hỏi onboarding">
      <div style={{ fontSize: 12.5, color: "var(--text-secondary)", marginBottom: 8 }}>
        Bộ câu hỏi người dùng trả lời trước khi vào app — kết quả dùng để cá nhân hoá lộ trình.
        Sửa ở đây là app cập nhật trong ít phút, không cần bản build mới.
      </div>
      <div style={{ fontSize: 12.5, color: "#B9860B", background: "rgba(185,134,11,0.10)", borderRadius: 10, padding: "10px 12px", marginBottom: 16 }}>
        <strong>Chỉ sửa được chữ.</strong> Không thêm/bớt/đổi thứ tự đáp án được — vì câu trả lời của người dùng cũ được
        lưu theo <em>vị trí</em> đáp án; xáo trộn sẽ khiến hồ sơ đã lưu bị hiểu sang đáp án khác.
        Muốn thêm hoặc bỏ đáp án, cần đội kỹ thuật xử lý kèm chuyển đổi dữ liệu.
      </div>

      <div style={{ marginBottom: 16 }}>
        <PillTabs options={LANGS} value={lang} onChange={setLang} />
      </div>

      {orderedKeys.map((key, index) => {
        const row = rowFor(key);
        const draft = draftFor(key);
        if (!row || !draft) {
          return (
            <div key={key} style={{ paddingBottom: 16, marginBottom: 16, borderBottom: "1px solid var(--divider)" }}>
              <div style={{ fontWeight: 700, fontSize: 14, color: "var(--text-primary)" }}>{index + 1}. {key}</div>
              <div style={{ fontSize: 12.5, color: "var(--text-muted)", marginTop: 4 }}>
                Chưa có bản {lang === "en" ? "UK" : "ML"} — app đang dùng bản tiếng Việt cho thị trường này.
              </div>
            </div>
          );
        }
        const dirty = JSON.stringify(draft) !== JSON.stringify(row);
        return (
          <div key={key} style={{ paddingBottom: 18, marginBottom: 18, borderBottom: "1px solid var(--divider)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
              <div style={{ fontWeight: 700, fontSize: 14, color: "var(--text-primary)" }}>Câu {index + 1}</div>
              <Badge color="#8A93A3" bg="rgba(138,147,163,0.12)">{key}</Badge>
              <Badge color="#8A93A3" bg="rgba(138,147,163,0.12)">{row.options.length} đáp án · cố định</Badge>
            </div>
            {PURPOSE[key] ? <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 10 }}>{PURPOSE[key]}</div> : null}

            <FieldLabel>Câu hỏi</FieldLabel>
            <input value={draft.title} onChange={(e) => update(key, { title: e.target.value })} style={{ ...inputStyle, marginBottom: 10 }} />
            <FieldLabel>Mô tả phụ (có thể để trống)</FieldLabel>
            <input value={draft.subtitle} onChange={(e) => update(key, { subtitle: e.target.value })} style={{ ...inputStyle, marginBottom: 10 }} />

            <FieldLabel>Đáp án</FieldLabel>
            {draft.options.map((option, optionIndex) => (
              <div key={optionIndex} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                <span style={{ fontSize: 12, color: "var(--text-muted)", width: 18, textAlign: "right" }}>{optionIndex + 1}</span>
                <input
                  value={option}
                  onChange={(e) =>
                    update(key, { options: draft.options.map((o, i) => (i === optionIndex ? e.target.value : o)) })
                  }
                  style={{ ...inputStyle, flex: 1 }}
                />
              </div>
            ))}

            <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
              <PrimaryBtn onClick={() => save(key)} disabled={!dirty || savingKey === key}>
                {savingKey === key ? "Đang lưu..." : "Lưu câu này"}
              </PrimaryBtn>
              {dirty ? (
                <GhostBtn onClick={() => setDrafts((current) => {
                  const next = { ...current };
                  delete next[`${key}:${lang}`];
                  return next;
                })}>
                  Hoàn tác
                </GhostBtn>
              ) : null}
            </div>
          </div>
        );
      })}
    </SectionCard>
  );
}
