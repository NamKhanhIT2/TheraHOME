"use client";

// Chờ duyệt — an agent prepares, the owner releases.
//
// Each card carries the figures the proposal rests on. A Duyệt button with no
// evidence behind it is just a dare.
//
// This is the console's one screen backed by a real table (`agent_approvals`,
// admin-only RLS): a decision made here survives a reload and records who made
// it. What it does NOT yet do is carry the change out — Meta Ads is not
// connected, so approving a pause marks the decision rather than pausing the
// campaign. The card says so rather than letting someone assume otherwise.
import { Icon } from "@/components/ui/Icon";
import { KeyValues, NotConnected, Pill, SourceNote, Tag } from "@/components/agent/parts";
import { useConsole } from "@/components/agent/state";
import { agentById } from "@/lib/agentConsole";
import type { Approval } from "@/lib/agentApprovals";

const KIND: Record<Approval["kind"], string> = {
  budget: "Ngân sách quảng cáo",
  content: "Nội dung tới khách",
};

export function ApprovalsView() {
  const { approvals, approvalsError, reloadApprovals, decide, canApprove } = useConsole();

  if (approvalsError) {
    return (
      <div className="ac-card ac-card-pad" style={{ display: "flex", flexDirection: "column", gap: 12, alignItems: "flex-start" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
          <Icon name="triangle-alert" size={17} color="var(--ac-crit)" />
          <span style={{ fontSize: 15, fontWeight: 700, color: "var(--ac-ink)" }}>Không đọc được danh sách chờ duyệt</span>
        </div>
        <div style={{ fontSize: 13, color: "var(--ac-ink-2)", lineHeight: 1.6 }}>{approvalsError}</div>
        <button type="button" className="ac-btn" onClick={reloadApprovals}>Thử lại</button>
      </div>
    );
  }

  if (approvals === null) {
    return (
      <div className="ac-card ac-card-pad" style={{ fontSize: 13.5, color: "var(--ac-ink-3)" }}>
        Đang đọc danh sách chờ duyệt…
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <SourceNote>
        Quyết định ở đây được lưu thật và ghi lại ai quyết, lúc nào. Nhưng console chưa nối Meta Ads, nên duyệt một đề xuất
        tạm dừng mới chỉ ghi nhận quyết định — chiến dịch thật vẫn đang chạy cho tới khi có người tắt nó trong Meta.
      </SourceNote>

      {!canApprove ? (
        <div className="ac-card ac-card-pad" style={{ borderLeft: "3px solid var(--ac-warn)", fontSize: 13.5, lineHeight: 1.6, color: "var(--ac-ink-2)" }}>
          Tài khoản của bạn đọc được đề xuất và bằng chứng, nhưng không duyệt được. Ngân sách quảng cáo và nội dung tới khách
          chỉ tài khoản admin quyết.
        </div>
      ) : null}

      {approvals.length === 0 ? (
        <NotConnected icon="check-square" title="Không có đề xuất nào chờ bạn">
          Khi một agent chuẩn bị thay đổi ngân sách hoặc nội dung tới khách, đề xuất sẽ dừng ở đây chờ bạn quyết.
        </NotConnected>
      ) : (
        approvals.map((a, i) => {
          const decided = a.status !== "pending";
          return (
            <div
              key={a.id}
              className="ac-card ac-card-hover ac-in ac-card-pad"
              style={{ display: "flex", flexDirection: "column", gap: 15, "--d": `${80 + i * 80}ms` } as React.CSSProperties}
            >
              <div style={{ display: "flex", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
                <div style={{ flex: "1 1 320px", minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 7 }}>
                    <Tag>{KIND[a.kind]}</Tag>
                    <span style={{ fontSize: 12, color: "var(--ac-ink-3)" }}>{agentById(a.agent).name} · {a.at}</span>
                  </div>
                  <div style={{ fontSize: 16.5, fontWeight: 700, color: "var(--ac-ink)", lineHeight: 1.4 }}>{a.title}</div>
                </div>
                {decided ? (
                  <Pill tone={a.status === "approved" ? "good" : "neutral"}>
                    {a.status === "approved" ? "Đã duyệt" : "Đã từ chối"}
                  </Pill>
                ) : (
                  <Pill tone="warn">Đang chờ</Pill>
                )}
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", background: "rgba(9,9,19,0.5)", border: "1px solid var(--ac-line)", borderRadius: 11, padding: "13px 16px" }}>
                <span style={{ fontSize: 14, color: "var(--ac-ink-3)", textDecoration: "line-through" }}>{a.from}</span>
                <Icon name="chevron-right" size={15} color="var(--ac-ink-3)" />
                <span style={{ fontSize: 14, fontWeight: 700, color: "var(--ac-crit)" }}>{a.to}</span>
                <span style={{ marginLeft: "auto", fontSize: 12, color: "var(--ac-ink-3)" }}>{a.target}</span>
              </div>

              {a.evidence.length ? (
                <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
                  {a.evidence.map(([k, v]) => (
                    <div key={k}>
                      <div style={{ fontSize: 11.5, color: "var(--ac-ink-3)" }}>{k}</div>
                      <div style={{ fontSize: 15, fontWeight: 700, color: "var(--ac-ink)", fontVariantNumeric: "tabular-nums", marginTop: 1 }}>{v}</div>
                    </div>
                  ))}
                </div>
              ) : null}

              <KeyValues rows={[["Lý do", a.reason]]} />

              {decided ? (
                <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, color: "var(--ac-ink-3)" }}>
                  <Icon name="check" size={14} color="var(--ac-ink-3)" />
                  {a.status === "approved" ? "Đã duyệt" : "Đã từ chối"}
                  {a.decidedAt ? ` lúc ${a.decidedAt}` : ""}. Đã lưu — tải lại trang vẫn còn.
                </div>
              ) : (
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                  <button type="button" className="ac-btn ac-btn-good" disabled={!canApprove} onClick={() => decide(a.id, "approved")}>
                    <Icon name="check" size={14} color="currentColor" />
                    Duyệt
                  </button>
                  <button type="button" className="ac-btn ac-btn-crit" disabled={!canApprove} onClick={() => decide(a.id, "rejected")}>
                    Từ chối
                  </button>
                  {!canApprove ? <span style={{ fontSize: 12.5, color: "var(--ac-ink-3)" }}>Chỉ admin duyệt được</span> : null}
                </div>
              )}
            </div>
          );
        })
      )}
    </div>
  );
}
