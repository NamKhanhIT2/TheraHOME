"use client";

// Charts for the Agent console.
//
// Drawn by hand rather than pulled from a library: three small charts of seven
// points each do not justify a charting dependency, and hand-drawing is what
// keeps the marks on the console's own tokens.
//
// Rules followed here, not by taste but because they are what make a chart
// readable: one y-scale per chart and never two; categorical hues assigned in
// fixed order and never cycled; a legend whenever there is more than one
// series, plus direct labels so identity is never carried by colour alone;
// text in ink tokens, never in a series colour; grid and axes recessive; and
// every chart has a hover layer, because a chart on a screen that cannot be
// interrogated is a picture of data rather than data.
import { useRef, useState, type ReactNode } from "react";

// A chart's viewBox scales uniformly to its container, so its text scales too:
// one fixed viewBox would print the full-width chart's axis labels at twice the
// size of the half-width ones. Each chart picks a viewBox width in proportion
// to how wide it will actually render, which keeps type consistent across the
// page.
export interface Geo {
  w: number;
  h: number;
  pad: { l: number; r: number; t: number; b: number };
  plotW: number;
  plotH: number;
}

export const geo = (w: number, h = 230): Geo => {
  const pad = { l: 58, r: 16, t: 18, b: 30 };
  return { w, h, pad, plotW: w - pad.l - pad.r, plotH: h - pad.t - pad.b };
};

/** Half of a two-column row. */
const HALF = geo(680);
/** A chart on its own row. */
const FULL = geo(1400);

export const vnd = (n: number) => `${n.toLocaleString("vi-VN")}đ`;
export const compactVnd = (n: number) =>
  n === 0 ? "0" : n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1).replace(".", ",")}tr` : `${Math.round(n / 1000)}k`;
export const dayLabel = (iso: string) => `${Number(iso.slice(8, 10))}/${Number(iso.slice(5, 7))}`;

/** Four ticks over a range padded to a round-ish top, so the axis labels name
 * values the chart actually reaches. */
function ticks(max: number, count = 4): number[] {
  const step = max / (count - 1);
  return Array.from({ length: count }, (_, i) => Math.round(step * i));
}

function roundedTop(x: number, y: number, w: number, h: number, r: number): string {
  const rr = Math.min(r, h, w / 2);
  return `M${x},${y + h} L${x},${y + rr} Q${x},${y} ${x + rr},${y} L${x + w - rr},${y} Q${x + w},${y} ${x + w},${y + rr} L${x + w},${y + h} Z`;
}

/** A Catmull-Rom curve through the points, written as beziers.
 *
 * Each control point's y is clamped to the range of the two points it joins,
 * so the curve can never bulge past a value the data never reached — a
 * smoothed line that overshoots is a prettier chart telling a small lie. */
function curve(pts: Array<[number, number]>): string {
  if (pts.length < 2) return "";
  let d = `M${pts[0][0]},${pts[0][1]}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] ?? p2;
    const t = 0.2;
    const lo = Math.min(p1[1], p2[1]);
    const hi = Math.max(p1[1], p2[1]);
    const c1y = Math.min(Math.max(p1[1] + (p2[1] - p0[1]) * t, lo), hi);
    const c2y = Math.min(Math.max(p2[1] - (p3[1] - p1[1]) * t, lo), hi);
    d += ` C${p1[0] + (p2[0] - p0[0]) * t},${c1y} ${p2[0] - (p3[0] - p1[0]) * t},${c2y} ${p2[0]},${p2[1]}`;
  }
  return d;
}

/** Shared <defs>: a vertical fade for areas and bars, and the soft bloom that
 * gives a line the lit look these dashboards are built around. The blur is
 * drawn UNDER the crisp stroke, so the line itself stays sharp. */
