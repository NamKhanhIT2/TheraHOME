"use client";

// Kích hoạt — the web twin of the app's `TheraHOME-APP/app/activate.tsx`.
//
// Same screen, same RPC, same normalisation, same error messages. A customer
// who signs in on the web with no programme now unlocks it here instead of
// being told to go and fetch their phone.
//
// Only the app's FIRST-TIME CLAIM mode is ported. The app has a second mode
// (`activate_product_by_contact`, reached from a locked device card) for
// redeeming a second device bought under a different contact; the web roadmap
// shows one programme and has no locked device cards to press, so there is no
// way to reach that mode here. When the web grows a device list, that mode
// comes with it — do not bolt it onto this panel without the card that
// supplies `productId`.
//
// `toE164` is copied VERBATIM from the app and must stay that way. It carries
// a known quirk — typing the dial code into the number box double-prefixes it
// (+8484…) — which the owner reviewed on 2026-09-13 and chose not to fix. The
// point is that both surfaces are wrong in exactly the same way, so a contact
// that activates on the phone activates here and vice versa. Diverging
// "helpfully" would be the actual bug.
import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { supabase } from "@/lib/supabase";

/** The dialling code each of onboarding's country options maps to. Copied from
 * the app's DIALLING_CODE_BY_MARKET. */
const CODE_BY_MARKET: Record<string, string> = { US: "1", VN: "84", MALAY: "60" };

/** Same four entries, same order, same names as the app's picker. */
const DIALLING_CODES: { code: string; label: string }[] = [
  { code: "1", label: "Hoa Kỳ / Canada" },
  { code: "84", label: "Việt Nam" },
  { code: "60", label: "Malaysia" },
  { code: "44", label: "Vương quốc Anh" },
];

/** Compose what the database stores: E.164, no separators. A domestic number's
 * leading trunk zero is dropped — it is not part of the international form, and
 * sending "+84 0912…" would store a number that matches no order. */
function toE164(diallingCode: string, typed: string): string {
  const digits = typed.replace(/[^0-9]/g, "").replace(/^0+/, "");
  return digits ? `+${diallingCode}${digits}` : "";
}

/** The app's error branches, in the app's order, with the app's Vietnamese
 * copy (src/lib/i18n.ts). Same failure must read the same on both surfaces —
 * a customer who screenshots this for CSKH should produce the sentence CSKH
 * already knows. */
function messageForError(raw: string): string {
  if (raw.includes("contact_already_claimed")) return "Số điện thoại/email này đã được sử dụng bởi một tài khoản khác.";
  if (raw.includes("account_already_has_contact")) return "Tài khoản này đã liên kết với một số điện thoại/email khác.";
  if (raw.includes("activation_contact_not_found")) return "Số điện thoại/email này chưa được đăng ký kích hoạt cho sản phẩm này. Vui lòng liên hệ TheraHOME.";
  if (raw.includes("order_contact_not_found")) return "Số điện thoại/email này chưa được đăng ký kích hoạt. Vui lòng liên hệ TheraHOME để được thêm vào danh sách.";
  if (raw.includes("invalid_contact")) return "Số điện thoại/email không đúng định dạng.";
  return "Có lỗi xảy ra, vui lòng thử lại.";
}

const BENEFITS = [
  "Xem đầy đủ lộ trình phù hợp với thiết bị của bạn",
  "Đồng bộ tiến trình tập luyện mỗi ngày",
];

const wrap: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: 14,
  width: "100%",
  maxWidth: 540,
  margin: "0 auto",
  padding: "clamp(24px, 4vh, 44px) 0",
  textAlign: "center",
};

function Icon({ d, size = 18, strokeWidth = 1.7 }: { d: string; size?: number; strokeWidth?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flex: "0 0 auto" }}>
      {d.split("|").map((p, i) => <path key={i} d={p} />)}
    </svg>
  );
}

const SHIELD = "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z|m9 12 2 2 4-4";
const MAIL = "M4 5h16a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z|m3 7 9 6 9-6";
const PHONE = "M7 2h10a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1z|M12 18h.01";
const CHECK = "m5 13 4 4L19 7";
const LOCK = "M5 11h14v10H5z|M8 11V7a4 4 0 0 1 8 0v4";

