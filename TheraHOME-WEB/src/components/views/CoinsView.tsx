"use client";

// "Xu & quà tặng" — who is earning, and whose parcel is waiting.
//
// The gift is the only thing on this screen that is work: a customer reached
// the threshold, asked for it, and is now waiting on a human to check who
// they are and post it. Everything else is context for that decision, which
// is why the list sorts claims to the top rather than sorting by balance.
import { useCallback, useEffect, useState } from "react";
import { SectionCard, PrimaryBtn, GhostBtn, Badge } from "@/components/ui/primitives";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { pushToast } from "@/components/ui/Toast";
import { errorMessage } from "@/lib/errorMessage";
import { fetchCoinHolders, fetchCoinSettings, fulfilCoinGift, type CoinHolder, type CoinSettings } from "@/lib/db";

function dateVn(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export function CoinsView() {
  const [holders, setHolders] = useState<CoinHolder[] | null>(null);
  const [settings, setSettings] = useState<CoinSettings | null>(null);
  const [sending, setSending] = useState<CoinHolder | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(() => {
    fetchCoinHolders().then(setHolders).catch(() => setHolders([]));
    fetchCoinSettings().then(setSettings).catch(() => setSettings(null));
  }, []);
  useEffect(() => { load(); }, [load]);

  async function send(holder: CoinHolder) {
    setBusy(holder.userId);
    try {
      await fulfilCoinGift(holder.userId);
      pushToast("Đã đánh dấu gửi quà");
      setSending(null);
      load();
    } catch (e) {
      pushToast(errorMessage(e) || "Không đánh dấu được");
    } finally {
      setBusy(null);
    }
  }

  const waiting = (holders ?? []).filter((h) => h.giftClaimedAt && !h.giftFulfilledAt).length;

  return (
    <SectionCard title="Xu & quà tặng">
      {/* The rules, read from coin_settings rather than written here, so the
          console cannot describe a programme different from the one the app
          is running. */}
      {settings ? (
        <div style={{ marginBottom: 12, fontSize: 12.5, color: "var(--text-muted)" }}>
          {settings.coinsPerDay} xu mỗi ngày tập · mốc {settings.streakMilestones.join(" và ")} ngày thêm{" "}
          {settings.coinsPerStreak} xu · đủ {settings.giftThreshold} xu nhận quà · dành cho{" "}
          {settings.planCodes.join(", ")}
          {settings.active ? null : " · ĐANG TẮT"}
        </div>
      ) : null}
      {waiting > 0 ? (
        <div style={{
          marginBottom: 12, padding: "10px 14px", borderRadius: 10,
          background: "var(--color-primary-tint-10)", color: "var(--color-primary)",
          fontSize: 13, fontWeight: 700,
        }}>
          {waiting} khách đang chờ nhận quà
        </div>
      ) : null}

      {holders === null ? (
        <div style={{ padding: 16, color: "var(--text-secondary)", fontSize: 13 }}>Đang tải...</div>
      ) : holders.length === 0 ? (
        <div style={{ padding: 16, color: "var(--text-muted)", fontSize: 13 }}>
          Chưa có ai tích xu. Khách cần đang dùng gói Premium Plus trở lên và hoàn thành ngày tập.
        </div>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ textAlign: "left", color: "var(--text-muted)", fontSize: 12 }}>
                <th style={{ padding: "8px 10px", fontWeight: 600 }}>Khách hàng</th>
                <th style={{ padding: "8px 10px", fontWeight: 600 }}>Xu</th>
                <th style={{ padding: "8px 10px", fontWeight: 600 }}>Nguồn xu</th>
                <th style={{ padding: "8px 10px", fontWeight: 600 }}>Gói</th>
                <th style={{ padding: "8px 10px", fontWeight: 600 }}>Quà</th>
                <th style={{ padding: "8px 10px", fontWeight: 600 }}>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {holders.map((holder) => (
                <tr key={holder.userId} style={{ borderTop: "1px solid var(--divider)" }}>
                  <td style={{ padding: "10px", maxWidth: 220 }}>
                    <div style={{ fontWeight: 600, color: "var(--text-primary)" }}>{holder.fullName || "Chưa đặt tên"}</div>
                    {/* The contact CSKH checks before posting anything. */}
                    <div style={{ fontSize: 11.5, color: "var(--text-muted)" }}>
                      {holder.phone || holder.email || holder.userId}
                    </div>
                  </td>
                  <td style={{ padding: "10px", fontWeight: 700, color: "var(--color-primary)" }}>{holder.balance}</td>
                  <td style={{ padding: "10px", color: "var(--text-secondary)", whiteSpace: "nowrap" }}>
                    {holder.daysClaimed} ngày · {holder.streakClaimed} mốc
                    <div style={{ fontSize: 11.5, color: "var(--text-muted)" }}>gần nhất {dateVn(holder.lastEarnedAt)}</div>
                  </td>
                  <td style={{ padding: "10px", color: "var(--text-secondary)" }}>{holder.planCode || "—"}</td>
                  <td style={{ padding: "10px" }}>
                    {holder.giftFulfilledAt ? (
                      <Badge color="#1E9E5E" bg="rgba(30,158,94,0.12)">Đã gửi {dateVn(holder.giftFulfilledAt)}</Badge>
                    ) : holder.giftClaimedAt ? (
                      <Badge color="#B8740E" bg="rgba(184,116,14,0.12)">Chờ gửi</Badge>
                    ) : (
                      <span style={{ fontSize: 12, color: "var(--text-muted)" }}>chưa yêu cầu</span>
                    )}
                  </td>
                  <td style={{ padding: "10px" }}>
                    {holder.giftClaimedAt && !holder.giftFulfilledAt ? (
                      <GhostBtn onClick={() => setSending(holder)} disabled={busy === holder.userId}>
                        Đã gửi quà
                      </GhostBtn>
                    ) : (
                      <span style={{ fontSize: 12, color: "var(--text-muted)" }}>—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {sending ? (
        <ConfirmModal
          title="Xác nhận đã gửi quà"
          confirmLabel={busy === sending.userId ? "Đang lưu..." : "Đã gửi"}
          busy={busy === sending.userId}
          onCancel={() => setSending(null)}
          onConfirm={() => send(sending)}
          message={
            <div style={{ lineHeight: 1.6 }}>
              Đánh dấu đã gửi phần quà cho <b style={{ color: "var(--text-primary)" }}>{sending.fullName || sending.phone || "khách hàng"}</b>?
              <div style={{ marginTop: 10 }}>
                Khách sẽ nhận được thông báo trong app, và mục này sẽ rời khỏi danh sách việc cần làm.
                {/* Said because the database enforces it and support should not
                    have to find out by trying. */}
                <b> Mỗi khách chỉ nhận quà một lần</b>, nên thao tác này không lặp lại được.
              </div>
            </div>
          }
        />
      ) : null}
    </SectionCard>
  );
}
