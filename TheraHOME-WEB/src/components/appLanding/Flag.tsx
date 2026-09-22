import type { LegalLanguage } from "@/lib/appLegalContent";

/** Flags drawn as SVG, not emoji: Windows renders flag emoji as two bare
 * letters, which is exactly the "VI" the flags are meant to replace. English
 * shows the UK flag (the store listing's market), Malay the Malaysian one. */
export function Flag({ code, size = 22 }: { code: LegalLanguage; size?: number }) {
  const h = Math.round((size * 2) / 3);
  return (
    <svg className="al-flag" width={size} height={h} viewBox="0 0 30 20" aria-hidden="true">
      {code === "vi" ? (
        <>
          <rect width="30" height="20" fill="#DA251D" />
          <path d="M15 4.2l1.35 4.15h4.37l-3.53 2.57 1.35 4.15L15 12.5l-3.54 2.57 1.35-4.15-3.53-2.57h4.37z" fill="#FFFF00" />
        </>
      ) : code === "en" ? (
        <>
          <rect width="30" height="20" fill="#012169" />
          <path d="M0 0l30 20M30 0L0 20" stroke="#fff" strokeWidth="4" />
          <path d="M0 0l30 20M30 0L0 20" stroke="#C8102E" strokeWidth="1.6" />
          <path d="M15 0v20M0 10h30" stroke="#fff" strokeWidth="6" />
          <path d="M15 0v20M0 10h30" stroke="#C8102E" strokeWidth="3.4" />
        </>
      ) : (
        <>
          <rect width="30" height="20" fill="#fff" />
          {Array.from({ length: 7 }, (_, i) => (
            <rect key={i} y={i * (20 / 7)} width="30" height={10 / 7} fill="#CC0001" />
          ))}
          <rect width="15" height={(20 / 14) * 8} fill="#010066" />
          <circle cx="6.4" cy="5.7" r="3.6" fill="#FC0" />
          <circle cx="7.4" cy="5.7" r="3" fill="#010066" />
          <path d="M11.3 3.2l.5 1.6 1.6-.4-1 1.3 1.4.9-1.6.2.2 1.6-1.1-1.2-1.1 1.2.2-1.6-1.6-.2 1.4-.9-1-1.3 1.6.4z" fill="#FC0" />
        </>
      )}
    </svg>
  );
}