function Defs({ id, color, lift }: { id: string; color: string; lift: string }) {
  return (
    <defs>
      <linearGradient id={`${id}-area`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor={lift} stopOpacity="0.42" />
        <stop offset="100%" stopColor={color} stopOpacity="0.02" />
      </linearGradient>
      <linearGradient id={`${id}-bar`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor={lift} />
        <stop offset="100%" stopColor={color} />
      </linearGradient>
      <linearGradient id={`${id}-stroke`} x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stopColor={color} />
        <stop offset="100%" stopColor={lift} />
      </linearGradient>
      <filter id={`${id}-glow`} x="-20%" y="-60%" width="140%" height="260%">
        <feGaussianBlur stdDeviation="5" result="b" />
        <feMerge>
          <feMergeNode in="b" />
          <feMergeNode in="b" />
        </feMerge>
      </filter>
    </defs>
  );
}

// ---------------------------------------------------------------------------
// Shared frame
// ---------------------------------------------------------------------------

function Frame({
  g,
  delay = 0,
  title,
  subtitle,
  legend,
  points,
  onHover,
  tooltip,
  children,
}: {
  g: Geo;
  delay?: number;
  title: string;
  subtitle?: string;
  legend?: ReactNode;
  /** Number of x slots, for mapping a pointer position to an index. */
  points: number;
  onHover: (index: number | null) => void;
  tooltip: ReactNode;
  children: ReactNode;
}) {
  const box = useRef<HTMLDivElement>(null);

  function move(clientX: number) {
    const el = box.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    // The svg scales uniformly, so work in fractions of the plot area rather
    // than in viewBox units.
    const left = r.left + (g.pad.l / g.w) * r.width;
    const width = (g.plotW / g.w) * r.width;
    const t = (clientX - left) / width;
    const i = Math.round(t * (points - 1));
    onHover(i >= 0 && i < points ? i : null);
  }

  return (
    <div className="ac-card ac-card-hover ac-in" style={{ padding: "20px 22px", minWidth: 0, "--d": `${delay}ms` } as React.CSSProperties}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12, flexWrap: "wrap", marginBottom: 4 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 14.5, fontWeight: 700, color: "var(--ac-ink)" }}>{title}</div>
          {subtitle ? <div style={{ fontSize: 12, color: "var(--ac-ink-3)", marginTop: 2 }}>{subtitle}</div> : null}
        </div>
        {legend ? <div style={{ marginLeft: "auto" }}>{legend}</div> : null}
      </div>
      <div
        ref={box}
        style={{ position: "relative" }}
        onPointerMove={(e) => move(e.clientX)}
        onPointerLeave={() => onHover(null)}
      >
        <svg viewBox={`0 0 ${g.w} ${g.h}`} style={{ width: "100%", height: "auto", display: "block" }} role="img" aria-label={title}>
          {children}
        </svg>
        {tooltip}
      </div>
    </div>
  );
}

export function Legend({ items }: { items: Array<[string, string]> }) {
  return (
    <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
      {items.map(([label, color]) => (
        <span key={label} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--ac-ink-2)" }}>
          <span style={{ width: 9, height: 9, borderRadius: 3, background: color, flex: "0 0 auto" }} />
          {label}
        </span>
      ))}
    </div>
  );
}

function Tip({ g, index, points, rows, title }: { g: Geo; index: number | null; points: number; title: string; rows: Array<[string, string, string?]> }) {
  if (index === null) return null;
  const leftPct = ((g.pad.l + (g.plotW * index) / (points - 1)) / g.w) * 100;
  const flip = leftPct > 62;
  return (
    <div
      className="ac-tip"
      style={{
        position: "absolute",
        left: `${leftPct}%`,
        top: 6,
        transform: flip ? "translateX(calc(-100% - 12px))" : "translateX(12px)",
        background: "var(--ac-raised)",
        border: "1px solid var(--ac-line)",
        borderRadius: 10,
        padding: "9px 12px",
        pointerEvents: "none",
        minWidth: 136,
        boxShadow: "0 12px 32px rgba(0,0,0,0.45)",
        zIndex: 2,
      }}
    >
      <div style={{ fontSize: 11.5, fontWeight: 700, color: "var(--ac-ink-3)", marginBottom: 5 }}>{title}</div>
      {rows.map(([k, v, color]) => (
        <div key={k} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, marginTop: 3 }}>
          {color ? <span style={{ width: 8, height: 8, borderRadius: 2, background: color, flex: "0 0 auto" }} /> : null}
          <span style={{ color: "var(--ac-ink-2)" }}>{k}</span>
          <span style={{ marginLeft: "auto", color: "var(--ac-ink)", fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>{v}</span>
        </div>
      ))}
    </div>
  );
}

