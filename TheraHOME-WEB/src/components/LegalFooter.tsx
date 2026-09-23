import { getSiteContent } from "@/lib/siteContent";
import type { LegalLanguage } from "@/lib/appLegalContent";

/** Company registration line. Left empty on purpose: no tax code exists
 * anywhere in this repo and one must never be guessed on a legal page. Fill in
 * the owner-supplied number (and issuing authority/date) and the line appears. */
const COMPANY_TAX_LINE = "";

const COPY: Record<LegalLanguage, { tagline: string; contact: string; terms: string; privacy: string; deletion: string; rights: string }> = {
  vi: {
    tagline: "Thiết bị trị liệu tại nhà cùng lộ trình tập luyện mỗi ngày, cho cổ, vai, gáy khoẻ hơn.",
    contact: "Liên hệ",
    terms: "Điều khoản sử dụng",
    privacy: "Chính sách quyền riêng tư",
    deletion: "Xoá tài khoản",
    rights: "Mọi quyền được bảo lưu.",
  },
  en: {
    tagline: "At-home therapy devices with a daily training roadmap for a healthier neck and shoulders.",
    contact: "Contact",
    terms: "Terms of Use",
    privacy: "Privacy Policy",
    deletion: "Delete account",
    rights: "All rights reserved.",
  },
  ms: {
    tagline: "Peranti terapi di rumah dengan pelan latihan harian untuk leher dan bahu yang lebih sihat.",
    contact: "Hubungi",
    terms: "Terma Penggunaan",
    privacy: "Dasar Privasi",
    deletion: "Padam akaun",
    rights: "Hak cipta terpelihara.",
  },
};

const muted = "var(--text-muted, #6e7683)";
const body = "var(--text-secondary, #59616d)";
const ink = "var(--text-primary, #16213a)";
// The footer sits on the page tint (--bg-app #eef3fb), not on a white card.
// Every border token is tuned for white — --border-light is #e7ecf3, all but
// identical to the tint — so the rules vanished (owner report 2026-09-22).
// Mixing the muted text colour gives a line that reads on the tint and stays
// derived from the palette rather than a new hand-picked hex.
const rule = "1px solid color-mix(in srgb, var(--text-muted, #6e7683) 35%, transparent)";

/** Contact icons on a 24 grid, drawn rather than typed: the footer used the
 * characters "f", "✉", "☎" and "⌖", which every platform renders in its own
 * way — the phone came out as a 1950s handset (owner 2026-09-23).
 *
 * Facebook is the only brand mark here, so it keeps Meta's own blue and its
 * own shape, unaltered — that is what Meta's brand guidelines allow when a
 * mark simply links to your own page. The other three belong to no brand and
 * take TheraHOME's blue. */
const FACEBOOK_BLUE = "#1877F2";

const ICONS: Record<"facebook" | "mail" | "phone" | "pin", { node: React.ReactNode; color: string; filled?: boolean }> = {
  facebook: {
    node: (
      <path d="M22 12.06C22 6.5 17.52 2 12 2S2 6.5 2 12.06c0 5.02 3.66 9.18 8.44 9.94v-7.03H7.9v-2.91h2.54V9.85c0-2.52 1.49-3.91 3.77-3.91 1.09 0 2.24.2 2.24.2v2.46h-1.26c-1.24 0-1.63.78-1.63 1.57v1.89h2.78l-.45 2.91h-2.33V22c4.78-.76 8.44-4.92 8.44-9.94z" />
    ),
    color: FACEBOOK_BLUE,
    filled: true,
  },
  mail: {
    node: (<><rect x="3" y="5.5" width="18" height="13" rx="2.5" /><path d="m4 7.5 8 5.5 8-5.5" /></>),
    color: "var(--color-primary, #007fd9)",
  },
  phone: {
    node: <path d="M7.5 3.8h-2A2 2 0 0 0 3.6 6c.5 7.5 6.9 13.9 14.4 14.4a2 2 0 0 0 2.1-1.9v-2a1.6 1.6 0 0 0-1.3-1.6l-2.5-.5a1.6 1.6 0 0 0-1.6.7l-.8 1.2a13 13 0 0 1-5.6-5.6l1.2-.8c.6-.4.8-1 .7-1.6l-.5-2.5a1.6 1.6 0 0 0-1.6-1.3z" />,
    color: "var(--color-primary, #007fd9)",
  },
  pin: {
    node: (<><path d="M12 21s7-5.5 7-11a7 7 0 1 0-14 0c0 5.5 7 11 7 11z" /><circle cx="12" cy="10" r="2.6" /></>),
    color: "var(--color-primary, #007fd9)",
  },
};

