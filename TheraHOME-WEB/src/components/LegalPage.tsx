import type { ReactNode } from "react";
import { getLegalDoc, type LegalDocKey, type LegalLanguage } from "@/lib/appLegalContent";
import { supabase } from "@/lib/supabase";
import { LEGAL_LANGUAGES } from "@/lib/legalLanguage";
import { LegalDocBody } from "@/components/LegalDocBody";

/** Footer link wording per language. The documents themselves were already
 * translated; only this chrome was still Vietnamese-only, which is what made
 * an English reader land on an English policy wrapped in Vietnamese links. */
const CHROME: Record<LegalLanguage, { terms: string; privacy: string; deletion: string; language: string }> = {
  vi: {
    terms: "Điều khoản sử dụng",
    privacy: "Chính sách quyền riêng tư",
    deletion: "Xoá tài khoản",
    language: "Ngôn ngữ",
  },
  en: {
    terms: "Terms of Use",
    privacy: "Privacy Policy",
    deletion: "Delete account",
    language: "Language",
  },
  ms: {
    terms: "Terma Penggunaan",
    privacy: "Dasar Privasi",
    deletion: "Padam akaun",
    language: "Bahasa",
  },
};

const linkStyle = { color: "var(--color-primary, #007fd9)" } as const;

/** Shared chrome for the public, unauthenticated legal pages (/privacy,
 * /terms, /account-deletion) — no auth, outside every AccessGate.
 *
 * The language switcher is not decoration: Google Play takes a single
 * privacy-policy URL for the whole app, so this one page has to serve the UK,
 * Malaysian and Vietnamese listings at once. Each choice is a real link with
 * `?lang=`, so it survives being copied or bookmarked, and it works with
 * JavaScript off — which is how a store reviewer's tooling often reads it. */
export function LegalShell({
  title,
  language,
  children,
  headingInBody = false,
}: {
  title: string;
  language: LegalLanguage;
  children: ReactNode;
  /** The legal documents open with their own centred masthead, so the shell
   * must not print a second <h1> above it — which is exactly what the page
   * did, showing the title twice. /account-deletion has no such masthead and
   * keeps the default. */
  headingInBody?: boolean;
}) {
  const chrome = CHROME[language];
  return (
    <main
      lang={language}
      style={{
        maxWidth: 820,
        margin: "0 auto",
        padding: "32px 20px 64px",
        fontFamily: "var(--font-family, system-ui, sans-serif)",
        color: "var(--text-primary, #16213a)",
        lineHeight: 1.65,
      }}
    >
      <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "baseline", justifyContent: "space-between" }}>
        <p style={{ fontWeight: 700, fontSize: 14, color: "var(--color-primary, #007fd9)", marginBottom: 6 }}>TheraHOME</p>
        <nav aria-label={chrome.language} style={{ fontSize: 13, display: "flex", gap: 10, flexWrap: "wrap" }}>
          {LEGAL_LANGUAGES.map((entry) =>
            entry.code === language ? (
              <span key={entry.code} aria-current="true" style={{ fontWeight: 600, color: "var(--text-primary, #1c2733)" }}>
                {entry.label}
              </span>
            ) : (
              <a key={entry.code} href={`?lang=${entry.code}`} hrefLang={entry.code} style={linkStyle}>
                {entry.label}
              </a>
            ),
          )}
        </nav>
      </div>

      {/* The document sits on a card, the way a printed policy sits on a
          sheet: it gives the text a measure, an edge, and somewhere for the
          page tint to show through. */}
      <article
        style={{
          marginTop: 20,
          padding: "clamp(24px, 5vw, 48px)",
          background: "var(--bg-card, #ffffff)",
          borderRadius: 20,
          boxShadow: "0 1px 2px rgba(22,33,58,0.04), 0 12px 32px rgba(22,33,58,0.06)",
        }}
      >
        {headingInBody ? null : (
          <h1 style={{ margin: "0 0 20px", fontSize: 28, fontWeight: 800 }}>{title}</h1>
        )}
        {children}
      </article>

      <footer
        style={{
          marginTop: 48,
          paddingTop: 16,
          borderTop: "1px solid var(--divider, #e3e9f0)",
          fontSize: 13,
          color: "var(--text-muted, #7b8794)",
        }}
      >
        <a href={`/terms?lang=${language}`} style={{ ...linkStyle, marginRight: 16 }}>{chrome.terms}</a>
        <a href={`/privacy?lang=${language}`} style={{ ...linkStyle, marginRight: 16 }}>{chrome.privacy}</a>
        <a href={`/account-deletion?lang=${language}`} style={linkStyle}>{chrome.deletion}</a>
      </footer>
    </main>
  );
}


/** The admin override if there is one, else the document compiled into the
 * bundle. A failed read is not allowed to blank a legal page: these URLs are
 * filed with Apple and Google, and an empty privacy policy is worse than a
 * slightly stale one. */
async function resolveLegalDoc(docKey: LegalDocKey, language: LegalLanguage) {
  const fallback = getLegalDoc(docKey, language);
  try {
    const { data, error } = await supabase
      .from("legal_documents")
      .select("title, body")
      .eq("doc_key", docKey)
      .eq("language", language)
      .maybeSingle();
    if (error) throw error;
    if (data?.body?.trim()) {
      return { title: data.title?.trim() || fallback.title, text: data.body };
    }
  } catch (e) {
    console.error("Unable to read the legal override, using the bundled text", e);
  }
  return fallback;
}

/** Public, unauthenticated rendering of one of the app's legal documents —
 * App Store Connect requires the privacy policy (and ideally the terms) to
 * be reachable at a plain web URL with no login.
 *
 * The admin console has had a legal editor (Nội dung ứng dụng → Nội dung pháp
 * lý, writing `legal_documents`) since before these pages existed, but only the
 * mobile app read it — so publishing a new policy changed the app and left the
 * very URLs the stores were given showing the old text. Now both read the same
 * override, with the bundled document as the fallback when no override exists
 * (which is the case today: the table is empty).
 *
 * `legal_documents` grants SELECT to `anon`, so this works with no session. */
export async function LegalPage({ docKey, language }: { docKey: LegalDocKey; language: LegalLanguage }) {
  const doc = await resolveLegalDoc(docKey, language);
  return (
    <LegalShell title={doc.title} language={language} headingInBody>
      <LegalDocBody text={doc.text} />
    </LegalShell>
  );
}
