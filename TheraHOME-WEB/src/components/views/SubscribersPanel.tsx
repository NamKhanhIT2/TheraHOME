"use client";

// The subscriber table, shared by two surfaces.
//
// Admin reads it inside "Gói đăng ký" next to the plan editor and the money
// panel, and can grant or revoke. CSKH gets the same table on its own tab
// and nothing else: a specialist on a support call needs to see what the
// customer in front of them actually holds, and that is the whole of it.
// Owner 2026-10-13.
//
// Read-only there is enforced by the database, not by this file —
// `admin_grant_subscription` and `admin_revoke_subscription` both raise
// `admin_required`. `canManage` only decides what is worth drawing, because
// a button that always fails is worse than no button at all.
import { Fragment, useCallback, useEffect, useState } from "react";
import { SectionCard } from "@/components/ui/primitives";
import { Modal } from "@/components/ui/Modal";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { PrimaryBtn, GhostBtn, Badge, FieldLabel } from "@/components/ui/primitives";
import { pushToast } from "@/components/ui/Toast";
import { errorMessage } from "@/lib/errorMessage";
import {
  fetchSubscriptionHolders,
  grantSubscription,
  revokeSubscription,
  searchCustomers,
  type SubscriptionHolder,
  type SubscriptionPlanAdmin,
} from "@/lib/db";

// ---------------------------------------------------------------------------
// Who actually holds a plan
// ---------------------------------------------------------------------------
//
// The panel above answers "is this working": totals, holders, money. It
// cannot answer the question support actually gets — "I paid and the app
// says I didn't" — because that needs one named customer's row, with the
// store's own identifier beside it to check against App Store Connect.
//
// `is_live` is computed by the RPC with the same test the app applies, not
// read off `status`: a subscription whose period ended yesterday still says
// 'active' in that column, and it is exactly that discrepancy somebody is
// here to find.

function statusOf(holder: SubscriptionHolder): { label: string; color: string; bg: string } {
  if (holder.revokedAt) return { label: "Đã hoàn tiền", color: "var(--error)", bg: "var(--error-tint)" };
  if (holder.isLive) return { label: "Đang dùng", color: "#1E9E5E", bg: "rgba(30,158,94,0.12)" };
  return { label: "Hết hạn", color: "#8A93A3", bg: "rgba(138,147,163,0.12)" };
}

const SOURCE_LABEL: Record<string, string> = { ios: "App Store", android: "Google Play", manual: "Cấp thủ công" };

