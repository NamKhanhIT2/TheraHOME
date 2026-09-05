"use client";

// Delivery belongs to the system: staff maintain the copy only. Official
// posts publish from Community and Upsale campaigns publish from Upsale.
import { Fragment, useEffect, useState } from "react";
import { fetchSystemNotificationTemplates, saveSystemNotificationTemplate } from "@/lib/db";
import type { SystemNotificationTemplate, SystemNotificationTemplateKey, NotificationLanguage } from "@/lib/db";
import { Badge, FieldLabel, GhostBtn, inputStyle, PrimaryBtn, SectionCard, PillTabs } from "@/components/ui/primitives";
import { Modal } from "@/components/ui/Modal";
import { Icon } from "@/components/ui/Icon";
import { pushToast } from "@/components/ui/Toast";
import { translateDrafts } from "@/lib/translate";

const META: Record<SystemNotificationTemplateKey, { label: string; description: string; icon: string; color: string; bg: string }> = {
  daily_workout: { label: "Lịch tập hằng ngày", description: "Hệ thống gửi theo giờ người dùng chọn; bấm mở Lộ trình hôm nay.", icon: "calendar", color: "#0066AD", bg: "var(--color-primary-tint-10)" },
  evening_reminder: { label: "Nhắc thư giãn buổi tối", description: "Hệ thống gửi theo giờ nhắc buổi tối do người dùng chọn.", icon: "moon", color: "#6C54B5", bg: "rgba(108,84,181,0.12)" },
  inactive_2: { label: "Không hoạt động 2 ngày — Nhắc nhẹ", description: "Hệ thống tự gửi sau 2 ngày; bấm mở Trang chủ.", icon: "activity", color: "#B9860B", bg: "rgba(185,134,11,0.12)" },
  inactive_3: { label: "Không hoạt động 3 ngày — Tạo cảm giác được nhớ đến", description: "Hệ thống tự gửi sau 3 ngày; bấm mở Trang chủ.", icon: "activity", color: "#B9860B", bg: "rgba(185,134,11,0.12)" },
  inactive_4: { label: "Không hoạt động 4 ngày — Giảm rào cản", description: "Hệ thống tự gửi sau 4 ngày; bấm mở Trang chủ.", icon: "activity", color: "#B9860B", bg: "rgba(185,134,11,0.12)" },
  inactive_5: { label: "Không hoạt động 5 ngày — Nhắc về hành trình", description: "Hệ thống tự gửi sau 5 ngày; bấm mở Trang chủ.", icon: "activity", color: "#B9860B", bg: "rgba(185,134,11,0.12)" },
  inactive_7: { label: "Không hoạt động 7 ngày — Tái kích hoạt", description: "Hệ thống tự gửi sau 7 ngày; bấm mở Trang chủ.", icon: "activity", color: "#B9860B", bg: "rgba(185,134,11,0.12)" },
  inactive_10: { label: "Không hoạt động 10 ngày — Cá nhân hóa lại", description: "Hệ thống tự gửi sau 10 ngày; bấm mở Trang chủ.", icon: "activity", color: "#B9860B", bg: "rgba(185,134,11,0.12)" },
  inactive_14: { label: "Không hoạt động 14 ngày — Win-back nhẹ nhàng", description: "Hệ thống tự gửi sau 14 ngày; bấm mở Trang chủ.", icon: "activity", color: "#B9860B", bg: "rgba(185,134,11,0.12)" },
};
const ORDER = Object.keys(META) as SystemNotificationTemplateKey[];
const LANGUAGE_TABS: Array<[NotificationLanguage, string]> = [["vi", "VN"], ["en", "EN"], ["ms", "MS"]];

