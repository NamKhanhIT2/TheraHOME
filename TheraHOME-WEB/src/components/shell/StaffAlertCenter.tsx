"use client";

// The bell in the console header, made real.
//
// It was drawn by the design mock and ported as a static icon: no count, no
// panel, no data. Everything it should have been announcing was happening
// anyway — a customer messaging, a clip arriving to be graded, somebody
// buying a plan — and reached a person only by luck. Chat raised a browser
// notification, but ONLY while the Chat tab was the open one, so a shift
// spent on Kích hoạt heard nothing at all; subscriptions raised nothing
// anywhere.
//
// So this is mounted in the shell rather than in a view: the whole point is
// that it keeps working while somebody is looking at a different tab. It
// reads `staff_alerts`, which is one open row per thing waiting on a human
// (see 202610131500) — not one per event, so a customer who sends six
// messages is one line here with a 6 beside it, and answering closes it
// without anyone pressing anything.
import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { fetchOpenStaffAlerts, fetchStaffAlert, handleStaffAlert, type StaffAlert, type StaffAlertKind } from "@/lib/db";
import { Icon } from "@/components/ui/Icon";
import { pushToast } from "@/components/ui/Toast";

/** Which nav tab answers each kind of alert. */
const TAB_FOR: Record<StaffAlertKind, string> = {
  chat: "chat",
  form_review: "chat",
  subscription: "subscription-plans",
  subscription_refund: "subscription-plans",
};

const ICON_FOR: Record<StaffAlertKind, string> = {
  chat: "message-circle",
  form_review: "film",
  subscription: "star",
  subscription_refund: "triangle-alert",
};

const LABEL_FOR: Record<StaffAlertKind, string> = {
  chat: "Tin nhắn",
  form_review: "Chấm dáng tập",
  subscription: "Đăng ký gói",
  subscription_refund: "Hoàn tiền",
};

/** A short two-tone chime, synthesised rather than shipped as a file: no
 * asset to 404, and no autoplay policy to fight because it only ever plays
 * after the staffer has clicked something in this page at least once. A
 * blocked AudioContext throws, which is why every call is wrapped — the
 * notification is the part that matters and must not be lost to a sound. */
function chime() {
  try {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    const ctx = new Ctor();
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.18, ctx.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.5);
    gain.connect(ctx.destination);
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.frequency.setValueAtTime(1175, ctx.currentTime + 0.12);
    osc.connect(gain);
    osc.start();
    osc.stop(ctx.currentTime + 0.52);
    osc.onended = () => void ctx.close();
  } catch {
    /* a console with no sound is still a console */
  }
}