function dateVn(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export function SubscribersPanel({ plans = [], canManage, onChanged }: {
  /** Only needed to populate the grant dialog, so CSKH passes nothing. */
  plans?: SubscriptionPlanAdmin[];
  /** Admin grants and revokes; CSKH reads. The RPCs enforce this themselves
   * (`admin_required`), so this flag only decides what is worth drawing —
   * a button that always fails is worse than no button. */
  canManage: boolean;
  onChanged?: () => void;
}) {
  const [holders, setHolders] = useState<SubscriptionHolder[] | null>(null);
  const [granting, setGranting] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [revoking, setRevoking] = useState<SubscriptionHolder | null>(null);

  const load = useCallback(() => {
    fetchSubscriptionHolders()
      .then(setHolders)
      .catch(() => setHolders([]));
  }, []);
  useEffect(() => { load(); }, [load]);

  async function revoke(holder: SubscriptionHolder) {
    setBusy(holder.subscriptionId);
    try {
      await revokeSubscription(holder.subscriptionId);
      pushToast("Đã thu hồi gói");
      setRevoking(null);
      load();
      onChanged?.();
    } catch (e) {
      pushToast(errorMessage(e) || "Không thu hồi được");
    } finally {
      setBusy(null);
    }
  }

  return (
    <SectionCard
      title="Người đăng ký"
      action={canManage ? <PrimaryBtn icon="plus" onClick={() => setGranting(true)}>Cấp gói thủ công</PrimaryBtn> : undefined}
    >
      {holders === null ? (
        <div style={{ padding: 16, color: "var(--text-secondary)", fontSize: 13 }}>Đang tải...</div>
      ) : holders.length === 0 ? (
        <div style={{ padding: 16, color: "var(--text-muted)", fontSize: 13 }}>
          Chưa có ai đăng ký gói nào.
        </div>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ textAlign: "left", color: "var(--text-muted)", fontSize: 12 }}>
                <th style={{ padding: "8px 10px", fontWeight: 600 }}>Khách hàng</th>
                <th style={{ padding: "8px 10px", fontWeight: 600 }}>Gói</th>
                <th style={{ padding: "8px 10px", fontWeight: 600 }}>Nguồn</th>
                <th style={{ padding: "8px 10px", fontWeight: 600 }}>Mua lúc</th>
                <th style={{ padding: "8px 10px", fontWeight: 600 }}>Hết hạn</th>
                <th style={{ padding: "8px 10px", fontWeight: 600 }}>Trạng thái</th>
                {canManage ? <th style={{ padding: "8px 10px", fontWeight: 600 }}>Thao tác</th> : null}
              </tr>
            </thead>
            <tbody>
              {holders.map((holder) => {
                const status = statusOf(holder);
                return (
                  <tr key={holder.subscriptionId} style={{ borderTop: "1px solid var(--divider)" }}>
                    <td style={{ padding: "10px", maxWidth: 220 }}>
                      <div style={{ fontWeight: 600, color: "var(--text-primary)" }}>{holder.fullName || "Chưa đặt tên"}</div>
                      <div style={{ fontSize: 11.5, color: "var(--text-muted)", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {holder.email || holder.phone || holder.userId}
                      </div>
                    </td>
                    <td style={{ padding: "10px", whiteSpace: "nowrap" }}>
                      <div style={{ color: "var(--text-primary)" }}>{holder.planName || holder.planCode}</div>
                      <div style={{ fontSize: 11.5, color: "var(--text-muted)" }}>
                        {holder.billingType === "lifetime" ? "trọn đời" : "tự gia hạn"}
                      </div>
                    </td>
                    <td style={{ padding: "10px", whiteSpace: "nowrap" }}>
                      <div style={{ color: "var(--text-secondary)" }}>{SOURCE_LABEL[holder.platform] ?? holder.platform}</div>
                      {/* The store's own id. This is the string to paste into
                          App Store Connect when a customer and the app
                          disagree about what was bought. */}
                      {holder.storeSubscriptionId ? (
                        <div style={{ fontSize: 10.5, color: "var(--text-muted)", fontFamily: "monospace", maxWidth: 140, overflow: "hidden", textOverflow: "ellipsis" }}>
                          {holder.storeSubscriptionId}
                        </div>
                      ) : null}
                    </td>
                    <td style={{ padding: "10px", whiteSpace: "nowrap", color: "var(--text-secondary)" }}>{dateVn(holder.purchasedAt)}</td>
                    <td style={{ padding: "10px", whiteSpace: "nowrap", color: "var(--text-secondary)" }}>
                      {holder.billingType === "lifetime" && !holder.currentPeriodEnd ? "không hết hạn" : dateVn(holder.currentPeriodEnd)}
                    </td>
                    <td style={{ padding: "10px" }}>
                      <Badge color={status.color} bg={status.bg}>{status.label}</Badge>
                    </td>
                    {canManage ? (
                    <td style={{ padding: "10px" }}>
                      {holder.revokedAt ? (
                        <span style={{ fontSize: 12, color: "var(--text-muted)" }}>—</span>
                      ) : (
                        <GhostBtn color="var(--error)" onClick={() => setRevoking(holder)} disabled={busy === holder.subscriptionId}>
                          Thu hồi
                        </GhostBtn>
                      )}
                    </td>
                    ) : null}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {granting && canManage ? (
        <GrantModal
          plans={plans}
          onClose={() => setGranting(false)}
          onDone={() => { setGranting(false); load(); onChanged?.(); }}
        />
      ) : null}

      {revoking && canManage ? (
        <ConfirmModal
          title="Thu hồi gói"
          confirmLabel={busy === revoking.subscriptionId ? "Đang thu hồi..." : "Thu hồi"}
          busy={busy === revoking.subscriptionId}
          onCancel={() => setRevoking(null)}
          onConfirm={() => revoke(revoking)}
          message={
            <div style={{ lineHeight: 1.6 }}>
              <b style={{ color: "var(--text-primary)" }}>{revoking.fullName || revoking.email || "Khách hàng"}</b> sẽ mất
              quyền lợi của {revoking.planName || revoking.planCode} ngay lập tức.
              <div style={{ marginTop: 10 }}>
                {/* Said plainly because it is the part people get wrong: this
                    touches our database only. Apple and Google learn nothing
                    from it, and a store subscription left renewing will keep
                    charging the customer. */}
                Thao tác này chỉ thu hồi quyền trong app. Nếu khách mua qua App Store hoặc Google Play,
                <b> việc hoàn tiền và huỷ gia hạn vẫn phải làm bên store</b> — nếu không, họ vẫn bị trừ tiền kỳ sau.
              </div>
            </div>
          }
        />
      ) : null}
    </SectionCard>
  );
}

function GrantModal({ plans, onClose, onDone }: { plans: SubscriptionPlanAdmin[]; onClose: () => void; onDone: () => void }) {
  const [term, setTerm] = useState("");
  const [results, setResults] = useState<Array<{ id: string; name: string | null; email: string | null; phone: string | null }>>([]);
  const [picked, setPicked] = useState<{ id: string; name: string | null; email: string | null } | null>(null);
  const [planCode, setPlanCode] = useState(plans[0]?.code ?? "");
  const [months, setMonths] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  // Debounced so typing a name does not fire a query per keystroke.
  useEffect(() => {
    if (picked) return;
    const handle = setTimeout(() => {
      searchCustomers(term).then(setResults).catch(() => setResults([]));
    }, 250);
    return () => clearTimeout(handle);
  }, [term, picked]);

  const plan = plans.find((p) => p.code === planCode);

  async function submit() {
    if (!picked || !planCode) return;
    setBusy(true);
    try {
      await grantSubscription(picked.id, planCode, months ? Number(months) : null, note);
      pushToast("Đã cấp gói");
      onDone();
    } catch (e) {
      pushToast(errorMessage(e) || "Không cấp được gói");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      title="Cấp gói thủ công"
      onClose={onClose}
      width={520}
      footer={
        <Fragment>
          <GhostBtn onClick={onClose}>Huỷ</GhostBtn>
          <PrimaryBtn onClick={submit} disabled={!picked || !planCode || busy}>
            {busy ? "Đang cấp..." : "Cấp gói"}
          </PrimaryBtn>
        </Fragment>
      }
    >
      <div style={{ display: "grid", gap: 14 }}>
        <div style={{ fontSize: 12.5, color: "var(--text-muted)", lineHeight: 1.6 }}>
          Dùng khi khách trả tiền ngoài store, hoặc đã trả trong store mà hoá đơn không về.
          Gói cấp tay <b>không</b> được tính vào doanh thu — nó không phải tiền store thu.
        </div>

        <div>
          <FieldLabel>Khách hàng</FieldLabel>
          {picked ? (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "10px 12px", border: "1px solid var(--border-input)", borderRadius: 10 }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 600, color: "var(--text-primary)" }}>{picked.name || "Chưa đặt tên"}</div>
                <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{picked.email}</div>
              </div>
              <GhostBtn onClick={() => { setPicked(null); setTerm(""); }}>Đổi</GhostBtn>
            </div>
          ) : (
            <Fragment>
              <input
                value={term}
                onChange={(e) => setTerm(e.target.value)}
                placeholder="Tên, email hoặc số điện thoại"
                style={{ width: "100%", padding: "10px 12px", border: "1px solid var(--border-input)", borderRadius: 10, fontFamily: "var(--font-family)", fontSize: 13.5 }}
              />
              {results.length > 0 && (
                <div style={{ marginTop: 6, border: "1px solid var(--divider)", borderRadius: 10, overflow: "hidden" }}>
                  {results.map((row) => (
                    <button
                      key={row.id}
                      onClick={() => setPicked(row)}
                      style={{ display: "block", width: "100%", textAlign: "left", padding: "9px 12px", border: "none", borderBottom: "1px solid var(--divider)", background: "#fff", cursor: "pointer", fontFamily: "var(--font-family)" }}
                    >
                      <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>{row.name || "Chưa đặt tên"}</div>
                      <div style={{ fontSize: 11.5, color: "var(--text-muted)" }}>{row.email || row.phone}</div>
                    </button>
                  ))}
                </div>
              )}
            </Fragment>
          )}
        </div>

        <div>
          <FieldLabel>Gói</FieldLabel>
          <select
            value={planCode}
            onChange={(e) => setPlanCode(e.target.value)}
            style={{ width: "100%", padding: "10px 12px", border: "1px solid var(--border-input)", borderRadius: 10, fontFamily: "var(--font-family)", fontSize: 13.5, background: "#fff" }}
          >
            {plans.map((p) => (
              <option key={p.code} value={p.code}>{p.nameVi || p.code}</option>
            ))}
          </select>
        </div>

        {plan?.billing === "lifetime" ? (
          <div style={{ fontSize: 12.5, color: "var(--text-muted)" }}>Gói trọn đời không có hạn, nên không cần nhập số tháng.</div>
        ) : (
          <div>
            <FieldLabel>Số tháng</FieldLabel>
            <input
              value={months}
              onChange={(e) => setMonths(e.target.value.replace(/[^0-9]/g, ""))}
              placeholder="1"
              style={{ width: "100%", padding: "10px 12px", border: "1px solid var(--border-input)", borderRadius: 10, fontFamily: "var(--font-family)", fontSize: 13.5 }}
            />
            <div style={{ fontSize: 11.5, color: "var(--text-muted)", marginTop: 4 }}>
              Để trống thì dùng đúng kỳ của gói đã cấu hình.
            </div>
          </div>
        )}

        <div>
          <FieldLabel>Ghi chú</FieldLabel>
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Vì sao cấp — hiện trong cột nguồn"
            style={{ width: "100%", padding: "10px 12px", border: "1px solid var(--border-input)", borderRadius: 10, fontFamily: "var(--font-family)", fontSize: 13.5 }}
          />
        </div>
      </div>
    </Modal>
  );
}

/** The CSKH tab. No plan editor, no money panel, no grant or revoke — those
 * are admin's, and the RPCs behind them refuse a cskh caller anyway. */
export function SubscribersView() {
  return <SubscribersPanel canManage={false} />;
}