export function NotificationsAdminView() {
  const [templates, setTemplates] = useState<SystemNotificationTemplate[] | null>(null);
  const [editing, setEditing] = useState<SystemNotificationTemplateKey | null>(null);
  const [languageTab, setLanguageTab] = useState<NotificationLanguage>("vi");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [saving, setSaving] = useState(false);
  const [translating, setTranslating] = useState(false);

  function reload() {
    fetchSystemNotificationTemplates().then(setTemplates).catch(() => pushToast("Không thể tải mẫu thông báo hệ thống"));
  }
  useEffect(reload, []);

  const byKey = new Map((templates ?? []).map((template) => [template.templateKey, template]));

  function openEdit(templateKey: SystemNotificationTemplateKey) {
    setEditing(templateKey);
    setLanguageTab("vi");
    const copy = byKey.get(templateKey)?.byLanguage.vi;
    setTitle(copy?.title ?? "");
    setBody(copy?.body ?? "");
  }
  function switchLanguageTab(language: NotificationLanguage) {
    setLanguageTab(language);
    const copy = editing ? byKey.get(editing)?.byLanguage[language] : undefined;
    setTitle(copy?.title ?? "");
    setBody(copy?.body ?? "");
  }
  /** Fills the EN/MS tab from the saved VN copy. The modal edits one language
   * at a time, so this is a button rather than a save-time step; {{day}} /
   * {{days}} placeholders are preserved by the translator prompt. */
  async function translateFromVi() {
    if (!editing || languageTab === "vi") return;
    const source = byKey.get(editing)?.byLanguage.vi;
    if (!source?.title?.trim() || !source?.body?.trim()) {
      pushToast("Cần có bản VN đầy đủ trước khi dịch");
      return;
    }
    setTranslating(true);
    try {
      const drafts = await translateDrafts({ title: source.title, body: source.body });
      if (!drafts) {
        pushToast("Không dịch được lúc này — thử lại sau hoặc nhập tay");
        return;
      }
      const picked = drafts[languageTab];
      setTitle(picked.title || source.title);
      setBody(picked.body || source.body);
      pushToast("Đã điền bản nháp — kiểm tra lại rồi bấm Lưu");
    } finally {
      setTranslating(false);
    }
  }

  async function save() {
    if (!editing || !title.trim() || !body.trim()) return;
    setSaving(true);
    try {
      await saveSystemNotificationTemplate({ templateKey: editing, language: languageTab, title: title.trim(), body: body.trim() });
      setTemplates((current) =>
        current?.map((item) =>
          item.templateKey === editing
            ? { ...item, byLanguage: { ...item.byLanguage, [languageTab]: { title: title.trim(), body: body.trim(), updatedAt: new Date().toISOString() } } }
            : item
        ) ?? current
      );
      pushToast("Đã cập nhật nội dung hệ thống");
    } catch {
      pushToast("Không thể lưu nội dung thông báo");
    } finally {
      setSaving(false);
    }
  }

  return <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
    <div style={{ background: "var(--color-primary-tint-10)", borderRadius: 14, padding: "14px 16px", display: "flex", gap: 10, alignItems: "flex-start", color: "var(--color-primary)" }}>
      <Icon name="bell" size={19} color="var(--color-primary)" />
      <div style={{ fontSize: 13.5, lineHeight: 1.5 }}><b>Nội dung do hệ thống gửi tự động.</b><br />Lịch tập và nhắc quay lại lấy mẫu bên dưới, theo ngôn ngữ của người nhận (thiếu bản dịch sẽ dùng bản VN). Chat/Cộng đồng là realtime; bài viết và Upsale được tạo đúng ở mục Cộng đồng/Upsale rồi hệ thống tự push.</div>
    </div>
    <SectionCard title="Mẫu thông báo hệ thống">
      {templates === null ? <div style={{ padding: 20, color: "var(--text-secondary)" }}>Đang tải...</div> : <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {ORDER.map((key) => {
          const template = byKey.get(key); const meta = META[key]; if (!template) return null;
          const viCopy = template.byLanguage.vi;
          const filledCount = LANGUAGE_TABS.filter(([lang]) => template.byLanguage[lang]).length;
          return <div key={key} style={{ display: "flex", gap: 12, padding: 14, border: "1px solid var(--divider)", borderRadius: 12, alignItems: "flex-start" }}>
            <div style={{ width: 40, height: 40, borderRadius: 12, background: meta.bg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><Icon name={meta.icon} size={18} color={meta.color} /></div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <b style={{ color: "var(--text-primary)", fontSize: 14 }}>{meta.label}</b>
                <Badge color={meta.color} bg={meta.bg}>Tự động</Badge>
                <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{filledCount}/3 ngôn ngữ</span>
              </div>
              <div style={{ color: "var(--text-muted)", fontSize: 12.5, lineHeight: 1.4, marginTop: 4 }}>{meta.description}</div>
              <div style={{ color: "var(--text-primary)", fontWeight: 600, fontSize: 13.5, marginTop: 10 }}>{viCopy?.title ?? "(Chưa có bản VN)"}</div>
              <div style={{ color: "var(--text-secondary)", fontSize: 12.5, marginTop: 3 }}>{viCopy?.body ?? ""}</div>
            </div>
            <GhostBtn onClick={() => openEdit(key)}>Chỉnh sửa</GhostBtn>
          </div>;
        })}
      </div>}
    </SectionCard>
    {editing ? <Modal title={`Sửa mẫu · ${META[editing].label}`} onClose={() => setEditing(null)} width={500} footer={<Fragment><GhostBtn onClick={() => setEditing(null)}>Hủy</GhostBtn><PrimaryBtn onClick={save} disabled={saving || !title.trim() || !body.trim()}>{saving ? "Đang lưu..." : "Lưu thay đổi"}</PrimaryBtn></Fragment>}>
      <PillTabs options={LANGUAGE_TABS} value={languageTab} onChange={switchLanguageTab} />
      {languageTab !== "vi" ? (
        <div style={{ marginTop: 10, marginBottom: 4 }}>
          <GhostBtn onClick={translateFromVi} disabled={translating}>
            {translating ? "Đang dịch..." : "Dịch từ bản VN"}
          </GhostBtn>
        </div>
      ) : null}
      <FieldLabel>Tiêu đề</FieldLabel><input value={title} maxLength={120} onChange={(event) => setTitle(event.target.value)} style={{ ...inputStyle, marginBottom: 14 }} />
      <FieldLabel>Nội dung</FieldLabel><textarea value={body} maxLength={500} onChange={(event) => setBody(event.target.value)} style={{ ...inputStyle, minHeight: 78, resize: "vertical", marginBottom: 8 }} />
      <div style={{ color: "var(--text-muted)", fontSize: 12 }}>Dùng <code>{"{{day}}"}</code> cho ngày lộ trình và <code>{"{{days}}"}</code> cho số ngày không hoạt động.</div>
    </Modal> : null}
  </div>;
}