function Row({ icon, children }: { icon: keyof typeof ICONS; children: React.ReactNode }) {
  const { node, color, filled } = ICONS[icon];
  return (
    <span style={{ display: "flex", alignItems: "center", gap: 10, minHeight: 32 }}>
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        width={18}
        height={18}
        fill={filled ? color : "none"}
        stroke={filled ? "none" : color}
        strokeWidth={1.7}
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ flex: "none" }}
      >
        {node}
      </svg>
      <span>{children}</span>
    </span>
  );
}

/** Footer for the public legal pages, laid out after pacerai.vn's: brand and a
 * contact column, then the company line, the policy links and the copyright.
 *
 * Deliberately not LandingFooter: that one is styled for the dark landing and
 * reads a client context these server pages are not wrapped in. The data is
 * the same though — contact and social links come from Admin → Nội dung
 * website via getSiteContent(), so editing them there updates this too. */
export async function LegalFooter({ language }: { language: LegalLanguage }) {
  const copy = COPY[language];
  const { contact, social } = await getSiteContent();
  const link = { color: body, textDecoration: "none" } as const;

  return (
    <footer style={{ marginTop: 48, paddingTop: 32, borderTop: rule, fontSize: 14, color: body }}>
      <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: 28 }}>
        <div style={{ flex: "1 1 280px", maxWidth: 440, display: "flex", flexDirection: "column", gap: 10 }}>
          <span style={{ fontSize: 20, fontWeight: 700, letterSpacing: "-0.015em", color: ink }}>Thera<span style={{ color: "var(--color-primary, #007fd9)" }}>HOME</span></span>
          <span style={{ lineHeight: 1.6 }}>{copy.tagline}</span>
        </div>

        <div style={{ flex: "0 1 280px", display: "flex", flexDirection: "column", gap: 10 }}>
          <span style={{ fontSize: 15, fontWeight: 700, color: ink }}>{copy.contact}</span>
          {social.facebook ? (
            <Row icon="facebook"><a href={social.facebook} target="_blank" rel="noreferrer" style={link}>Facebook</a></Row>
          ) : null}
          {contact.email ? (
            <Row icon="mail"><a href={`mailto:${contact.email}`} style={link}>{contact.email}</a></Row>
          ) : null}
          {contact.phone ? (
            <Row icon="phone"><a href={contact.phoneHref || `tel:${contact.phone}`} style={link}>{contact.phone}</a></Row>
          ) : null}
          {contact.address ? <Row icon="pin">{contact.address}</Row> : null}
        </div>
      </div>

      <div style={{ marginTop: 28, paddingTop: 24, borderTop: rule, display: "flex", flexDirection: "column", alignItems: "center", gap: 12, textAlign: "center" }}>
        <span style={{ lineHeight: 1.6 }}>
          <strong style={{ color: ink }}>H-COMMERCE GLOBAL COMPANY LIMITED</strong>
          {contact.address ? ` · ${contact.address}` : null}
        </span>
        {COMPANY_TAX_LINE ? <span style={{ fontSize: 13, color: muted }}>{COMPANY_TAX_LINE}</span> : null}
        <nav style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: "8px 20px" }}>
          <a href={`/privacy?lang=${language}`} style={link}>{copy.privacy}</a>
          <a href={`/terms?lang=${language}`} style={link}>{copy.terms}</a>
          <a href={`/account-deletion?lang=${language}`} style={link}>{copy.deletion}</a>
        </nav>
        <span style={{ fontSize: 13, color: muted }}>© 2026 TheraHOME. {copy.rights}</span>
      </div>
    </footer>
  );
}
