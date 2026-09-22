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
const rule = "1px solid var(--border-light, #e7ecf3)";

function Row({ icon, children }: { icon: string; children: React.ReactNode }) {
  return (
    <span style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
      <span aria-hidden="true" style={{ width: 18, textAlign: "center", color: muted }}>{icon}</span>
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
          <span style={{ fontSize: 18, fontWeight: 800, color: ink }}>TheraHOME</span>
          <span style={{ lineHeight: 1.6 }}>{copy.tagline}</span>
        </div>

        <div style={{ flex: "0 1 280px", display: "flex", flexDirection: "column", gap: 10 }}>
          <span style={{ fontSize: 15, fontWeight: 700, color: ink }}>{copy.contact}</span>
          {social.facebook ? (
            <Row icon="f"><a href={social.facebook} target="_blank" rel="noreferrer" style={link}>Facebook</a></Row>
          ) : null}
          {contact.email ? (
            <Row icon="✉"><a href={`mailto:${contact.email}`} style={link}>{contact.email}</a></Row>
          ) : null}
          {contact.phone ? (
            <Row icon="☎"><a href={contact.phoneHref || `tel:${contact.phone}`} style={link}>{contact.phone}</a></Row>
          ) : null}
          {contact.address ? <Row icon="⌖">{contact.address}</Row> : null}
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
