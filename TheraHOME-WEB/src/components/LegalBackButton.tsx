"use client";

import { useRouter } from "next/navigation";

/** "← Back" for the public legal pages, after pacerai.vn's policy page.
 *
 * With history it goes back to wherever the reader came from (the sign-up
 * form, the footer of the site, the app's store listing). Without history —
 * the URL pasted into a fresh tab, which is exactly how a store reviewer opens
 * it — `router.back()` would do nothing at all, so it falls back to the home
 * page instead. */
export function LegalBackButton({ label }: { label: string }) {
  const router = useRouter();
  return (
    <button
      type="button"
      onClick={() => (window.history.length > 1 ? router.back() : router.push("/"))}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        padding: "8px 16px",
        borderRadius: 10,
        border: "1px solid var(--border-input, #dce3ee)",
        background: "var(--bg-card, #ffffff)",
        color: "var(--text-primary, #16213a)",
        fontFamily: "inherit",
        fontSize: 14,
        fontWeight: 600,
        cursor: "pointer",
      }}
    >
      <span aria-hidden="true">←</span>
      {label}
    </button>
  );
}
