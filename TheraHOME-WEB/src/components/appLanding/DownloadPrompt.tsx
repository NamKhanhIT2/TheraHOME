"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

const DISMISS_KEY = "therahome.app-prompt.dismissed";
const SESSION_KEY = "therahome.app-prompt.closed";

/** The "Download TheraHOME" dialog pacerai.vn opens on arrival. It shows once
 * per visit a second after load; "Close" hides it for this tab, "Don't show
 * again" for good. Storage can throw (private mode, blocked site data), and
 * then the prompt simply behaves as if it had never been dismissed. */
export function DownloadPrompt({
  title,
  body,
  featuresTitle,
  features,
  dontShow,
  close,
  children,
}: {
  title: string;
  body: string;
  featuresTitle: string;
  features: string[];
  dontShow: string;
  close: string;
  /** The store buttons, rendered on the server. */
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    let seen = false;
    try {
      seen = localStorage.getItem(DISMISS_KEY) === "1" || sessionStorage.getItem(SESSION_KEY) === "1";
    } catch {}
    if (seen) return;
    const timer = window.setTimeout(() => setOpen(true), 1000);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") hide(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  function hide(forever: boolean) {
    try {
      if (forever) localStorage.setItem(DISMISS_KEY, "1");
      sessionStorage.setItem(SESSION_KEY, "1");
    } catch {}
    setOpen(false);
  }

  if (!open) return null;
  return (
    <div className="al-modal-scrim" onClick={() => hide(false)}>
      <div
        className="al-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="al-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="al-modal-head">
          <h2 id="al-modal-title">{title}</h2>
          <button type="button" className="al-modal-x" aria-label={close} onClick={() => hide(false)}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg>
          </button>
        </div>
        <div className="al-modal-body">
          <p>{body}</p>
          <div className="al-modal-features">
            <strong>{featuresTitle}</strong>
            <ul>
              {features.map((f) => (
                <li key={f}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m5 12 5 5 9-10" /></svg>
                  {f}
                </li>
              ))}
            </ul>
          </div>
          {children}
        </div>
        <div className="al-modal-foot">
          <button type="button" className="al-btn-ghost" onClick={() => hide(true)}>{dontShow}</button>
          <button type="button" className="al-btn-primary" ref={closeRef} onClick={() => hide(false)}>{close}</button>
        </div>
      </div>
    </div>
  );
}