export function ActivationPanel({ market, onActivated }: { market: string | null; onActivated: () => void }) {
  const [contact, setContact] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [code, setCode] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // An email needs no dial code, so the selector disappears — exactly the
  // app's `!isEmail` condition, driven by the same "does it contain @" test.
  const isEmail = contact.includes("@");
  // Preselect from the country the customer answered during onboarding. The
  // app reads useMarket(); here the profile row is the only source the browser
  // has. Falling back to +84 matches the app's own fallback for a Vietnamese
  // interface, and it stays only a preselection — 'US' spans +1 and +44.
  const activeCode = code ?? CODE_BY_MARKET[market ?? ""] ?? "84";
  const submitted = useMemo(
    () => (isEmail ? contact.trim() : toE164(activeCode, contact)),
    [isEmail, contact, activeCode],
  );

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  async function confirm() {
    if (!submitted || submitting) return;
    setSubmitting(true);
    setError("");
    try {
      const { data, error: rpcError } = await supabase.rpc("claim_user_access_contact", { p_contact: submitted });
      if (rpcError) throw rpcError;
      // The RPC succeeding with no rows means it matched nothing — the app
      // treats that as its own message, not as success.
      if (!data || (Array.isArray(data) && data.length === 0)) {
        setError("Không thể xác nhận thông tin này. Vui lòng kiểm tra lại.");
        return;
      }
      onActivated();
    } catch (e) {
      setError(messageForError(e instanceof Error ? e.message : String(e)));
      console.error("claim_user_access_contact failed", e);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div style={wrap}>
      <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 62, height: 62, borderRadius: "50%", background: "rgba(0,127,217,0.14)", color: "var(--color-primary)" }}>
        <Icon d={SHIELD} size={29} />
      </span>

      <h1 style={{ margin: 0, fontSize: "clamp(25px, 3vw, 34px)", fontWeight: 600, letterSpacing: "-0.02em", color: "#fff" }}>
        Xác nhận thông tin đặt hàng
      </h1>
      <p style={{ margin: 0, fontSize: 16, lineHeight: 1.65, color: "rgba(255,255,255,0.64)" }}>
        Nhập số điện thoại hoặc email bạn đã dùng khi đặt hàng TheraHOME để mở khoá toàn bộ lộ trình tập luyện.
      </p>

      <ul style={{ listStyle: "none", margin: "10px 0 0", padding: 0, display: "flex", flexDirection: "column", gap: 11, width: "100%", textAlign: "left" }}>
        {BENEFITS.map((b) => (
          <li key={b} style={{ display: "flex", alignItems: "center", gap: 11, fontSize: 14.5, color: "rgba(255,255,255,0.7)" }}>
            <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 22, height: 22, borderRadius: "50%", background: "rgba(52,199,89,0.16)", color: "#7BE39B" }}>
              <Icon d={CHECK} size={12} strokeWidth={3} />
            </span>
            {b}
          </li>
        ))}
      </ul>

      <form
        onSubmit={(e) => { e.preventDefault(); void confirm(); }}
        style={{ width: "100%", marginTop: 12, display: "flex", flexDirection: "column", gap: 12, padding: "clamp(18px, 2.2vw, 24px)", borderRadius: "var(--radius-lg, 24px)", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10, height: 54, padding: "0 14px", borderRadius: "var(--radius-md, 14px)", background: "rgba(255,255,255,0.05)", border: `1px solid ${error ? "rgba(255,105,97,0.65)" : "rgba(255,255,255,0.12)"}` }}>
          <span style={{ color: "rgba(255,255,255,0.45)", display: "inline-flex" }}>
            <Icon d={isEmail ? MAIL : PHONE} size={19} />
          </span>

          {/* The app opens a modal list; on a pointer device the native select
              IS the list — keyboard-operable and screen-reader-labelled for
              free. Same four codes, same order. */}
          {!isEmail ? (
            <label style={{ position: "relative", display: "inline-flex", alignItems: "center", color: "#fff", fontSize: 15.5 }}>
              <span aria-hidden="true" style={{ pointerEvents: "none" }}>+{activeCode} ▾</span>
              <select
                value={activeCode}
                onChange={(e) => setCode(e.target.value)}
                aria-label="Mã vùng quốc gia"
                style={{ position: "absolute", inset: 0, width: "100%", opacity: 0, cursor: "pointer", fontFamily: "inherit" }}
              >
                {DIALLING_CODES.map((entry) => (
                  <option key={entry.code} value={entry.code}>+{entry.code} · {entry.label}</option>
                ))}
              </select>
            </label>
          ) : null}

          <input
            ref={inputRef}
            value={contact}
            onChange={(e) => { setContact(e.target.value); if (error) setError(""); }}
            placeholder="Số điện thoại hoặc email"
            autoComplete="tel"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            style={{ flex: 1, minWidth: 0, height: "100%", border: "none", outline: "none", background: "transparent", color: "#fff", fontSize: 15.5, fontFamily: "inherit" }}
          />
        </div>

        {error ? (
          <p role="alert" style={{ margin: 0, fontSize: 13.5, lineHeight: 1.55, color: "#FF8F87", textAlign: "left" }}>{error}</p>
        ) : null}

        <button
          type="submit"
          disabled={!submitted || submitting}
          style={{ height: 52, borderRadius: "var(--radius-md, 14px)", border: "none", background: !submitted || submitting ? "rgba(0,127,217,0.4)" : "var(--color-primary)", color: "#fff", fontSize: 15.5, fontWeight: 600, fontFamily: "inherit", cursor: !submitted || submitting ? "default" : "pointer" }}
        >
          {submitting ? "Đang xác nhận..." : "Xác nhận và mở khoá lộ trình"}
        </button>
      </form>

      <p style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 7, margin: "6px 0 0", fontSize: 12.5, color: "rgba(255,255,255,0.4)" }}>
        <Icon d={LOCK} size={13} />
        Không cần mã kích hoạt thiết bị · Thông tin của bạn được bảo mật
      </p>
    </div>
  );
}
