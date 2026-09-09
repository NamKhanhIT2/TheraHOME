"use client";

// Real data: app_config. These are values the mobile app used to hardcode in
// its bundle — changing the support hotline or the Home "Hướng dẫn nhanh"
// video meant a code change plus a store release. Saving here takes effect on
// every install within a few minutes (mobile caches for 5 minutes; see
// TheraHOME-APP/src/hooks/useAppConfig.ts), no new build required.
import { useEffect, useState, type CSSProperties } from "react";
import { SectionCard, PrimaryBtn, FieldLabel, inputStyle } from "@/components/ui/primitives";
import { pushToast } from "@/components/ui/Toast";
import { fetchAppConfig, saveAppConfig, type AppConfigRow } from "@/lib/db";

/** Human labels + help text per key. A key present in the DB but missing
 * here still renders (raw key as the label), so adding a row server-side
 * never leaves it uneditable. */
const FIELD_META: Record<string, { label: string; help: string; localized: boolean; placeholder?: string; multiline?: boolean }> = {
  support_hotline: {
    label: "Số hotline (để trống = ẨN mục hotline trong app)",
    help:
      "Hiện đang để trống nên app KHÔNG hiển thị mục Hotline (Hồ sơ → Trợ giúp) — người dùng vẫn liên hệ qua Chat chuyên gia, Trợ lý AI và email. " +
      "Khi có tổng đài, điền số ở đây (chỉ chữ số, ví dụ 02412345678) là mục hotline xuất hiện lại ngay, không cần bản build mới.",
    localized: false,
    placeholder: "Để trống nếu chưa có hotline",
  },
  support_hotline_label: {
    label: "Hotline hiển thị + giờ làm việc",
    help: "Dòng chữ dưới mục Hotline. Chỉ có tác dụng khi đã điền số hotline ở trên.",
    localized: true,
    placeholder: "Ví dụ: 024 1234 5678 · 8:00–21:00",
  },
  support_email: {
    label: "Email hỗ trợ",
    help: "Hiện ở Hồ sơ → Trợ giúp; bấm vào sẽ mở ứng dụng email.",
    localized: false,
    placeholder: "support@therahomeai.com",
  },
  home_intro_video_url: {
    label: 'Link video nút "Hướng dẫn nhanh" (Trang chủ)',
    help: "Nút nằm cạnh 'Bắt đầu hôm nay' trên Trang chủ. Có thể đặt link riêng cho từng thị trường.",
    localized: true,
    placeholder: "https://www.youtube.com/watch?v=...",
  },
};

// Managed in a dedicated editor elsewhere, so hidden from this generic list:
// the survey "Gợi ý từ TheraHOME" title/body live in the Lộ trình → "Quản lý
// Khảo sát & Upsell" modal (PhaseContentModal's "Gợi ý sau khảo sát" tab).
const MANAGED_ELSEWHERE = new Set(["survey_suggestion_title", "survey_suggestion_body"]);

export function AppContentView() {
  const [rows, setRows] = useState<AppConfigRow[] | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchAppConfig()
      .then((rows) => setRows(rows.filter((r) => !MANAGED_ELSEWHERE.has(r.key))))
      .catch(() => pushToast("Không thể tải nội dung ứng dụng"));
  }, []);

  function update(key: string, patch: Partial<AppConfigRow>) {
    setRows((current) => (current ? current.map((r) => (r.key === key ? { ...r, ...patch } : r)) : current));
  }

  async function save() {
    if (!rows || saving) return;
    setSaving(true);
    try {
      await saveAppConfig(rows);
      pushToast("Đã lưu — app sẽ cập nhật trong vài phút, không cần bản build mới");
    } catch {
      pushToast("Không thể lưu nội dung ứng dụng");
    } finally {
      setSaving(false);
    }
  }

  if (!rows) return <div style={{ color: "var(--text-secondary)", padding: 20 }}>Đang tải...</div>;

  return (
    <SectionCard
      title="Nội dung ứng dụng"
      action={
        <PrimaryBtn onClick={save} disabled={saving}>
          {saving ? "Đang lưu..." : "Lưu thay đổi"}
        </PrimaryBtn>
      }
    >
      <div style={{ fontSize: 12.5, color: "var(--text-secondary)", marginBottom: 18 }}>
        Các nội dung hiển thị trong app mobile mà trước đây phải sửa code + phát hành lại mới đổi được.
        Sửa ở đây là app cập nhật ngay, không cần bản build mới.
      </div>
      {rows.map((row) => {
        const meta = FIELD_META[row.key];
        const multiline = meta?.multiline === true;
        const textareaStyle = { ...inputStyle, minHeight: 108, lineHeight: 1.5, resize: "vertical" as const, fontFamily: "inherit", paddingTop: 10, paddingBottom: 10 };
        const renderField = (
          value: string,
          onChange: (v: string) => void,
          placeholder: string | undefined,
          extraStyle?: CSSProperties,
        ) =>
          multiline ? (
            <textarea
              value={value}
              placeholder={placeholder}
              onChange={(e) => onChange(e.target.value)}
              style={{ ...textareaStyle, ...extraStyle }}
            />
          ) : (
            <input value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} style={{ ...inputStyle, ...extraStyle }} />
          );
        return (
          <div key={row.key} style={{ paddingBottom: 18, marginBottom: 18, borderBottom: "1px solid var(--divider)" }}>
            <FieldLabel>{meta?.label ?? row.key}</FieldLabel>
            {meta?.help ? (
              <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 8 }}>{meta.help}</div>
            ) : null}
            {renderField(row.valueVi, (v) => update(row.key, { valueVi: v }), meta?.placeholder, { marginBottom: meta?.localized ? 10 : 0 })}
            {meta?.localized !== false ? (
              <div style={{ display: "flex", gap: 10 }}>
                <div style={{ flex: 1 }}>
                  <FieldLabel>Bản UK (để trống = dùng bản VN)</FieldLabel>
                  {renderField(row.valueEn, (v) => update(row.key, { valueEn: v }), row.valueVi)}
                </div>
                <div style={{ flex: 1 }}>
                  <FieldLabel>Bản ML (để trống = dùng bản VN)</FieldLabel>
                  {renderField(row.valueMs, (v) => update(row.key, { valueMs: v }), row.valueVi)}
                </div>
              </div>
            ) : null}
          </div>
        );
      })}
    </SectionCard>
  );
}
