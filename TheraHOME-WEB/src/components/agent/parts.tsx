"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Icon } from "@/components/ui/Icon";

export type Tone = "good" | "warn" | "crit" | "neutral";

const TONE_FG: Record<Tone, string> = {
  good: "var(--ac-good)",
  warn: "var(--ac-warn)",
  crit: "var(--ac-crit)",
  neutral: "var(--ac-ink-2)",
};
const TONE_BG: Record<Tone, string> = {
  good: "var(--ac-good-soft)",
  warn: "var(--ac-warn-soft)",
  crit: "var(--ac-crit-soft)",
  neutral: "var(--ac-raised)",
};
const TONE_ICON: Record<Tone, string> = {
  good: "check",
  warn: "triangle-alert",
  crit: "triangle-alert",
  neutral: "circle",
};

/** Status never travels as colour alone — every pill carries an icon and a
 * word, so it survives colour blindness, greyscale print and forced colours. */
export function Pill({ tone = "neutral", children, icon = true }: { tone?: Tone; children: ReactNode; icon?: boolean }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        background: TONE_BG[tone],
        color: TONE_FG[tone],
        borderRadius: 999,
        padding: "3px 10px",
        fontSize: 11.5,
        fontWeight: 700,
        whiteSpace: "nowrap",
      }}
    >
      {icon && tone !== "neutral" ? <Icon name={TONE_ICON[tone]} size={12} color={TONE_FG[tone]} /> : null}
      {children}
    </span>
  );
}

const GLOW: Record<Tone, { bg: string; ring: string; fg: string }> = {
  good: { bg: "var(--ac-good-soft)", ring: "rgba(63,191,128,0.5)", fg: "var(--ac-good)" },
  warn: { bg: "var(--ac-warn-soft)", ring: "rgba(224,163,63,0.5)", fg: "var(--ac-warn)" },
  crit: { bg: "var(--ac-crit-soft)", ring: "rgba(242,112,122,0.5)", fg: "var(--ac-crit)" },
  neutral: { bg: "var(--ac-accent-soft)", ring: "rgba(139,92,246,0.5)", fg: "var(--ac-accent)" },
};

/** Counts a figure up on first paint, then holds it.
 *
 * The animation is the point of the gesture, not the number: the final value
 * is set exactly rather than left at whatever the last frame computed, and
 * anyone who asked for less motion gets the figure immediately. */
function useCountUp(target: number, duration = 950) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let raf = 0;
    const started = performance.now();
    const tick = (now: number) => {
      if (reduced) {
        setValue(target);
        return;
      }
      const t = Math.min((now - started) / duration, 1);
      // ease-out cubic: fast enough to feel instant, slow enough to read
      setValue(target * (1 - Math.pow(1 - t, 3)));
      if (t < 1) raf = requestAnimationFrame(tick);
      else setValue(target);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);
  return value;
}

export function CountUp({ value, format }: { value: number; format: (n: number) => string }) {
  return <>{format(useCountUp(value))}</>;
}

/** A window total. No sparkline: the daily shape of every one of these is
 * already drawn below, and a number that readers compare belongs in one place,
 * not two. */
export function StatTile({
  icon,
  tone = "neutral",
  label,
  value,
  format,
  unit,
  note,
  status,
  delay = 0,
}: {
  icon: string;
  tone?: Tone;
  label: string;
  value: number;
  format: (n: number) => string;
  unit?: string;
  note?: string;
  status?: { tone: Tone; text: string };
  delay?: number;
}) {
  const glow = GLOW[tone];
  return (
    <div
      className="ac-card ac-card-hover ac-in ac-tile"
      style={{ "--d": `${delay}ms` } as React.CSSProperties}
    >
      <div className="ac-tile-top">
        <span
          className="ac-glyph"
          style={{ "--ac-glow-bg": glow.bg, "--ac-glow-ring": glow.ring } as React.CSSProperties}
        >
          <Icon name={icon} size={16} color={glow.fg} />
        </span>
        <span className="ac-tile-label">{label}</span>
      </div>
      <div className="ac-tile-val">
        <span className="ac-figure"><CountUp value={value} format={format} /></span>
        {unit ? <span className="unit">{unit}</span> : null}
      </div>
      {status ? <div><Pill tone={status.tone}>{status.text}</Pill></div> : null}
      {note ? <div className="ac-tile-note">{note}</div> : null}
    </div>
  );
}

export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
      <h2 style={{ margin: 0, fontSize: 15.5, fontWeight: 700, color: "var(--ac-ink)" }}>{children}</h2>
      {action ? <span style={{ marginLeft: "auto" }}>{action}</span> : null}
    </div>
  );
}

/** Where the figures came from and when. Shown on every screen that carries
 * them: a dashboard that does not say how old its numbers are invites someone
 * to act on last week's. */
export function SourceNote({ children }: { children: ReactNode }) {
  return (
    <div
      className="ac-in"
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: 10,
        background: "var(--ac-raised)",
        border: "1px solid var(--ac-line)",
        borderLeft: "3px solid var(--ac-cyan)",
        borderRadius: 10,
        padding: "11px 14px",
        fontSize: 12.5,
        lineHeight: 1.55,
        color: "var(--ac-ink-2)",
      }}
    >
      <span style={{ marginTop: 1, flex: "0 0 auto", display: "flex" }}>
        <Icon name="activity" size={15} color="var(--ac-cyan)" />
      </span>
      <span>{children}</span>
    </div>
  );
}

/** An empty state that says what is missing and what would fill it — better
 * than inventing rows so a screen looks populated. */
export function NotConnected({ icon, title, children }: { icon: string; title: string; children: ReactNode }) {
  return (
    <div className="ac-card ac-in" style={{ padding: "48px 28px", display: "flex", flexDirection: "column", alignItems: "center", gap: 12, textAlign: "center" }}>
      <div style={{ width: 52, height: 52, borderRadius: 15, background: "var(--ac-raised)", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Icon name={icon} size={24} color="var(--ac-ink-3)" />
      </div>
      <div style={{ fontSize: 16, fontWeight: 700, color: "var(--ac-ink)" }}>{title}</div>
      <div style={{ fontSize: 13.5, lineHeight: 1.6, color: "var(--ac-ink-2)", maxWidth: 440 }}>{children}</div>
    </div>
  );
}

export function Avatar({ initials, size = 28 }: { initials: string; size?: number }) {
  return (
    <span
      style={{
        width: size,
        height: size,
        flex: "0 0 auto",
        borderRadius: Math.round(size / 3.2),
        background: "var(--ac-accent-soft)",
        color: "var(--ac-accent)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: initials.length > 2 ? 9.5 : 11,
        fontWeight: 700,
      }}
    >
      {initials}
    </span>
  );
}

export function Tag({ children }: { children: ReactNode }) {
  return (
    <span style={{ fontSize: 11, fontWeight: 600, color: "var(--ac-ink-2)", background: "var(--ac-raised)", border: "1px solid var(--ac-line)", padding: "3px 8px", borderRadius: 6 }}>
      {children}
    </span>
  );
}

export function KeyValues({ rows }: { rows: Array<[string, string]> }) {
  return (
    <dl style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: "7px 16px", margin: 0, fontSize: 13 }}>
      {rows.map(([k, v]) => (
        <div key={k} style={{ display: "contents" }}>
          <dt style={{ color: "var(--ac-ink-3)", whiteSpace: "nowrap" }}>{k}</dt>
          <dd style={{ margin: 0, color: "var(--ac-ink-2)", lineHeight: 1.5 }}>{v}</dd>
        </div>
      ))}
    </dl>
  );
}