function timeAgo(iso: string): string {
  const seconds = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (seconds < 60) return "vừa xong";
  if (seconds < 3600) return `${Math.floor(seconds / 60)} phút trước`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} giờ trước`;
  return `${Math.floor(seconds / 86400)} ngày trước`;
}

export function StaffAlertCenter({ activeTab, navIds, onOpenTab }: {
  activeTab: string;
  /** Tab ids this surface actually has. CSKH has no "Gói đăng ký", so a
   * subscription alert there is readable but must not navigate anywhere —
   * setting an id the shell cannot render would blank the page. */
  navIds: string[];
  onOpenTab: (id: string) => void;
}) {
  const [alerts, setAlerts] = useState<StaffAlert[]>([]);
  const [open, setOpen] = useState(false);
  const [canAskNotify, setCanAskNotify] = useState(false);
  // Read inside the Realtime callback, which is created once and would
  // otherwise close over the first render's value for the rest of the shift.
  //
  // Refs rather than effect dependencies for all three: `navIds` is a fresh
  // array every render, so listing it as a dependency would tear down and
  // rebuild the websocket subscription on every render — a channel that
  // never settles long enough to deliver anything.
  //
  // Synced in an effect, not assigned during render: writing a ref while
  // rendering is a side effect in the render phase, which React's lint rule
  // rejects and Strict Mode can run twice.
  const activeTabRef = useRef(activeTab);
  const navIdsRef = useRef(navIds);
  const onOpenTabRef = useRef(onOpenTab);
  useEffect(() => {
    activeTabRef.current = activeTab;
    navIdsRef.current = navIds;
    onOpenTabRef.current = onOpenTab;
  });

  const reload = useCallback(() => {
    fetchOpenStaffAlerts()
      .then(setAlerts)
      // A staffer whose roles have not resolved yet reads zero rows rather
      // than an error; anything else is worth a line in the console but not
      // a toast on every shift.
      .catch((e) => console.warn("staff alerts:", e));
  }, []);

  useEffect(() => { reload(); }, [reload]);

  // Subscribed to rather than read once, the same way ChatView does it: the
  // Permissions API fires onchange when the staffer grants or blocks
  // notifications in browser settings, so the offer disappears the moment it
  // stops being the right thing to show. Safari has no permissions.query for
  // notifications, hence the fallback read.
  useEffect(() => {
    if (typeof Notification === "undefined") return;
    let cancelled = false;
    let status: PermissionStatus | null = null;
    const apply = () => { if (!cancelled) setCanAskNotify(Notification.permission === "default"); };
    const query = navigator.permissions?.query?.({ name: "notifications" as PermissionName });
    if (query) {
      query.then((s) => { status = s; s.onchange = apply; apply(); }).catch(apply);
    } else {
      queueMicrotask(apply);
    }
    return () => { cancelled = true; if (status) status.onchange = null; };
  }, []);

  useEffect(() => {
    const channel = supabase
      .channel("staff-alerts")
      .on("postgres_changes", { event: "*", schema: "public", table: "staff_alerts" }, (payload) => {
        reload();
        const row = (payload.new ?? {}) as { id?: string; handled_at?: string | null };
        // An UPDATE that sets handled_at is somebody finishing the job —
        // announcing that would ring the bell for work that just stopped
        // existing.
        if (!row.id || row.handled_at) return;
        void announce(row.id);
      })
      .subscribe();
    return () => { void supabase.removeChannel(channel); };

    async function announce(id: string) {
      const alert = await fetchStaffAlert(id).catch(() => null);
      if (!alert) return;
      // The Chat tab already raises its own per-thread notification and is
      // showing the message. Two notifications for one message is worse
      // than one.
      if (alert.kind === "chat" && activeTabRef.current === "chat" && document.visibilityState === "visible") return;
      chime();
      if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
      const n = new Notification(alert.title, {
        body: alert.body ?? LABEL_FOR[alert.kind],
        tag: alert.id,
        icon: "/landing/logo.png",
      });
      n.onclick = () => {
        window.focus();
        const tab = TAB_FOR[alert.kind];
        if (navIdsRef.current.includes(tab)) onOpenTabRef.current(tab);
        n.close();
      };
    }
  }, [reload]);

  async function askNotifyPermission() {
    if (typeof Notification === "undefined") return;
    const result = await Notification.requestPermission();
    setCanAskNotify(result === "default");
    if (result === "denied") pushToast("Trình duyệt đã chặn thông báo cho trang này");
  }

  async function dismiss(id: string) {
    // Optimistic: the row is gone from the queue the moment it is pressed,
    // and Realtime confirms it a beat later.
    setAlerts((current) => current.filter((a) => a.id !== id));
    try {
      await handleStaffAlert(id);
    } catch {
      pushToast("Không đánh dấu được, thử lại nhé");
      reload();
    }
  }

  function openAlert(alert: StaffAlert) {
    const tab = TAB_FOR[alert.kind];
    if (navIds.includes(tab)) onOpenTab(tab);
    setOpen(false);
  }

  const count = alerts.length;

  return (
    <div style={{ position: "relative" }}>
      <button
        onClick={() => setOpen((v) => !v)}
        title={count > 0 ? `${count} việc đang chờ` : "Không có việc nào đang chờ"}
        aria-label={count > 0 ? `${count} việc đang chờ` : "Không có việc nào đang chờ"}
        style={{
          position: "relative", width: 38, height: 38, borderRadius: 10, background: "#fff",
          border: "1px solid var(--border-input)", display: "flex", alignItems: "center",
          justifyContent: "center", cursor: "pointer", padding: 0,
        }}
      >
        <Icon name="bell" size={16} color={count > 0 ? "var(--color-primary)" : "var(--text-secondary)"} />
        {count > 0 && (
          <span style={{
            position: "absolute", top: -5, right: -5, minWidth: 18, height: 18, padding: "0 5px",
            borderRadius: 999, background: "var(--error)", color: "#fff", fontSize: 11, fontWeight: 700,
            display: "flex", alignItems: "center", justifyContent: "center", border: "2px solid #fff",
          }}>
            {count > 99 ? "99+" : count}
          </span>
        )}
      </button>

      {open && (
        <>
          {/* Click-away. A fixed sheet behind the panel rather than a document
              listener: no listener to leak, and it cannot race the button's
              own onClick into closing and reopening. */}
          <div onClick={() => setOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 40 }} />
          <div style={{
            position: "absolute", top: 46, right: 0, width: 360, maxHeight: 460, overflowY: "auto",
            background: "#fff", border: "1px solid var(--divider)", borderRadius: 14,
            boxShadow: "0 18px 50px rgba(15,23,42,0.16)", zIndex: 41, padding: 8,
          }}>
            <div style={{ padding: "8px 10px 10px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)" }}>Việc đang chờ</div>
              <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{count} mục</div>
            </div>

            {canAskNotify && (
              <button
                onClick={askNotifyPermission}
                style={{
                  width: "100%", textAlign: "left", marginBottom: 6, padding: "10px 12px", borderRadius: 10,
                  border: "1px dashed var(--color-primary)", background: "var(--color-primary-tint-10)",
                  color: "var(--color-primary)", fontFamily: "var(--font-family)", fontSize: 12.5,
                  fontWeight: 600, cursor: "pointer",
                }}
              >
                Bật thông báo trình duyệt để nghe cả khi đang ở tab khác
              </button>
            )}

            {count === 0 && (
              <div style={{ padding: "22px 12px", textAlign: "center", fontSize: 13, color: "var(--text-muted)" }}>
                Không có việc nào đang chờ.
              </div>
            )}

            {alerts.map((alert) => (
              <div
                key={alert.id}
                style={{
                  display: "flex", gap: 10, alignItems: "flex-start", padding: "10px 10px",
                  borderRadius: 10, borderBottom: "1px solid var(--divider)",
                }}
              >
                <div style={{
                  width: 30, height: 30, borderRadius: 9, flexShrink: 0, display: "flex",
                  alignItems: "center", justifyContent: "center",
                  background: alert.kind === "subscription_refund" ? "var(--error-tint)" : "var(--color-primary-tint-10)",
                }}>
                  <Icon
                    name={ICON_FOR[alert.kind]}
                    size={15}
                    color={alert.kind === "subscription_refund" ? "var(--error)" : "var(--color-primary)"}
                  />
                </div>
                <button
                  onClick={() => openAlert(alert)}
                  style={{ flex: 1, minWidth: 0, textAlign: "left", border: "none", background: "none", padding: 0, cursor: "pointer", fontFamily: "var(--font-family)" }}
                >
                  <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)" }}>
                    {alert.title}
                    {alert.eventCount > 1 && (
                      <span style={{ marginLeft: 6, fontSize: 11, fontWeight: 700, color: "var(--color-primary)" }}>
                        ×{alert.eventCount}
                      </span>
                    )}
                  </div>
                  {alert.body && (
                    <div style={{ fontSize: 12, color: "var(--text-secondary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {alert.body}
                    </div>
                  )}
                  <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>
                    {LABEL_FOR[alert.kind]} · {timeAgo(alert.lastEventAt)}
                  </div>
                </button>
                <button
                  onClick={() => dismiss(alert.id)}
                  title="Đánh dấu đã xử lý"
                  aria-label="Đánh dấu đã xử lý"
                  style={{ border: "none", background: "none", cursor: "pointer", padding: 4, color: "var(--text-muted)" }}
                >
                  <Icon name="check" size={15} color="currentColor" />
                </button>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
