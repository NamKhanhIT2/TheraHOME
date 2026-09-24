import type { AppLinks } from "@/lib/siteContent";
import type { LegalLanguage } from "@/lib/appLegalContent";

const COPY: Record<LegalLanguage, { appStoreTop: string; playTop: string; soonTop: string }> = {
  vi: { appStoreTop: "Tải về trên", playTop: "Tải về trên", soonTop: "Sắp có trên" },
  en: { appStoreTop: "Download on the", playTop: "GET IT ON", soonTop: "COMING SOON ON" },
  ms: { appStoreTop: "Muat turun di", playTop: "DAPATKANNYA DI", soonTop: "AKAN DATANG DI" },
};

function AppleMark() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">
      <path d="M16.37 12.63c-.02-2.3 1.88-3.4 1.97-3.46-1.07-1.57-2.74-1.78-3.33-1.8-1.42-.14-2.77.83-3.49.83-.72 0-1.83-.81-3.01-.79-1.55.02-2.98.9-3.78 2.29-1.61 2.8-.41 6.93 1.16 9.2.77 1.11 1.68 2.35 2.88 2.31 1.16-.05 1.59-.75 2.99-.75 1.4 0 1.79.75 3.01.72 1.24-.02 2.03-1.13 2.79-2.24.88-1.29 1.24-2.53 1.26-2.6-.03-.01-2.42-.93-2.45-3.71zM14.08 5.87c.64-.77 1.07-1.85.95-2.92-.92.04-2.03.61-2.69 1.38-.59.68-1.11 1.77-.97 2.82 1.03.08 2.07-.52 2.71-1.28z" />
    </svg>
  );
}

function PlayMark() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M3.6 2.3 13.4 12l-9.8 9.7c-.35-.2-.6-.6-.6-1.1V3.4c0-.5.25-.9.6-1.1z" fill="#00d7fe" />
      <path d="m16.7 8.7-3.3 3.3-9.8-9.7c.3-.2.8-.2 1.2 0l11.9 6.4z" fill="#00f076" />
      <path d="m16.7 15.3-11.9 6.4c-.4.2-.9.2-1.2 0l9.8-9.7 3.3 3.3z" fill="#ff3a44" />
      <path d="m20.4 13.3-3.7 2L13.4 12l3.3-3.3 3.7 2c1.1.6 1.1 2 0 2.6z" fill="#ffd400" />
    </svg>
  );
}

/** App Store / Google Play buttons for /app.
 *
 * Links come from Admin → Nội dung website → app_links. Both buttons always
 * show: a store whose link is still empty (Google Play, while Android is in
 * closed testing and its public listing would 404) renders as a muted
 * "coming soon" badge that is not a link. Filling the field in Admin turns it
 * into the real button within a minute, no deploy. */
export function StoreBadges({ links, language }: { links: AppLinks; language: LegalLanguage }) {
  const copy = COPY[language];
  return (
    <div className="al-badges">
      {links.appStore ? (
        <a className="al-badge" href={links.appStore} target="_blank" rel="noreferrer">
          <AppleMark />
          <span><small>{copy.appStoreTop}</small><strong>App Store</strong></span>
        </a>
      ) : (
        <span className="al-badge is-soon" aria-disabled="true">
          <AppleMark />
          <span><small>{copy.soonTop}</small><strong>App Store</strong></span>
        </span>
      )}
      {links.playStore ? (
        <a className="al-badge" href={links.playStore} target="_blank" rel="noreferrer">
          <PlayMark />
          <span><small>{copy.playTop}</small><strong>Google Play</strong></span>
        </a>
      ) : (
        <span className="al-badge is-soon" aria-disabled="true">
          <PlayMark />
          <span><small>{copy.soonTop}</small><strong>Google Play</strong></span>
        </span>
      )}
    </div>
  );
}
