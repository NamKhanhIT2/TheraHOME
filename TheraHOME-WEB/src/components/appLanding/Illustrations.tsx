// Small flat drawings for the /app cards, after the mini illustrations on
// pacerai.vn's "How it works" and feature cards. One hue in five steps
// (classes .s0–.s4, defined in app-landing.css from the blue tokens), so the
// cards read as one family through light and dark rather than many colours.
// Each shows the real thing in the app: the 07:00 / 20:30 reminder slots are
// the app's own suggested times, the 14 tiles its 14-day roadmap.
import type { ReactNode } from "react";

export type IlloKind =
  | "signin" | "activate" | "daily" | "survey"
  | "roadmap" | "video" | "ai" | "reminder" | "community" | "support";

const Check = ({ x, y, r = 9 }: { x: number; y: number; r?: number }) => (
  <g>
    <circle cx={x} cy={y} r={r} className="s3" />
    <path d={`M${x - r * 0.42} ${y}l${r * 0.3} ${r * 0.32} ${r * 0.55}-${r * 0.62}`} className="stroke-s0" strokeWidth={2.2} fill="none" strokeLinecap="round" strokeLinejoin="round" />
  </g>
);

const DRAWINGS: Record<IlloKind, ReactNode> = {
  signin: (
    <>
      {[40, 100, 160].map((x, i) => (
        <rect key={x} x={x} y={32} width={44} height={44} rx={12} className={i === 1 ? "s4" : "s0 edge"} />
      ))}
      <text x={62} y={61} textAnchor="middle" className="glyph s3-text">G</text>
      <path d="M126 50c0-3 2.4-4.4 2.5-4.5-1.4-2-3.5-2.3-4.2-2.3-1.8-.2-3.5 1-4.4 1-.9 0-2.3-1-3.8-1-2 0-3.8 1.2-4.8 2.9-2 3.5-.5 8.8 1.5 11.7 1 1.4 2.1 3 3.6 2.9 1.5-.1 2-.9 3.8-.9 1.8 0 2.3.9 3.8.9 1.6 0 2.6-1.4 3.5-2.8 1.1-1.6 1.6-3.2 1.6-3.3 0 0-3.1-1.2-3.1-4.6zM123.1 41.4c.8-1 1.4-2.4 1.2-3.7-1.2 0-2.6.8-3.4 1.8-.7.9-1.4 2.2-1.2 3.6 1.3.1 2.6-.7 3.4-1.7z" className="s0" />
      <path d="M172 46h20v16h-20zM172 47l10 8 10-8" className="stroke-s3" fill="none" strokeWidth={2} strokeLinejoin="round" />
    </>
  ),
  activate: (
    <>
      <rect x={30} y={36} width={180} height={40} rx={20} className="s0 edge" />
      {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((i) => (
        <circle key={i} cx={56 + i * 11} cy={56} r={3} className={i < 4 ? "s3" : "s2"} />
      ))}
      <Check x={188} y={56} r={11} />
    </>
  ),
  daily: (
    <>
      {[0, 1, 2, 3, 4, 5, 6].map((i) => (
        <g key={i}>
          <rect x={22 + i * 29} y={34} width={23} height={44} rx={7} className={i < 4 ? "s3" : i === 4 ? "s0 edge-strong" : "s1"} />
          {i < 4 ? <path d={`M${29 + i * 29} 56l4 4 7-8`} className="stroke-s0" strokeWidth={2.2} fill="none" strokeLinecap="round" strokeLinejoin="round" /> : null}
        </g>
      ))}
      <rect x={22} y={88} width={196} height={6} rx={3} className="s1" />
      <rect x={22} y={88} width={120} height={6} rx={3} className="s3" />
    </>
  ),
  survey: (
    <>
      {[0, 1, 2].map((i) => (
        <g key={i}>
          <rect x={40} y={22 + i * 28} width={160} height={22} rx={11} className={i === 1 ? "s1 edge-strong" : "s0 edge"} />
          <circle cx={54} cy={33 + i * 28} r={5} className={i === 1 ? "s3" : "s0 edge"} />
          <rect x={68} y={30 + i * 28} width={i === 1 ? 90 : 70 + i * 14} height={6} rx={3} className={i === 1 ? "s3" : "s2"} />
        </g>
      ))}
    </>
  ),
  roadmap: (
    <>
      {Array.from({ length: 14 }, (_, i) => (
        <rect key={i} x={30 + (i % 7) * 27} y={28 + Math.floor(i / 7) * 32} width={20} height={24} rx={6} className={i < 9 ? "s3" : i === 9 ? "s0 edge-strong" : "s1"} />
      ))}
      <rect x={30} y={96} width={182} height={6} rx={3} className="s1" />
      <rect x={30} y={96} width={118} height={6} rx={3} className="s4" />
    </>
  ),
  video: (
    <>
      <rect x={50} y={18} width={140} height={78} rx={12} className="s2" />
      <circle cx={120} cy={57} r={18} className="s0" />
      <path d="M114 48v18l15-9z" className="s3" />
      <rect x={50} y={104} width={140} height={5} rx={2.5} className="s1" />
      <rect x={50} y={104} width={88} height={5} rx={2.5} className="s3" />
    </>
  ),
  ai: (
    <>
      <circle cx={48} cy={44} r={14} className="s3" />
      <circle cx={43} cy={43} r={2.4} className="s0" />
      <circle cx={53} cy={43} r={2.4} className="s0" />
      <rect x={70} y={28} width={120} height={30} rx={14} className="s1" />
      <rect x={82} y={40} width={70} height={6} rx={3} className="s3" />
      <rect x={98} y={70} width={110} height={30} rx={14} className="s3" />
      <rect x={112} y={82} width={60} height={6} rx={3} className="s0" />
    </>
  ),
  reminder: (
    <>
      <path d="M52 76V58a18 18 0 1 1 36 0v18l6 6H46z" className="s3" />
      <circle cx={70} cy={88} r={5} className="s3" />
      <rect x={112} y={34} width={92} height={28} rx={14} className="s4" />
      <text x={158} y={53} textAnchor="middle" className="time s0-text">07:00</text>
      <rect x={112} y={70} width={92} height={28} rx={14} className="s0 edge" />
      <text x={158} y={89} textAnchor="middle" className="time s3-text">20:30</text>
    </>
  ),
  community: (
    <>
      <rect x={40} y={18} width={160} height={86} rx={14} className="s0 edge" />
      <circle cx={62} cy={40} r={10} className="s2" />
      <rect x={80} y={34} width={60} height={6} rx={3} className="s3" />
      <rect x={80} y={44} width={36} height={5} rx={2.5} className="s1" />
      <rect x={54} y={60} width={130} height={6} rx={3} className="s1" />
      <rect x={54} y={71} width={100} height={6} rx={3} className="s1" />
      <path d="M62 94c-5-3-8-5.5-8-8.5a4 4 0 0 1 8-1 4 4 0 0 1 8 1c0 3-3 5.5-8 8.5z" className="s3" />
      <rect x={76} y={86} width={22} height={6} rx={3} className="s2" />
    </>
  ),
  support: (
    <>
      <circle cx={60} cy={60} r={22} className="s1" />
      <path d="M48 62a12 12 0 0 1 24 0v5h-5v-8h5M48 62v5h5v-8h-5" className="stroke-s4" fill="none" strokeWidth={2.4} strokeLinejoin="round" />
      <circle cx={77} cy={43} r={6} className="s4 ring" />
      <rect x={96} y={36} width={110} height={28} rx={14} className="s3" />
      <rect x={108} y={47} width={66} height={6} rx={3} className="s0" />
      <rect x={96} y={70} width={84} height={24} rx={12} className="s1" />
      <rect x={108} y={79} width={48} height={6} rx={3} className="s3" />
    </>
  ),
};

export function Illustration({ kind }: { kind: IlloKind }) {
  return (
    <div className="al-illo" aria-hidden="true">
      <svg viewBox="0 0 240 120" preserveAspectRatio="xMidYMid meet">{DRAWINGS[kind]}</svg>
    </div>
  );
}
