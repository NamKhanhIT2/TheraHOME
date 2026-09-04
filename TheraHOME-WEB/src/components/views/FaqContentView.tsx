"use client";

// Real data: faq_items — the FAQ list on Hồ sơ → Trợ giúp in the mobile app.
// Previously four hardcoded i18n key pairs, so answering a newly recurring
// customer question needed a store release. Saving here reaches every
// install within minutes.
import { Fragment, useEffect, useState } from "react";
import { TableShell } from "@/components/ui/TableShell";
import { Modal } from "@/components/ui/Modal";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { PrimaryBtn, GhostBtn, Badge, FieldLabel, inputStyle, PillTabs } from "@/components/ui/primitives";
import { Icon } from "@/components/ui/Icon";
import { pushToast } from "@/components/ui/Toast";
import { fetchFaqItems, saveFaqItem, deleteFaqItem, reorderFaqItems, type FaqItemAdmin } from "@/lib/db";
import { translateDrafts } from "@/lib/translate";

type Lang = "vi" | "en" | "ms";
const LANGS: Array<[Lang, string]> = [
  ["vi", "VN"],
  ["en", "UK"],
  ["ms", "ML"],
];

function emptyItem(sortOrder: number): FaqItemAdmin {
  return {
    id: "new",
    sortOrder,
    active: true,
    questionVi: "",
    answerVi: "",
    questionEn: "",
    answerEn: "",
    questionMs: "",
    answerMs: "",
  };
}

