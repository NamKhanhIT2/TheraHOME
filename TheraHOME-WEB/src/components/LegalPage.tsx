import type { ReactNode } from "react";
import { legalContent, type LegalDocKey } from "@/lib/appLegalContent";

/** Shared chrome for the public, unauthenticated legal pages (/privacy,
 * /terms, /account-deletion) — no auth, outside every AccessGate. */
export function LegalShell({ title, children }: { title: string; children: ReactNode }) {
  return (
    <main
      style={{
        maxWidth: 760,
        margin: "0 auto",
        padding: "48px 20px 80px",
        fontFamily: "var(--font-family, system-ui, sans-serif)",
        color: "var(--text-primary, #1c2733)",
        lineHeight: 1.65,
      }}
    >
      <p style={{ fontWeight: 700, fontSize: 14, color: "var(--color-primary, #007fd9)", marginBottom: 6 }}>TheraHOME</p>
      <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 20 }}>{title}</h1>
      {children}
      <footer style={{ marginTop: 48, paddingTop: 16, borderTop: "1px solid var(--divider, #e3e9f0)", fontSize: 13, color: "var(--text-muted, #7b8794)" }}>
        <a href="/terms" style={{ color: "var(--color-primary, #007fd9)", marginRight: 16 }}>Điều khoản sử dụng</a>
        <a href="/privacy" style={{ color: "var(--color-primary, #007fd9)", marginRight: 16 }}>Chính sách quyền riêng tư</a>
        <a href="/account-deletion" style={{ color: "var(--color-primary, #007fd9)" }}>Xoá tài khoản</a>
      </footer>
    </main>
  );
}

/** Public, unauthenticated rendering of one of the app's legal documents —
 * App Store Connect requires the privacy policy (and ideally the terms) to
 * be reachable at a plain web URL with no login. Server component, static. */
export function LegalPage({ docKey }: { docKey: LegalDocKey }) {
  const doc = legalContent[docKey];
  return (
    <LegalShell title={doc.title}>
      <div style={{ whiteSpace: "pre-wrap", fontSize: 15, color: "var(--text-secondary, #3d4a58)" }}>{doc.text}</div>
    </LegalShell>
  );
}