function Grid({ g, max, format }: { g: Geo; max: number; format: (n: number) => string }) {
  return (
    <>
      {ticks(max).map((t) => {
        const y = g.pad.t + g.plotH - (t / max) * g.plotH;
        return (
          <g key={t}>
            <line x1={g.pad.l} y1={y} x2={g.pad.l + g.plotW} y2={y} stroke="var(--ac-hairline)" strokeWidth="1" />
            <text x={g.pad.l - 10} y={y + 4} textAnchor="end" fontSize="11" fill="var(--ac-ink-3)">
              {format(t)}
            </text>
          </g>
        );
      })}
    </>
  );
}

/** Thirty dates will not fit along an axis, so only every nth is drawn — the
 * last one always, because the most recent day is the one a reader looks for.
 * The points themselves are all still there; it is the labels that thin. */
function XLabels({ g, labels }: { g: Geo; labels: string[] }) {
  const step = Math.ceil(labels.length / 8);
  return (
    <>
      {labels.map((l, i) =>
        i % step === 0 || i === labels.length - 1 ? (
          <text
            key={l}
            x={g.pad.l + (g.plotW * i) / (labels.length - 1)}
            y={g.h - 10}
            textAnchor="middle"
            fontSize="11"
            fill="var(--ac-ink-3)"
          >
            {l}
          </text>
        ) : null,
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Stacked bars — orders per day, split by source
// ---------------------------------------------------------------------------

export function OrdersByDay({ days, delay = 0 }: { days: Array<{ date: string; web: number; messenger: number }>; delay?: number }) {
  const [hover, setHover] = useState<number | null>(null);
  const totals = days.map((d) => d.web + d.messenger);
  const g = HALF;
  const max = Math.max(...totals) + 4;
  const slot = g.plotW / days.length;
  const bw = Math.max(Math.min(slot * 0.56, 44), 3);
  const y = (v: number) => g.pad.t + g.plotH - (v / max) * g.plotH;

  return (
    <Frame
      g={g}
      delay={delay}
      title="Đơn theo ngày, tách nguồn"
      subtitle="Pancake POS · đơn tạo, gồm cả đơn sau đó huỷ"
      legend={<Legend items={[["Web", "var(--ac-s1)"], ["Messenger", "var(--ac-s2)"]]} />}
      points={days.length}
      onHover={setHover}
      tooltip={
        <Tip
          g={g}
          index={hover}
          points={days.length}
          title={hover !== null ? `Ngày ${dayLabel(days[hover].date)}` : ""}
          rows={
            hover === null
              ? []
              : [
                  ["Web", String(days[hover].web), "var(--ac-s1)"],
                  ["Messenger", String(days[hover].messenger), "var(--ac-s2)"],
                  ["Tổng", String(totals[hover])],
                ]
          }
        />
      }
    >
      <Defs id="ord1" color="var(--ac-s1)" lift="var(--ac-s1-lift)" />
      <defs>
        <linearGradient id="ord2-bar" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--ac-s2-lift)" />
          <stop offset="100%" stopColor="var(--ac-s2)" />
        </linearGradient>
      </defs>
      <Grid g={g} max={max} format={(n) => String(n)} />
      {days.map((d, i) => {
        const cx = g.pad.l + slot * i + slot / 2;
        const x = cx - bw / 2;
        const total = totals[i];
        const topH = g.pad.t + g.plotH - y(total);
        const webH = (d.web / max) * g.plotH;
        const on = hover === null || hover === i;
        return (
          <g key={d.date} opacity={on ? 1 : 0.45} className="ac-bar-group" style={{ "--d": `${delay + 120 + i * 60}ms` } as React.CSSProperties}>
            {/* Messenger sits on top of web; a 2px surface gap keeps the two
                segments from reading as one block. */}
            <path d={roundedTop(x, y(total), bw, topH - webH - 2, 7)} fill="url(#ord2-bar)" />
            <path d={roundedTop(x, g.pad.t + g.plotH - webH, bw, Math.max(webH, 1), 7)} fill="url(#ord1-bar)" />
            {days.length <= 10 ? (
              <text x={cx} y={y(total) - 7} textAnchor="middle" fontSize="11.5" fontWeight="700" fill="var(--ac-ink-2)">
                {total}
              </text>
            ) : null}
          </g>
        );
      })}
      <line x1={g.pad.l} y1={g.pad.t + g.plotH} x2={g.pad.l + g.plotW} y2={g.pad.t + g.plotH} stroke="var(--ac-line)" strokeWidth="1" />
      <XLabels g={g} labels={days.map((d) => dayLabel(d.date))} />
    </Frame>
  );
}

// ---------------------------------------------------------------------------
// Area line — one measure over time
// ---------------------------------------------------------------------------

export function SpendByDay({ days, delay = 0 }: { days: Array<{ date: string; spend: number }>; delay?: number }) {
  const [hover, setHover] = useState<number | null>(null);
  const g = HALF;
  const max = Math.max(...days.map((d) => d.spend)) * 1.15;
  const x = (i: number) => g.pad.l + (g.plotW * i) / (days.length - 1);
  const y = (v: number) => g.pad.t + g.plotH - (v / max) * g.plotH;
  const pts = days.map((d, i) => [x(i), y(d.spend)] as [number, number]);
  const line = curve(pts);
  const area = `${line} L${x(days.length - 1)},${g.pad.t + g.plotH} L${x(0)},${g.pad.t + g.plotH} Z`;

  return (
    <Frame
      g={g}
      delay={delay}
      title="Chi quảng cáo Meta theo ngày"
      subtitle="Tài khoản TheraHOME VietNam · đồng"
      points={days.length}
      onHover={setHover}
      tooltip={
        <Tip
          g={g}
          index={hover}
          points={days.length}
          title={hover !== null ? `Ngày ${dayLabel(days[hover].date)}` : ""}
          rows={hover === null ? [] : [["Chi", vnd(days[hover].spend)]]}
        />
      }
    >
      <Defs id="spend" color="var(--ac-s1)" lift="var(--ac-s1-lift)" />
      <Grid g={g} max={max} format={compactVnd} />
      <path d={area} fill="url(#spend-area)" className="ac-area" />
      <path d={line} pathLength={1} className="ac-line" style={{ "--d": `${delay + 120}ms` } as React.CSSProperties} fill="none" stroke="var(--ac-s1-lift)" strokeOpacity="0.55" strokeWidth="3" filter="url(#spend-glow)" strokeLinecap="round" />
      <path d={line} pathLength={1} className="ac-line" style={{ "--d": `${delay + 120}ms` } as React.CSSProperties} fill="none" stroke="url(#spend-stroke)" strokeWidth="2.4" strokeLinejoin="round" strokeLinecap="round" />
      {hover !== null ? (
        <>
          <line x1={x(hover)} y1={g.pad.t} x2={x(hover)} y2={g.pad.t + g.plotH} stroke="var(--ac-line)" strokeWidth="1" />
          <circle cx={x(hover)} cy={y(days[hover].spend)} r="5" fill="var(--ac-s1-lift)" stroke="var(--ac-card)" strokeWidth="2" />
        </>
      ) : null}
      <line x1={g.pad.l} y1={g.pad.t + g.plotH} x2={g.pad.l + g.plotW} y2={g.pad.t + g.plotH} stroke="var(--ac-line)" strokeWidth="1" />
      <XLabels g={g} labels={days.map((d) => dayLabel(d.date))} />
    </Frame>
  );
}

// ---------------------------------------------------------------------------
// Line against a target band
// ---------------------------------------------------------------------------

export function CpaByDay({
  days,
  target,
  delay = 0,
}: {
  /** `cpa` is null on a day with no orders: spend ÷ 0 is not a number to draw,
   * and pretending the line simply continues would invent a value. */
  days: Array<{ date: string; cpa: number | null }>;
  target: { min: number; max: number };
  delay?: number;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const g = FULL;
  const values = days.map((d) => d.cpa).filter((v): v is number => v !== null);
  const max = Math.max(...values, target.max) * 1.12;
  const x = (i: number) => g.pad.l + (g.plotW * i) / (days.length - 1);
  const y = (v: number) => g.pad.t + g.plotH - (v / max) * g.plotH;

  // One path per unbroken run of days that have a CPA, so a gap in the data
  // shows as a gap in the line instead of a straight leap across it.
  const runs: Array<Array<[number, number]>> = [];
  days.forEach((d, i) => {
    if (d.cpa === null) {
      if (runs.length && runs[runs.length - 1].length) runs.push([]);
      return;
    }
    if (!runs.length) runs.push([]);
    runs[runs.length - 1].push([x(i), y(d.cpa)]);
  });
  const drawn = runs.filter((r) => r.length > 1);
  const gaps = days.filter((d) => d.cpa === null).length;

  return (
    <Frame
      g={g}
      delay={delay}
      title="CPA blended theo ngày"
      subtitle={`Chi Meta ÷ tất cả đơn trong ngày, kể cả đơn web${gaps ? ` · ${gaps} ngày không có đơn nên không có CPA` : ""}`}
      legend={
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--ac-ink-2)" }}>
          <span style={{ width: 16, height: 9, borderRadius: 2, background: "var(--ac-good-soft)", border: "1px solid var(--ac-good)", flex: "0 0 auto" }} />
          Mục tiêu {compactVnd(target.min)}–{compactVnd(target.max)}
        </span>
      }
      points={days.length}
      onHover={setHover}
      tooltip={
        <Tip
          g={g}
          index={hover}
          points={days.length}
          title={hover !== null ? `Ngày ${dayLabel(days[hover].date)}` : ""}
          rows={
            hover === null
              ? []
              : days[hover].cpa === null
                ? [["CPA", "không có đơn"]]
                : [
                    ["CPA", vnd(days[hover].cpa as number)],
                    ["So với trần", `+${Math.round((((days[hover].cpa as number) - target.max) / target.max) * 100)}%`],
                  ]
          }
        />
      }
    >
      <Defs id="cpa" color="var(--ac-crit)" lift="#f79aa2" />
      <Grid g={g} max={max} format={compactVnd} />
      {/* The band is a reference region, not a series: no hue of its own
          beyond the reserved "good" status colour it stands for. */}
      <rect x={g.pad.l} y={y(target.max)} width={g.plotW} height={y(target.min) - y(target.max)} fill="var(--ac-good)" fillOpacity="0.1" />
      <line x1={g.pad.l} y1={y(target.max)} x2={g.pad.l + g.plotW} y2={y(target.max)} stroke="var(--ac-good)" strokeWidth="1" strokeDasharray="4 4" />
      {drawn.map((run, r) => (
        <g key={r}>
          <path d={curve(run)} pathLength={1} className="ac-line" style={{ "--d": `${delay + 120}ms` } as React.CSSProperties} fill="none" stroke="var(--ac-crit)" strokeOpacity="0.5" strokeWidth="3.4" filter="url(#cpa-glow)" strokeLinecap="round" />
          <path d={curve(run)} pathLength={1} className="ac-line" style={{ "--d": `${delay + 120}ms` } as React.CSSProperties} fill="none" stroke="var(--ac-crit)" strokeWidth="2.4" strokeLinejoin="round" strokeLinecap="round" />
        </g>
      ))}
      {days.map((d, i) =>
        d.cpa === null ? null : (
          <circle
            key={d.date}
            className="ac-dot"
            style={{ "--d": `${delay + 300 + i * 40}ms` } as React.CSSProperties}
            cx={x(i)}
            cy={y(d.cpa)}
            r={hover === i ? 5 : days.length > 14 ? 2.2 : 3}
            fill="var(--ac-crit)"
            stroke="var(--ac-card)"
            strokeWidth="2"
          />
        ),
      )}
      {hover !== null ? <line x1={x(hover)} y1={g.pad.t} x2={x(hover)} y2={g.pad.t + g.plotH} stroke="var(--ac-line)" strokeWidth="1" /> : null}
      <line x1={g.pad.l} y1={g.pad.t + g.plotH} x2={g.pad.l + g.plotW} y2={g.pad.t + g.plotH} stroke="var(--ac-line)" strokeWidth="1" />
      <XLabels g={g} labels={days.map((d) => dayLabel(d.date))} />
    </Frame>
  );
}

// ---------------------------------------------------------------------------
// Donut — parts of a whole
// ---------------------------------------------------------------------------

/** Drawn as one circle per slice with a dashed stroke rather than as arc
 * paths: a round line cap gives each segment the soft ends these dashboards
 * are built around, which an arc path cannot do without hand-rolling the
 * corners.
 *
 * The slices are ordered by size, so this is a magnitude scale, not an
 * identity one: ONE hue, light to dark, validated as a ramp. Every slice is
 * also named and numbered beside the ring, so nothing here is carried by
 * colour alone. */
export function Donut({
  title,
  subtitle,
  centerLabel,
  items,
  delay = 0,
}: {
  title: string;
  subtitle?: string;
  centerLabel: string;
  items: Array<{ label: string; note: string; value: number; color: string }>;
  delay?: number;
}) {
  const total = items.reduce((n, i) => n + i.value, 0);
  const R = 62;
  const C = 2 * Math.PI * R;
  // A 7-unit gap between segments keeps the round caps from touching.
  const GAP = 7;

  // Each slice's start is the sum of the ones before it, computed rather than
  // accumulated in a running variable — three items, and nothing mutates
  // during render.
  const arcs = items.map((item, i) => ({
    ...item,
    len: Math.max((item.value / total) * C - GAP, 1),
    offset: (items.slice(0, i).reduce((n, x) => n + x.value, 0) / total) * C,
  }));

  return (
    <div
      className="ac-card ac-card-hover ac-in"
      style={{ padding: "20px 22px", minWidth: 0, "--d": `${delay}ms` } as React.CSSProperties}
    >
      <div style={{ fontSize: 14.5, fontWeight: 700, color: "var(--ac-ink)" }}>{title}</div>
      {subtitle ? <div style={{ fontSize: 12, color: "var(--ac-ink-3)", marginTop: 2 }}>{subtitle}</div> : null}

      <div style={{ display: "flex", alignItems: "center", gap: 28, flexWrap: "wrap", marginTop: 16 }}>
        <div style={{ position: "relative", width: 168, height: 168, flex: "0 0 auto" }}>
          <svg viewBox="0 0 168 168" style={{ width: "100%", height: "100%", display: "block" }} role="img" aria-label={title}>
            <defs>
              <filter id="donut-glow" x="-30%" y="-30%" width="160%" height="160%">
                <feGaussianBlur stdDeviation="4" />
              </filter>
            </defs>
            <g transform="rotate(-90 84 84)">
              <circle cx="84" cy="84" r={R} fill="none" stroke="var(--ac-hairline)" strokeWidth="15" />
              {arcs.map((a, i) => (
                <g key={a.label} className="ac-in-fade" style={{ "--d": `${delay + 180 + i * 110}ms` } as React.CSSProperties}>
                  <circle
                    cx="84" cy="84" r={R} fill="none"
                    stroke={a.color} strokeOpacity="0.55" strokeWidth="17" strokeLinecap="round"
                    strokeDasharray={`${a.len} ${C - a.len}`} strokeDashoffset={-a.offset}
                    filter="url(#donut-glow)"
                  />
                  <circle
                    cx="84" cy="84" r={R} fill="none"
                    stroke={a.color} strokeWidth="15" strokeLinecap="round"
                    strokeDasharray={`${a.len} ${C - a.len}`} strokeDashoffset={-a.offset}
                  />
                </g>
              ))}
            </g>
          </svg>
          <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", pointerEvents: "none" }}>
            <span className="ac-figure" style={{ fontSize: 28, fontWeight: 700, lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>
              {total.toLocaleString("vi-VN")}
            </span>
              <span style={{ fontSize: 11.5, color: "var(--ac-ink-3)", marginTop: 3, textAlign: "center", lineHeight: 1.25 }}>{centerLabel}</span>
          </div>
        </div>

        {/* Capped, not stretched: on a full-width card a flexible legend throws
            each value against the far edge, and the eye stops pairing it with
            its slice. */}
        <div style={{ flex: "1 1 240px", maxWidth: 380, minWidth: 0, display: "flex", flexDirection: "column", gap: 11 }}>
          {items.map((item, i) => (
            <div
              key={item.label}
              className="ac-in-fade"
              style={{ display: "flex", alignItems: "center", gap: 11, "--d": `${delay + 220 + i * 110}ms` } as React.CSSProperties}
            >
              <span style={{ width: 10, height: 10, borderRadius: 3, background: item.color, flex: "0 0 auto" }} />
              <span style={{ minWidth: 0, flex: 1 }}>
                <span style={{ display: "block", fontSize: 13.5, fontWeight: 600, color: "var(--ac-ink)" }}>{item.label}</span>
                <span style={{ display: "block", fontSize: 11.5, color: "var(--ac-ink-3)" }}>{item.note}</span>
              </span>
              <span style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                <span style={{ display: "block", fontSize: 14.5, fontWeight: 700, color: "var(--ac-ink)" }}>{item.value}</span>
                <span style={{ display: "block", fontSize: 11.5, color: "var(--ac-ink-3)" }}>
                  {((item.value / total) * 100).toFixed(0)}%
                </span>
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
