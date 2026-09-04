"use client";

// Real data: legal_documents. Terms/Privacy/Security/Community guidelines are
// bundled in BOTH apps as code (src/lib/appLegalContent.ts here,
// TheraHOME-APP/src/lib/legalContent.ts there); publishing an override row
// here makes the mobile app show the new text without a store release.
//
// The table starts empty on purpose: with no row, mobile renders exactly what
// it shipped with. "Khôi phục bản gốc" deletes the row to go back.
import { useEffect, useMemo, useState } from "react";
import { SectionCard, PrimaryBtn, GhostBtn, FieldLabel, inputStyle, PillTabs, Badge } from "@/components/ui/primitives";
import { pushToast } from "@/components/ui/Toast";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { fetchLegalOverrides, saveLegalOverride, deleteLegalOverride, type LegalDocOverride, type LegalLang } from "@/lib/db";
import { getLegalDoc, type LegalDocKey } from "@/lib/appLegalContent";

const DOCS: Array<[LegalDocKey, string]> = [
  ["terms", "Điều khoản sử dụng"],
  ["privacy", "Quyền riêng tư"],
  ["security", "Bảo mật thông tin"],
  ["community", "Quy định cộng đồng"],
];
const LANGS: Array<[LegalLang, string]> = [
  ["vi", "VN"],
  ["en", "UK"],
  ["ms", "ML"],
];

export function LegalContentView() {
  const [overrides, setOverrides] = useState<LegalDocOverride[] | null>(null);
  const [docKey, setDocKey] = useState<LegalDocKey>("terms");
  const [lang, setLang] = useState<LegalLang>("vi");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [saving, setSaving] = useState(false);
  const [reverting, setReverting] = useState(false);

  function reload() {
    return fetchLegalOverrides()
      .then(setOverrides)
      .catch(() => pushToast("Không thể tải nội dung pháp lý"));
  }
  useEffect(() => {
    void reload();
  }, []);

  const current = useMemo(
    () => overrides?.find((o) => o.docKey === docKey && o.language === lang) ?? null,
    [overrides, docKey, lang],
  );
  const bundled = useMemo(() => getLegalDoc(docKey, lang), [docKey, lang]);

  // Load the editor whenever the selection (or the fetched data) changes:
  // the published override if there is one, otherwise the app's own text so
  // staff edits from the real wording instead of a blank box.
  useEffect(() => {
    if (!overrides) return;
    const row = overrides.find((o) => o.docKey === docKey && o.language === lang);
    setTitle(row?.title ?? bundled.title);
    setBody(row?.body ?? bundled.text);
  }, [overrides, docKey, lang, bundled]);

  async function save() {
    if (saving) return;
    if (!title.trim() || !body.trim()) {
      pushToast("Tiêu đề và nội dung không được để trống");
      return;
    }
    setSaving(true);
    try {
      await saveLegalOverride({ docKey, language: lang, title: title.trim(), body });
      await reload();
      pushToast("Đã xuất bản — app sẽ hiển thị bản này, không cần build mới");
    } catch {
      pushToast("Không thể lưu (cần quyền admin/CSKH)");
    } finally {
      setSaving(false);
    }
  }

  async function revert() {
    try {
      await deleteLegalOverride(docKey, lang);
      await reload();
      pushToast("Đã khôi phục bản gốc trong app");
    } catch {
      pushToast("Không thể khôi phục");
    } finally {
      setReverting(false);
    }
  }

  if (!overrides) return <div style={{ color: "var(--text-secondary)", padding: 20 }}>Đang tải...</div>;

  const dirty = title !== (current?.title ?? bundled.title) || body !== (current?.body ?? bundled.text);

  return (
    <SectionCard
      title="Nội dung pháp lý"
      action={
        <div style={{ display: "flex", gap: 8 }}>
          {current ? <GhostBtn color="var(--error)" onClick={() => setReverting(true)}>Khôi phục bản gốc</GhostBtn> : null}
          <PrimaryBtn onClick={save} disabled={saving || !dirty}>
            {saving ? "Đang lưu..." : "Xuất bản"}
          </PrimaryBtn>
        </div>
      }
    >
      <div style={{ fontSize: 12.5, color: "var(--text-secondary)", marginBottom: 16 }}>
        Văn bản hiển thị trong app (Hồ sơ → Điều khoản/Quyền riêng tư…) và là 2 đường link đã khai báo với App Store.
        Chưa xuất bản thì app dùng bản đóng gói sẵn; xuất bản xong app cập nhật trong ít phút mà không cần bản build mới.
        <strong> Nên để bộ phận pháp lý duyệt trước khi xuất bản.</strong>
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
        {DOCS.map(([key, label]) => (
          <button
            key={key}
            onClick={() => setDocKey(key)}
            style={{
              border: "1px solid " + (docKey === key ? "var(--color-primary)" : "var(--border-input)"),
              background: docKey === key ? "var(--color-primary-tint-10)" : "#fff",
              color: docKey === key ? "var(--color-primary)" : "var(--text-secondary)",
              borderRadius: 8,
              padding: "7px 14px",
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

      <div style={{ marginBottom: 12 }}>
        <PillTabs options={LANGS} value={lang} onChange={setLang} />
      </div>

      <div style={{ marginBottom: 12 }}>
        {current ? (
          <Badge color="var(--color-primary)" bg="var(--color-primary-tint-10)">
            Đang dùng bản đã xuất bản · cập nhật {new Date(current.updatedAt).toLocaleString("vi-VN")}
          </Badge>
        ) : (
          <Badge color="#8A93A3" bg="rgba(138,147,163,0.12)">Đang dùng bản gốc đóng gói trong app</Badge>
        )}
      </div>

      <FieldLabel>Tiêu đề</FieldLabel>
      <input value={title} onChange={(e) => setTitle(e.target.value)} style={{ ...inputStyle, marginBottom: 14 }} />
      <FieldLabel>Nội dung</FieldLabel>
      <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 6 }}>
        Giữ nguyên cấu trúc: dòng 1 là tiêu đề lớn, dòng 2 phụ đề, dòng 3 ngày cập nhật, dòng 4 khung lưu ý;
        các mục đánh số dạng &quot;1.&quot; / &quot;2.1.&quot; là đầu mục; dòng bắt đầu bằng dấu tab là gạch đầu dòng.
      </div>
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        spellCheck={false}
        style={{ ...inputStyle, minHeight: 420, resize: "vertical", fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontSize: 12.5, lineHeight: 1.6 }}
      />

      {reverting ? (
        <ConfirmModal
          title="Khôi phục bản gốc"
          message="Xoá bản đã xuất bản của văn bản này? App sẽ quay lại dùng nội dung đóng gói sẵn trong bản build."
          confirmLabel="Khôi phục"
          onConfirm={revert}
          onCancel={() => setReverting(false)}
        />
      ) : null}
    </SectionCard>
  );
}
