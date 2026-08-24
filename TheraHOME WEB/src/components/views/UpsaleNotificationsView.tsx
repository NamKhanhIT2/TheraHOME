"use client";

import { Fragment, useEffect, useState } from "react";
import { cancelUpsellCampaign, createUpsellCampaigns, fetchRoutineProducts, fetchUpsellCampaigns } from "@/lib/db";
import type { UpsellCampaign } from "@/lib/db";
import { Badge, FieldLabel, GhostBtn, inputStyle, PrimaryBtn, SectionCard, PillTabs } from "@/components/ui/primitives";
import { Icon } from "@/components/ui/Icon";
import { Modal } from "@/components/ui/Modal";
import { pushToast } from "@/components/ui/Toast";

const DAY = 24 * 60 * 60 * 1000;

// Language variants are optional per campaign day (unlike roadmap/products)
// — a campaign can target whichever cohorts are ready without blocking on
// translations for the others; dispatch-upsell-campaigns falls back to the
// VN/default title+body for any recipient whose language has no variant.
type LangKey = "vi" | "en" | "ms";
const LANGUAGE_TABS: Array<[LangKey, string]> = [["vi", "VN"], ["en", "EN"], ["ms", "MS"]];
type ScheduleDraft = { id: string; scheduledFor: string; title: string; body: string; titleEn: string; bodyEn: string; titleMs: string; bodyMs: string };

