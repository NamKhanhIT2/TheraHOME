"use client";

// Tổng quan — the chosen window, as the accounts actually report it.
//
// Everything on this screen follows the window picker in the header. Nothing
// is recomputed differently per window: the daily rows are sliced from one
// 30-day series, and the totals are per-window reads from Pancake, because
// revenue and cancellations cannot be derived by adding day counts up.
import { CpaByDay, Donut, OrdersByDay, SpendByDay, vnd } from "@/components/agent/charts";
import { SourceNote, StatTile } from "@/components/agent/parts";
import { useConsole } from "@/components/agent/state";
import { CANCEL_RETURN_CEILING_PCT, CPA_TARGET } from "@/lib/agentConsole";
import { cpaBlended, cpaOf, daysOf, revenuePerAdDong, snapshotNote } from "@/lib/agentMetrics";
import { MetricsGate } from "@/components/agent/MetricsGate";

const int = (n: number) => Math.round(n).toLocaleString("vi-VN");
const dec1 = (n: number) => n.toFixed(1).replace(".", ",");
const dec2 = (n: number) => n.toFixed(2).replace(".", ",");

export function OverviewView() {
  const { window: w, metrics } = useConsole();
  if (!w || !metrics) return <MetricsGate />;

  const t = w.totals;
  const days = daysOf(metrics.days, w);
  const cpa = cpaBlended(w);
  const cpaOver = cpa > CPA_TARGET.max;
  const cancelOk = t.cancelReturnPct < CANCEL_RETURN_CEILING_PCT;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <SourceNote>{snapshotNote(w, metrics.capturedAt)}</SourceNote>

      <div className="ac-tiles">
        <StatTile
          icon="shopping-bag"
          label={`Đơn ${w.label}`}
          value={t.ordersCreated}
          format={int}
          note={`${t.bySource.web.orders} web · ${t.bySource.messenger.orders} Messenger · ${t.canceled} huỷ, ${t.returned} hoàn`}
          delay={0}
        />
        <StatTile
          icon="trending-up"
          tone="good"
          label="Doanh thu"
          value={t.revenue}
          format={int}
          unit="đ"
          note={`Giá trị đơn trung bình ${vnd(t.avgOrderValue)}`}
          delay={55}
        />
        <StatTile
          icon="megaphone"
          label="Chi quảng cáo Meta"
          value={t.spend}
          format={int}
          unit="đ"
          note="1 tài khoản · TheraHOME VietNam"
          delay={110}
        />
        <StatTile
          icon="activity"
          tone={cpaOver ? "crit" : "good"}
          label="CPA blended"
          value={cpa}
          format={int}
          unit="đ"
          status={cpaOver ? { tone: "crit", text: "Vượt trần" } : { tone: "good", text: "Trong ngưỡng" }}
          note={`Mục tiêu ${vnd(CPA_TARGET.min)}–${vnd(CPA_TARGET.max)} · chi Meta ÷ cả ${t.ordersCreated} đơn`}
          delay={165}
        />
        <StatTile
          icon="flag"
          tone={cancelOk ? "good" : "crit"}
          label="Hoàn và huỷ"
          value={t.cancelReturnPct}
          format={dec1}
          unit="%"
          status={cancelOk ? { tone: "good", text: "Dưới ngưỡng" } : { tone: "crit", text: "Vượt ngưỡng" }}
          note={`Ngưỡng dưới ${CANCEL_RETURN_CEILING_PCT}% · ${t.delivered} đơn đã giao`}
          delay={220}
        />
        <StatTile
          icon="sparkles"
          label="Doanh thu trên 1đ quảng cáo"
          value={revenuePerAdDong(w)}
          format={dec2}
          unit="đ"
          note="Gồm cả đơn web Meta không chạm tới, nên đây là tỷ số kinh doanh chứ không phải ROAS của Meta"
          delay={275}
        />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(380px, 1fr))", gap: 16 }}>
        <OrdersByDay days={days} delay={330} />
        <SpendByDay days={days} delay={385} />
      </div>

      <CpaByDay days={days.map((d) => ({ date: d.date, cpa: cpaOf(d) }))} target={CPA_TARGET} delay={440} />

      <Donut
        title="Cơ cấu sản phẩm bán ra"
        subtitle={`Pancake POS · số lượng theo mã sản phẩm, ${w.label} gần nhất`}
        centerLabel="sản phẩm bán ra"
        delay={495}
        items={t.byProduct.map((p, i) => ({
          label: p.label,
          note: p.code,
          value: p.units,
          color: `var(--ac-seq-${i + 1})`,
        }))}
      />
    </div>
  );
}