export function FaqContentView() {
  const [items, setItems] = useState<FaqItemAdmin[] | null>(null);
  const [draft, setDraft] = useState<FaqItemAdmin | null>(null);
  const [lang, setLang] = useState<Lang>("vi");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<FaqItemAdmin | null>(null);

  function reload() {
    return fetchFaqItems()
      .then(setItems)
      .catch(() => pushToast("Không thể tải câu hỏi thường gặp"));
  }
  useEffect(() => {
    void reload();
  }, []);

  function field(item: FaqItemAdmin, kind: "question" | "answer", language: Lang): string {
    const key = `${kind}${language === "vi" ? "Vi" : language === "en" ? "En" : "Ms"}` as keyof FaqItemAdmin;
    return String(item[key] ?? "");
  }
  function setField(kind: "question" | "answer", language: Lang, value: string) {
    const key = `${kind}${language === "vi" ? "Vi" : language === "en" ? "En" : "Ms"}`;
    setDraft((current) => (current ? { ...current, [key]: value } : current));
  }

  async function save() {
    if (!draft || saving) return;
    if (!draft.questionVi.trim() || !draft.answerVi.trim()) {
      pushToast("Cần nhập câu hỏi và câu trả lời tiếng Việt");
      return;
    }
    setSaving(true);
    try {
      // Auto-draft the UK/ML wording when staff only filled Vietnamese —
      // same behaviour as the quiz/upsell editors.
      let toSave = draft;
      const needs = !draft.questionEn.trim() || !draft.answerEn.trim() || !draft.questionMs.trim() || !draft.answerMs.trim();
      let drafted = false;
      if (needs) {
        const drafts = await translateDrafts({ question: draft.questionVi, answer: draft.answerVi });
        if (drafts) {
          toSave = {
            ...draft,
            questionEn: draft.questionEn.trim() || drafts.en.question || "",
            answerEn: draft.answerEn.trim() || drafts.en.answer || "",
            questionMs: draft.questionMs.trim() || drafts.ms.question || "",
            answerMs: draft.answerMs.trim() || drafts.ms.answer || "",
          };
          drafted = true;
        }
      }
      await saveFaqItem(toSave);
      setDraft(null);
      await reload();
      pushToast(drafted ? "Đã lưu · đã tự dịch nháp UK/ML" : "Đã lưu câu hỏi");
    } catch {
      pushToast("Không thể lưu (cần quyền admin/CSKH)");
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!deleting) return;
    try {
      await deleteFaqItem(deleting.id);
      await reload();
      pushToast("Đã xoá câu hỏi");
    } catch {
      pushToast("Không thể xoá");
    } finally {
      setDeleting(null);
    }
  }

  async function move(index: number, direction: -1 | 1) {
    if (!items) return;
    const next = items.slice();
    const target = index + direction;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    setItems(next);
    try {
      await reorderFaqItems(next.map((i) => i.id));
    } catch {
      pushToast("Không thể đổi thứ tự");
      void reload();
    }
  }

  async function toggleActive(item: FaqItemAdmin) {
    try {
      await saveFaqItem({ ...item, active: !item.active });
      await reload();
    } catch {
      pushToast("Không thể cập nhật trạng thái");
    }
  }

  if (!items) return <div style={{ color: "var(--text-secondary)", padding: 20 }}>Đang tải...</div>;

  return (
    <TableShell
      subtitle="Danh sách câu hỏi trong app tại Hồ sơ → Trợ giúp. Sửa ở đây là app cập nhật trong ít phút, không cần bản build mới."
      action={<PrimaryBtn icon="plus" onClick={() => { setDraft(emptyItem(items.length + 1)); setLang("vi"); }}>Thêm câu hỏi</PrimaryBtn>}
      columns={["Thứ tự", "Câu hỏi (VN)", "Bản dịch", "Trạng thái", "Thao tác"]}
      modals={
        <Fragment>
          {draft ? (
            <Modal
              title={draft.id === "new" ? "Thêm câu hỏi" : "Sửa câu hỏi"}
              onClose={() => setDraft(null)}
              width={560}
              footer={
                <Fragment>
                  <GhostBtn onClick={() => setDraft(null)}>Hủy</GhostBtn>
                  <PrimaryBtn onClick={save} disabled={saving}>{saving ? "Đang lưu..." : "Lưu"}</PrimaryBtn>
                </Fragment>
              }
            >
              <PillTabs options={LANGS} value={lang} onChange={setLang} />
              {lang !== "vi" ? (
                <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 8, marginBottom: 10 }}>
                  Để trống thì khi lưu hệ thống sẽ tự dịch nháp từ bản tiếng Việt (sửa lại được bất cứ lúc nào).
                </div>
              ) : null}
              <div style={{ marginTop: 12 }}>
                <FieldLabel>Câu hỏi ({lang === "vi" ? "VN" : lang === "en" ? "UK" : "ML"})</FieldLabel>
                <input
                  value={field(draft, "question", lang)}
                  onChange={(e) => setField("question", lang, e.target.value)}
                  placeholder={lang === "vi" ? "Ví dụ: Làm sao để mở khóa ngày tiếp theo?" : draft.questionVi}
                  style={{ ...inputStyle, marginBottom: 14 }}
                />
                <FieldLabel>Câu trả lời ({lang === "vi" ? "VN" : lang === "en" ? "UK" : "ML"})</FieldLabel>
                <textarea
                  value={field(draft, "answer", lang)}
                  onChange={(e) => setField("answer", lang, e.target.value)}
                  placeholder={lang === "vi" ? undefined : draft.answerVi}
                  style={{ ...inputStyle, minHeight: 140, resize: "vertical" }}
                />
              </div>
            </Modal>
          ) : null}
          {deleting ? (
            <ConfirmModal
              title="Xoá câu hỏi"
              message={`Xoá "${deleting.questionVi.slice(0, 80)}" khỏi mục Trợ giúp trong app?`}
              confirmLabel="Xoá"
              onConfirm={remove}
              onCancel={() => setDeleting(null)}
            />
          ) : null}
        </Fragment>
      }
    >
      {items.map((item, index) => (
        <tr key={item.id} style={{ borderTop: "1px solid var(--divider)" }}>
          <td style={{ padding: "14px 20px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <button onClick={() => move(index, -1)} disabled={index === 0} style={arrowStyle(index === 0)}>
                <Icon name="chevron-down" size={14} color="var(--text-secondary)" />
              </button>
              <span style={{ fontSize: 13, color: "var(--text-secondary)", minWidth: 16, textAlign: "center" }}>{index + 1}</span>
              <button onClick={() => move(index, 1)} disabled={index === items.length - 1} style={arrowStyle(index === items.length - 1)}>
                <Icon name="chevron-down" size={14} color="var(--text-secondary)" />
              </button>
            </div>
          </td>
          <td style={{ padding: "14px 20px", maxWidth: 380 }}>
            <div style={{ fontWeight: 600, color: "var(--text-primary)" }}>{item.questionVi}</div>
            <div style={{ fontSize: 12.5, color: "var(--text-muted)", marginTop: 3 }}>{item.answerVi.slice(0, 120)}{item.answerVi.length > 120 ? "…" : ""}</div>
          </td>
          <td style={{ padding: "14px 20px" }}>
            <div style={{ display: "flex", gap: 6 }}>
              {(["en", "ms"] as const).map((code) => {
                const has = code === "en" ? item.questionEn && item.answerEn : item.questionMs && item.answerMs;
                return has ? (
                  <Badge key={code} color="#1E9E5E" bg="rgba(30,158,94,0.12)">{code === "en" ? "UK" : "ML"}</Badge>
                ) : (
                  <Badge key={code} color="#8A93A3" bg="rgba(138,147,163,0.12)">{code === "en" ? "UK" : "ML"} · dùng VN</Badge>
                );
              })}
            </div>
          </td>
          <td style={{ padding: "14px 20px" }}>
            {item.active ? (
              <Badge color="#1E9E5E" bg="rgba(30,158,94,0.12)">Đang hiện</Badge>
            ) : (
              <Badge color="#8A93A3" bg="rgba(138,147,163,0.12)">Đã ẩn</Badge>
            )}
          </td>
          <td style={{ padding: "14px 20px" }}>
            <div style={{ display: "flex", gap: 8 }}>
              <GhostBtn onClick={() => { setDraft(item); setLang("vi"); }}>Sửa</GhostBtn>
              <GhostBtn onClick={() => toggleActive(item)}>{item.active ? "Ẩn" : "Hiện"}</GhostBtn>
              <GhostBtn color="var(--error)" onClick={() => setDeleting(item)}>Xoá</GhostBtn>
            </div>
          </td>
        </tr>
      ))}
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