function localDateTime(date: Date) {
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function createScheduleDraft(dayOffset: number, previous?: ScheduleDraft): ScheduleDraft {
  const date = new Date();
  date.setTime(date.getTime() + dayOffset * DAY + 60 * 60 * 1000);
  return {
    id: `${date.getTime()}-${dayOffset}`,
    scheduledFor: localDateTime(date),
    title: previous?.title ?? "",
    body: previous?.body ?? "",
    titleEn: previous?.titleEn ?? "",
    bodyEn: previous?.bodyEn ?? "",
    titleMs: previous?.titleMs ?? "",
    bodyMs: previous?.bodyMs ?? "",
  };
}

function formatDate(date: string) {
  return new Date(date).toLocaleString("vi-VN", { dateStyle: "short", timeStyle: "short" });
}

const STATUS_META: Record<UpsellCampaign["status"], [string, string, string]> = {
  scheduled: ["Đã lên lịch", "#0066AD", "var(--color-primary-tint-10)"],
  processing: ["Đang gửi", "#B9860B", "rgba(185,134,11,0.12)"],
  sent: ["Đã gửi", "#1E9E5E", "rgba(30,158,94,0.12)"],
  cancelled: ["Đã hủy", "#8A93A3", "rgba(138,147,163,0.12)"],
};

const DESTINATION_LABEL: Record<UpsellCampaign["destination"], string> = {
  store: "Cửa hàng",
  home: "Trang chủ",
  roadmap: "Lộ trình",
  community: "Cộng đồng",
};

export function UpsaleNotificationsView() {
  const [campaigns, setCampaigns] = useState<UpsellCampaign[] | null>(null);
  const [targetMeta, setTargetMeta] = useState<Record<string, string>>({ all: "Tất cả người dùng" });
  const [composeOpen, setComposeOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [target, setTarget] = useState("all");
  const [destination, setDestination] = useState<UpsellCampaign["destination"]>("store");
  const [schedules, setSchedules] = useState<ScheduleDraft[]>(() => [createScheduleDraft(1)]);
  const [scheduleLangTab, setScheduleLangTab] = useState<Record<string, LangKey>>({});

  const [scheduleBounds] = useState(() => {
    const now = new Date();
    return { min: localDateTime(now), max: localDateTime(new Date(now.getTime() + 30 * DAY)) };
  });

  function reload() {
    fetchUpsellCampaigns().then(setCampaigns).catch(() => pushToast("Không thể tải lịch Upsale"));
  }
  useEffect(reload, []);
  useEffect(() => {
    fetchRoutineProducts()
      .then((products) => {
        setTargetMeta({
          all: "Tất cả người dùng",
          ...Object.fromEntries(products.map((p) => [p.id, `Người dùng ${p.name.split("·")[1]?.trim() ?? p.name}`])),
        });
      })
      .catch(() => {});
  }, []);

  function resetCompose() {
    setTarget("all");
    setDestination("store");
    setSchedules([createScheduleDraft(1)]);
  }

  async function save() {
    if (!schedules.length || schedules.some((schedule) => !schedule.title.trim() || !schedule.body.trim())) {
      pushToast("Hãy nhập tiêu đề và nội dung cho từng ngày");
      return;
    }
    const parsedSchedules = schedules.map((schedule) => ({ ...schedule, date: new Date(schedule.scheduledFor) }));
    if (parsedSchedules.some((schedule) => Number.isNaN(schedule.date.getTime()) || schedule.date.getTime() < Date.now() - 60_000)) {
      pushToast("Hãy chọn thời điểm gửi ở tương lai");
      return;
    }
    if (parsedSchedules.some((schedule) => schedule.date.getTime() > Date.now() + 30 * DAY)) {
      pushToast("Upsale chỉ được lên lịch tối đa 30 ngày");
      return;
    }
    if (new Set(parsedSchedules.map((schedule) => schedule.scheduledFor)).size !== parsedSchedules.length) {
      pushToast("Mỗi ngày/giờ gửi chỉ nên có một nội dung Upsale");
      return;
    }
    setSaving(true);
    try {
      await createUpsellCampaigns({
        target,
        destination,
        schedules: parsedSchedules.map((schedule) => ({
          title: schedule.title.trim(),
          body: schedule.body.trim(),
          scheduledFor: schedule.date.toISOString(),
          titleEn: schedule.titleEn.trim() || undefined,
          bodyEn: schedule.bodyEn.trim() || undefined,
          titleMs: schedule.titleMs.trim() || undefined,
          bodyMs: schedule.bodyMs.trim() || undefined,
        })),
      });
      setComposeOpen(false);
      resetCompose();
      pushToast(`Đã lên lịch ${schedules.length} thông báo Upsale`);
      reload();
    } catch (error) {
      pushToast(error instanceof Error && error.message.includes("30 days") ? "Upsale chỉ được lên lịch tối đa 30 ngày" : "Không thể tạo lịch Upsale");
    } finally {
      setSaving(false);
    }
  }

  function addSchedule() {
    if (schedules.length >= 30) {
      pushToast("Mỗi đợt Upsale tối đa 30 ngày");
      return;
    }
    setSchedules((current) => {
      const previous = current[current.length - 1];
      const next = createScheduleDraft(current.length + 1, previous);
      return [...current, next];
    });
  }

  function updateSchedule(id: string, patch: Partial<Omit<ScheduleDraft, "id">>) {
    setSchedules((current) => current.map((schedule) => schedule.id === id ? { ...schedule, ...patch } : schedule));
  }

  function removeSchedule(id: string) {
    if (schedules.length === 1) return;
    setSchedules((current) => current.filter((schedule) => schedule.id !== id));
  }

  async function cancel(campaign: UpsellCampaign) {
    try {
      await cancelUpsellCampaign(campaign.id);
      setCampaigns((current) => current?.map((item) => item.id === campaign.id ? { ...item, status: "cancelled" } : item) ?? current);
      pushToast("Đã hủy lịch gửi Upsale");
    } catch {
      pushToast("Không thể hủy lịch gửi");
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 20 }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 700, color: "var(--text-primary)" }}>Upsale</div>
          <div style={{ color: "var(--text-secondary)", fontSize: 13.5, marginTop: 5, maxWidth: 650 }}>
            Chọn tối đa 30 ngày cụ thể, với tiêu đề và nội dung riêng cho từng ngày gửi.
          </div>
        </div>
        <PrimaryBtn icon="plus" onClick={() => setComposeOpen(true)}>Tạo Upsale</PrimaryBtn>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 12 }}>
        <Metric icon="calendar" label="Đã lên lịch" value={campaigns?.filter((item) => item.status === "scheduled").length ?? "—"} color="#0066AD" bg="var(--color-primary-tint-10)" />
        <Metric icon="send" label="Đã gửi" value={campaigns?.filter((item) => item.status === "sent").length ?? "—"} color="#1E9E5E" bg="rgba(30,158,94,0.12)" />
        <Metric icon="users" label="Người nhận đã tiếp cận" value={campaigns ? campaigns.reduce((total, item) => total + item.recipientCount, 0) : "—"} color="#B9860B" bg="rgba(185,134,11,0.12)" />
      </div>

      <SectionCard title="Lịch gửi Upsale" action={<GhostBtn onClick={reload}>Làm mới</GhostBtn>}>
        {campaigns === null ? <div style={{ padding: 20, color: "var(--text-secondary)" }}>Đang tải...</div> : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13.5 }}>
            <thead>
              <tr style={{ textAlign: "left", color: "var(--text-muted)", fontSize: 12, textTransform: "uppercase" }}>
                <th style={{ padding: "0 8px 10px" }}>Nội dung</th>
                <th style={{ padding: "0 8px 10px" }}>Đối tượng</th>
                <th style={{ padding: "0 8px 10px" }}>Mở tại</th>
                <th style={{ padding: "0 8px 10px" }}>Gửi lúc</th>
                <th style={{ padding: "0 8px 10px" }}>Trạng thái</th>
                <th style={{ padding: "0 8px 10px", textAlign: "right" }}> </th>
              </tr>
            </thead>
            <tbody>
              {campaigns.length === 0 ? <tr><td colSpan={6} style={{ padding: "24px 8px", color: "var(--text-muted)" }}>Chưa có Upsale nào được lên lịch.</td></tr> : null}
              {campaigns.map((campaign) => {
                const [label, color, bg] = STATUS_META[campaign.status];
                return <tr key={campaign.id} style={{ borderTop: "1px solid var(--divider)" }}>
                  <td style={{ padding: "12px 8px", maxWidth: 420 }}>
                    <div style={{ color: "var(--text-primary)", fontWeight: 700 }}>{campaign.title}</div>
                    <div style={{ color: "var(--text-secondary)", fontSize: 12.5, marginTop: 3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{campaign.body}</div>
                  </td>
                  <td style={{ padding: "12px 8px", color: "var(--text-secondary)" }}>{targetMeta[campaign.target] ?? "Lộ trình đã chọn"}</td>
                  <td style={{ padding: "12px 8px", color: "var(--text-secondary)" }}>{DESTINATION_LABEL[campaign.destination]}</td>
                  <td style={{ padding: "12px 8px", color: "var(--text-secondary)", whiteSpace: "nowrap" }}>{formatDate(campaign.scheduledFor)}</td>
                  <td style={{ padding: "12px 8px" }}>
                    <Badge color={color} bg={bg}>{label}{campaign.status === "sent" ? ` · ${campaign.recipientCount}` : ""}</Badge>
                  </td>
                  <td style={{ padding: "12px 8px", textAlign: "right" }}>
                    {campaign.status === "scheduled" ? <GhostBtn onClick={() => cancel(campaign)} color="var(--error)">Hủy lịch</GhostBtn> : null}
                  </td>
                </tr>;
              })}
            </tbody>
          </table>
        )}
      </SectionCard>

      {composeOpen ? <Modal
        title="Tạo lịch Upsale"
        width={620}
        onClose={() => setComposeOpen(false)}
        footer={<Fragment><GhostBtn onClick={() => setComposeOpen(false)}>Hủy</GhostBtn><PrimaryBtn onClick={save} disabled={saving}>{saving ? "Đang lưu..." : `Lên lịch ${schedules.length} ngày`}</PrimaryBtn></Fragment>}
      >
        <div style={{ display: "flex", alignItems: "flex-start", gap: 9, background: "var(--color-primary-tint-10)", padding: "10px 12px", borderRadius: 10, color: "var(--color-primary)", fontSize: 12.5, lineHeight: 1.45, marginBottom: 16 }}>
          <Icon name="megaphone" size={17} color="var(--color-primary)" />
          <span>Mỗi ngày là một thông báo độc lập. Bạn có thể dùng nội dung khác nhau cho từng ngày, trong giới hạn 30 ngày kể từ hiện tại.</span>
        </div>
        <FieldLabel>Đối tượng nhận</FieldLabel>
        <select value={target} onChange={(event) => setTarget(event.target.value)} style={{ ...inputStyle, marginBottom: 14 }}>
          {Object.entries(targetMeta).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
        </select>
        <FieldLabel>Khi người dùng bấm thông báo, mở tại</FieldLabel>
        <select value={destination} onChange={(event) => setDestination(event.target.value as UpsellCampaign["destination"])} style={{ ...inputStyle, marginBottom: 14 }}>
          {Object.entries(DESTINATION_LABEL).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
        </select>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {schedules.map((schedule, index) => <div key={schedule.id} style={{ border: "1px solid var(--divider)", background: "var(--bg-card-alt)", padding: 14, borderRadius: 12 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)" }}>Ngày gửi {index + 1}</div>
              {schedules.length > 1 ? <button onClick={() => removeSchedule(schedule.id)} aria-label={`Xóa ngày gửi ${index + 1}`} style={{ border: "none", background: "none", color: "var(--error)", cursor: "pointer", display: "inline-flex", padding: 3 }}><Icon name="trash-2" size={16} color="var(--error)" /></button> : null}
            </div>
            <FieldLabel>Ngày và giờ</FieldLabel>
            <input type="datetime-local" min={scheduleBounds.min} max={scheduleBounds.max} value={schedule.scheduledFor} onChange={(event) => updateSchedule(schedule.id, { scheduledFor: event.target.value })} style={{ ...inputStyle, marginBottom: 12 }} />
            <PillTabs options={LANGUAGE_TABS} value={scheduleLangTab[schedule.id] ?? "vi"} onChange={(lang) => setScheduleLangTab((current) => ({ ...current, [schedule.id]: lang }))} />
            {(() => {
              const lang = scheduleLangTab[schedule.id] ?? "vi";
              const titleKey = lang === "vi" ? "title" : lang === "en" ? "titleEn" : "titleMs";
              const bodyKey = lang === "vi" ? "body" : lang === "en" ? "bodyEn" : "bodyMs";
              return (
                <Fragment>
                  <FieldLabel>Tiêu đề {lang !== "vi" ? "(tùy chọn)" : ""}</FieldLabel>
                  <input value={schedule[titleKey]} maxLength={120} onChange={(event) => updateSchedule(schedule.id, { [titleKey]: event.target.value })} placeholder="Ví dụ: Ưu đãi riêng cho hành trình của bạn" style={{ ...inputStyle, marginBottom: 12 }} />
                  <FieldLabel>Nội dung {lang !== "vi" ? "(tùy chọn)" : ""}</FieldLabel>
                  <textarea value={schedule[bodyKey]} maxLength={500} onChange={(event) => updateSchedule(schedule.id, { [bodyKey]: event.target.value })} placeholder="Ví dụ: Khám phá lộ trình mới phù hợp để duy trì việc tập luyện." style={{ ...inputStyle, minHeight: 68, resize: "vertical" }} />
                </Fragment>
              );
            })()}
          </div>)}
        </div>
        <div style={{ marginTop: 12 }}><GhostBtn onClick={addSchedule}>+ Thêm ngày khác</GhostBtn></div>
      </Modal> : null}
    </div>
  );
}

function Metric({ icon, label, value, color, bg }: { icon: string; label: string; value: number | string; color: string; bg: string }) {
  return <div style={{ background: "#fff", borderRadius: 14, boxShadow: "var(--shadow-card)", padding: "15px 16px", display: "flex", alignItems: "center", gap: 12 }}>
    <div style={{ width: 38, height: 38, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 11, background: bg }}><Icon name={icon} size={18} color={color} /></div>
    <div><div style={{ fontWeight: 700, fontSize: 19, color: "var(--text-primary)" }}>{value}</div><div style={{ color: "var(--text-secondary)", fontSize: 12 }}>{label}</div></div>
  </div>;
}
