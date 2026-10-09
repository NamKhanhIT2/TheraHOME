"use client";

// Chiến dịch — Meta spend joined to Pancake orders through utm_campaign.
//
// The join is the whole point and also its weakness, so the table says so:
// not every order carries a campaign tag, which makes every CPA in this table
// harsher than the account-wide one on Tổng quan. Both numbers are true; they
// answer different questions.
import { vnd } from "@/components/agent/charts";
import { Pill, SectionTitle, SourceNote, type Tone } from "@/components/agent/parts";
import { useConsole } from "@/components/agent/state";
import { AD_ACCOUNT, CPA_TARGET } from "@/lib/agentConsole";
import { campaignCpa, snapshotNote } from "@/lib/agentMetrics";
import { MetricsGate } from "@/components/agent/MetricsGate";

export function CampaignsView() {
  const { window: w, metrics } = useConsole();
  if (!w || !metrics) return <MetricsGate />;

  const tagged = w.campaigns.reduce((n, c) => n + c.orders, 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <SourceNote>{snapshotNote(w, metrics.capturedAt)}</SourceNote>

      <SectionTitle action={<span style={{ fontSize: 12.5, color: "var(--ac-ink-3)" }}>{AD_ACCOUNT.name} · {AD_ACCOUNT.id}</span>}>
        Chiến dịch có chi trong {w.label} gần nhất
      </SectionTitle>

      <div className="ac-card ac-in" style={{ overflowX: "auto", "--d": "60ms" } as React.CSSProperties}>
        <table className="ac-table">
          <thead>
            <tr>
              <th>Chiến dịch</th>
              <th style={{ textAlign: "right" }}>Chi</th>
              <th style={{ textAlign: "right" }}>Đơn gắn thẻ</th>
              <th style={{ textAlign: "right" }}>CPA</th>
              <th style={{ textAlign: "right" }}>Doanh thu / 1đ chi</th>
              <th>Trạng thái</th>
            </tr>
          </thead>
          <tbody>
            {w.campaigns.map((c, i) => {
              const cpa = campaignCpa(c);
              const ratio = c.spend ? c.revenue / c.spend : 0;
              const tone: Tone = cpa === null ? "warn" : cpa > CPA_TARGET.max ? "crit" : "good";
              const label = cpa === null ? "Chưa có đơn gắn thẻ" : cpa > CPA_TARGET.max ? "Vượt trần" : "Trong ngưỡng";
              return (
                <tr key={c.id} className="ac-in-fade" style={{ "--d": `${140 + i * 70}ms` } as React.CSSProperties}>
                  <td>
                    <div style={{ color: "var(--ac-ink)", fontWeight: 600 }}>{c.name}</div>
                    <div style={{ fontSize: 11.5, color: "var(--ac-ink-3)", marginTop: 2 }}>{c.id}</div>
                  </td>
                  <td className="num">{vnd(c.spend)}</td>
                  <td className="num">{c.orders}</td>
                  <td className="num">{cpa === null ? "—" : vnd(cpa)}</td>
                  <td className="num">{ratio ? `${ratio.toFixed(2).replace(".", ",")}đ` : "—"}</td>
                  <td><Pill tone={tone}>{label}</Pill></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="ac-card ac-in ac-card-pad" style={{ fontSize: 13, lineHeight: 1.65, color: "var(--ac-ink-2)", "--d": "140ms" } as React.CSSProperties}>
        <div style={{ fontWeight: 700, color: "var(--ac-ink)", marginBottom: 6 }}>Vì sao CPA ở bảng này cao hơn ở Tổng quan</div>
        Trong {w.label} gần nhất có {w.totals.ordersCreated} đơn, nhưng chỉ{" "}
        <strong style={{ color: "var(--ac-ink)" }}>{tagged} đơn gắn được thẻ chiến dịch</strong>; {w.zaloOrders.orders} đơn đến từ Zalo và{" "}
        {w.untaggedOrders} đơn không mang thẻ chiến dịch nào. Bảng này chia chi phí cho riêng phần đơn gắn thẻ, nên là con số
        khắt khe hơn. Tổng quan chia cho toàn bộ đơn, nên là con số dễ thở hơn. Cả hai đều đúng — khác nhau ở câu hỏi:
        “chiến dịch này đáng giữ không” và “cả tháng tôi đang mua một đơn với giá bao nhiêu”.
      </div>
    </div>
  );
}
