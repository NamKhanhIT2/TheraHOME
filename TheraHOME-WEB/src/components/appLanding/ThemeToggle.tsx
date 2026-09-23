"use client";

const COOKIE = "therahome-theme";

/** Sun/moon switch for /app, between the language menu and Download.
 *
 * Three states, not two: with no stored choice the page follows the device
 * (prefers-color-scheme); picking a side stores it and wins from then on.
 *
 * The choice is kept in a first-party cookie, so the SERVER already knows it
 * and stamps `data-app-theme` on the page — no boot script, no flash of the
 * wrong theme, and nothing for React to disagree with on hydration. The
 * button itself holds no state: it renders both icons and CSS shows the one
 * that matches, so server and browser render identical markup. */
export function ThemeToggle({ label }: { label: string }) {
  return (
    <button
      type="button"
      className="al-theme"
      aria-label={label}
      title={label}
      onClick={(e) => {
        const root = e.currentTarget.closest(".app-landing") as HTMLElement | null;
        if (!root) return;
        const dark =
          root.dataset.appTheme === "dark" ||
          (!root.dataset.appTheme && window.matchMedia("(prefers-color-scheme: dark)").matches);
        const next = dark ? "light" : "dark";
        root.dataset.appTheme = next;
        // A year, so the choice survives; SameSite=Lax, no other purpose.
        document.cookie = `${COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`;
      }}
    >
      <svg className="al-sun" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="12" cy="12" r="4.2" />
        <path d="M12 2.6v2.2M12 19.2v2.2M4.2 12H2M22 12h-2.2M6.3 6.3 4.8 4.8M19.2 19.2l-1.5-1.5M17.7 6.3l1.5-1.5M4.8 19.2l1.5-1.5" />
      </svg>
      <svg className="al-moon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M20 14.2A8.4 8.4 0 0 1 9.8 4a8.4 8.4 0 1 0 10.2 10.2z" />
      </svg>
    </button>
  );
}
