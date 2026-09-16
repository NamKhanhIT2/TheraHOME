"use client";

// Đăng nhập / Đăng ký — port of "Auth.dc.html", wired to real Supabase auth.
//
// The design mocks this: its submit handler writes a fake user to localStorage
// and navigates to the dashboard. Here the same form drives the real thing —
// the shared `auth-sign-in` Edge Function for password login (so web and the
// mobile TheraHOME-account screen behave identically), `supabase.auth.signUp`
// for registration, and the project's Google/Apple providers.
//
// Where you land afterwards is never decided here: resolvePostSignInRoute asks
// current_web_roles(), so an admin gets /admin, CSKH gets /care and a customer
// gets the public site. One door, three destinations.
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { signInWithTheraAccount } from "@/lib/theraAccountAuth";
import { resolvePostSignInRoute } from "@/lib/postSignInRoute";
import { BrandMark } from "@/components/landing/BrandMark";

export type AuthMode = "login" | "signup";

/** Password policy, identical to the app's isPasswordStrongEnough and the
 * admin-manage-account Edge Function: 8+ chars mixing a letter, a digit and a
 * special character. Enforced here because Supabase's own minimum is a
 * dashboard setting this code cannot reach. */
function isPasswordStrong(pw: string): boolean {
  return pw.length >= 8 && /[A-Za-z]/.test(pw) && /[0-9]/.test(pw) && /[^A-Za-z0-9]/.test(pw);
}

/** Mirrors the app's classify() so both clients name the same failure the same
 * way, rather than leaking a raw Postgres or GoTrue string at the customer. */
function authErrorMessage(raw: unknown, mode: AuthMode): string {
  const m = (raw instanceof Error ? raw.message : String(raw ?? "")).toLowerCase();
  if (m.includes("email_taken") || m.includes("already registered") || m.includes("already been registered")) {
    return "Email này đã có tài khoản. Bạn đăng nhập nhé.";
  }
  if (m.includes("email_not_confirmed")) return "Tài khoản chưa xác nhận email. Kiểm tra hộp thư giúp bạn nhé.";
  if (m.includes("invalid_credentials") || m.includes("invalid login credentials")) {
    return "Email hoặc mật khẩu không chính xác.";
  }
  if (m.includes("weak") || m.includes("password should be")) return "Mật khẩu chưa đủ mạnh.";
  if (m.includes("invalid email") || m.includes("unable to validate email")) return "Email không hợp lệ.";
  if (m.includes("rate limit") || m.includes("too many")) return "Bạn thử hơi nhiều lần. Chờ một lát rồi thử lại.";
  return mode === "signup" ? "Không tạo được tài khoản. Vui lòng thử lại." : "Không đăng nhập được. Vui lòng thử lại.";
}

const field: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 12,
  padding: "0 16px",
  height: 54,
  borderRadius: 16,
  background: "rgba(255,255,255,0.035)",
  border: "1px solid rgba(255,255,255,0.12)",
};

const BENEFITS = [
  "Lộ trình cá nhân hoá theo vị trí đau",
  "Đồng bộ thiết bị và lịch sử buổi tập",
  "Hỗ trợ trực tiếp trong suốt lộ trình",
];

function Check() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#4FB0F5" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flex: "0 0 auto" }}>
      <path d="M5 12.5 10 17l9-10" />
    </svg>
  );
}

export function AuthPanel({ mode }: { mode: AuthMode }) {
  const router = useRouter();
  const signup = mode === "signup";
  const [showPw, setShowPw] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  // Already signed in? Nothing on this screen applies — send them where they
  // belong. Also catches the OAuth return, which lands back here with a live
  // session rather than on a separate callback route.
  // Already signed in, or just came back from Google/Apple.
  //
  // getSession() alone is NOT enough, and that is what broke OAuth here: when
  // the browser lands back on /dang-nhap?code=…, supabase-js starts exchanging
  // that code asynchronously. Reading the session at that instant returns null,
  // the effect ends, and nothing ever runs again — so the customer came back
  // from Google and just saw the login form again. onAuthStateChange is the
  // half that catches the session once the exchange finishes; /verify has
  // always subscribed to it, and this screen has to as well.
  const navigating = useRef(false);
  /** Set by the effect below; onSubmit reuses it so there is one navigation path. */
  const goToDestinationRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    let cancelled = false;
    function goToDestination() {
      // Both this listener and onSubmit can reach here for the same sign-in.
      // First one wins; the second must not fire a competing navigation.
      if (cancelled || navigating.current) return;
      navigating.current = true;
      void (async () => {
        router.replace(await resolvePostSignInRoute());
      })();
    }

    void supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return;
      if (data.session) {
        goToDestination();
        return;
      }
      // No session and the provider sent us back with a complaint — say so
      // rather than silently re-showing an empty form. Supabase puts it in the
      // query string, or in the hash for the implicit flow.
      const params = new URLSearchParams(window.location.search);
      const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
      const reason = params.get("error_description") ?? params.get("error") ?? hash.get("error_description") ?? hash.get("error");
      if (reason) setError(`Đăng nhập không thành công: ${reason}`);
    });

    goToDestinationRef.current = goToDestination;

    // The callback MUST return immediately and MUST NOT be async.
    //
    // supabase-js holds the auth lock (navigator.locks) for the whole of
    // setSession(), and dispatches SIGNED_IN from inside it. Awaiting another
    // supabase call here — resolvePostSignInRoute() does an rpc, which needs
    // the session and therefore the same lock — deadlocks the pair: the
    // callback waits for the lock, setSession waits for the callback, and the
    // sign-in button sits on "Đang xử lý..." for ever with no error, because
    // nothing actually failed. Handing the work to setTimeout lets the
    // callback return, the lock release, and the rpc run normally.
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) setTimeout(goToDestination, 0);
    });
    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, [router]);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
    const f = e.currentTarget.elements as unknown as Record<string, HTMLInputElement | undefined>;
    const email = (f.email?.value ?? "").trim();
    const password = f.password?.value ?? "";
    setBusy(true);
    setError("");
    setNotice("");

    try {
      if (!signup) {
        await signInWithTheraAccount(email, password);
        // setSession above already fired SIGNED_IN, so the listener may have
        // started navigating; the ref makes whichever arrives second a no-op.
        goToDestinationRef.current?.();
        return;
      }

      const fullName = (f.name?.value ?? "").trim();
      const phone = (f.phone?.value ?? "").trim();
      if (!isPasswordStrong(password)) {
        setError("Mật khẩu cần ít nhất 8 ký tự, có cả chữ, số và ký tự đặc biệt.");
        return;
      }

      // full_name (not username): handle_new_user copies it straight onto the
      // profile, and unlike username it has no shape rule — which matters when
      // the field asks for a Vietnamese full name with spaces and diacritics.
      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: fullName, phone } },
      });
      if (signUpError) throw signUpError;

      // With email-enumeration protection on, a duplicate address does NOT
      // error — Supabase returns a decoy user with no identities. Treat that
      // as taken, exactly as the app does.
      if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
        setError(authErrorMessage("email_taken", "signup"));
        return;
      }

      if (!data.session) {
        // Project has "Confirm email" on — read off the result rather than
        // hard-coded, so flipping that toggle needs no change here.
        setNotice("Đã gửi email xác nhận. Mở hộp thư để kích hoạt tài khoản nhé.");
        return;
      }

      // Signed straight in. If they gave the phone they ordered with, try to
      // open their programme now — a failure here is normal (they may not have
      // bought yet) and must not surface as an error on a successful signup.
      if (phone) {
        try {
          await supabase.rpc("claim_user_access_contact", { p_contact: phone });
        } catch {
          /* not a customer yet, or already claimed — either is fine */
        }
      }
      goToDestinationRef.current?.();
    } catch (err) {
      console.error(signup ? "Sign-up failed" : "Sign-in failed", err);
      setError(authErrorMessage(err, mode));
    } finally {
      setBusy(false);
    }
  }

  async function oauth(provider: "google" | "apple") {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      // Back to this screen, whose effect above then routes by role. Keeps the
      // one-door model instead of a second callback page.
      const { error: e } = await supabase.auth.signInWithOAuth({
        provider,
        options: { redirectTo: `${window.location.origin}/dang-nhap` },
      });
      if (e) throw e;
      // The browser navigates away on success; nothing more happens here.
    } catch (err) {
      console.error(`${provider} sign-in failed`, err);
      setError("Không mở được đăng nhập. Vui lòng thử lại.");
      setBusy(false);
    }
  }

  return (
    <div style={{ position: "relative", minHeight: "100vh", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <div aria-hidden="true" style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse 52% 50% at 74% 42%, rgba(0,127,217,0.16), rgba(0,0,0,0) 70%)", animation: "landingGlowDrift 18s ease-in-out infinite", pointerEvents: "none" }} />
      <div aria-hidden="true" style={{ position: "absolute", right: "-12%", top: "50%", width: "min(620px, 76vw)", aspectRatio: "1", marginTop: "-38%", borderRadius: "50%", border: "1px dashed rgba(0,127,217,0.22)", animation: "landingSpin 70s linear infinite", pointerEvents: "none" }} />

      <nav style={{ position: "relative", zIndex: 2, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 24, padding: "22px clamp(20px, 4vw, 64px)" }}>
        <Link className="nav-logo" href="/" aria-label="TheraHome — về trang chủ" style={{ display: "inline-flex", alignItems: "center", gap: 11, color: "#fff" }}>
          <BrandMark size={30} glow />
          <span className="auth-nav-word" style={{ display: "inline-flex", alignItems: "baseline", fontSize: 19, lineHeight: 1, fontWeight: 600, letterSpacing: "-0.005em", color: "#8FC7E8" }}>TheraHome</span>
        </Link>
        <Link href="/" className="nav-auth nav-close" aria-label="Về trang chủ" title="Về trang chủ" style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 36, height: 36, borderRadius: 999, border: "1px solid rgba(255,255,255,0.16)", color: "rgba(255,255,255,0.8)" }}>
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M3.5 11.2 12 4l8.5 7.2" />
            <path d="M5.8 10v9.2h12.4V10" />
          </svg>
        </Link>
      </nav>

      <main className="auth-main" style={{ position: "relative", zIndex: 2, flex: 1, display: "flex", flexWrap: "wrap", alignItems: "center", gap: "clamp(36px, 6vw, 90px)", padding: "clamp(24px, 5vh, 64px) clamp(20px, 4vw, 64px) clamp(48px, 8vh, 90px)", maxWidth: 1240, width: "100%", margin: "0 auto", boxSizing: "border-box" }}>
        <section className="auth-aside" style={{ flex: "1 1 380px", minWidth: 0, display: "flex", flexDirection: "column", gap: 26, animation: "landingAuthIn 900ms cubic-bezier(0.16,1,0.3,1) 120ms both" }}>
          <span style={{ fontSize: 11, letterSpacing: "0.2em", textTransform: "uppercase", color: "var(--color-primary)" }}>Tài khoản TheraHome</span>
          <h1 style={{ margin: 0, fontSize: "clamp(30px, 3.4vw, 50px)", fontWeight: 600, lineHeight: 1.04, letterSpacing: "-0.02em", color: "#fff", maxWidth: "15ch", textWrap: "pretty" }}>
            {signup ? "Tạo tài khoản để bắt đầu lộ trình" : "Chào mừng trở lại"}
          </h1>
          <p style={{ margin: 0, maxWidth: 440, fontSize: 16.5, lineHeight: 1.68, color: "rgba(255,255,255,0.66)" }}>
            Một tài khoản dùng chung cho ứng dụng TheraAI và thiết bị: lộ trình 14 ngày, lịch sử buổi tập và hỗ trợ trực tiếp đều được đồng bộ.
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 14, paddingTop: 4 }}>
            {BENEFITS.map((b) => (
              <div key={b} style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 14.5, color: "rgba(255,255,255,0.78)" }}>
                <Check />
                <span>{b}</span>
              </div>
            ))}
          </div>
        </section>

        <section style={{ flex: "0 1 448px", minWidth: "min(320px, 100%)", display: "flex", flexDirection: "column", gap: 22, animation: "landingAuthIn 900ms cubic-bezier(0.16,1,0.3,1) 260ms both" }}>
          <Link className="nav-logo auth-lockup" href="/" aria-label="TheraHome — về trang chủ" style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 14, color: "#fff" }}>
            <BrandMark size={46} glow />
            <span style={{ display: "inline-flex", alignItems: "baseline", fontSize: 26, lineHeight: 1, fontWeight: 600, letterSpacing: "-0.005em", color: "#8FC7E8" }}>TheraHome</span>
          </Link>

          <div style={{ boxSizing: "border-box", display: "flex", flexDirection: "column", gap: 22, padding: "clamp(26px, 3vw, 38px)", borderRadius: 28, background: "rgba(255,255,255,0.045)", border: "1px solid rgba(255,255,255,0.10)", boxShadow: "0 50px 110px rgba(0,40,110,0.5)", backdropFilter: "blur(18px)" }}>
            {/* Real routes, not local state: the nav links straight to either
                one, and a half-filled form should not survive the switch. */}
            <div style={{ display: "flex", gap: 4, padding: 4, borderRadius: 999, background: "rgba(255,255,255,0.05)" }}>
              {([["login", "Đăng Nhập", "/dang-nhap"], ["signup", "Đăng Ký", "/dang-ky"]] as const).map(([m, label, href]) => {
                const on = mode === m;
                return (
                  <Link
                    key={m}
                    href={href}
                    className="auth-tab"
                    style={{ flex: 1, height: 42, display: "inline-flex", alignItems: "center", justifyContent: "center", borderRadius: 999, fontSize: 14, fontWeight: 600, letterSpacing: "0.01em", background: on ? "var(--color-primary)" : "transparent", color: on ? "#fff" : "rgba(255,255,255,0.66)", boxShadow: on ? "0 10px 24px rgba(0,127,217,0.3)" : "none" }}
                  >
                    {label}
                  </Link>
                );
              })}
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <h2 style={{ margin: 0, fontSize: 24, fontWeight: 600, letterSpacing: "-0.015em", color: "#fff" }}>
                {signup ? "Tạo tài khoản" : "Đăng nhập"}
              </h2>
              <p style={{ margin: 0, fontSize: 14, lineHeight: 1.55, color: "rgba(255,255,255,0.6)" }}>
                {signup ? "Chỉ mất một phút. Lộ trình của bạn được lưu ngay sau đó." : "Nhập email và mật khẩu để tiếp tục lộ trình của bạn."}
              </p>
            </div>

            <form onSubmit={onSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {signup ? (
                <label className="auth-field" style={field}>
                  <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="1.7" aria-hidden="true"><circle cx="12" cy="8" r="3.6" /><path d="M4.5 20c1.4-3.6 4.1-5.2 7.5-5.2s6.1 1.6 7.5 5.2" /></svg>
                  <input type="text" name="name" placeholder="Họ và tên" aria-label="Họ và tên" autoComplete="name" required />
                </label>
              ) : null}

              <label className="auth-field" style={field}>
                <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="1.7" aria-hidden="true"><rect x="3" y="5.5" width="18" height="13" rx="3" /><path d="m3.8 7 8.2 6 8.2-6" /></svg>
                <input type="email" name="email" placeholder="Email" aria-label="Email" autoComplete="email" required />
              </label>

              {signup ? (
                <label className="auth-field" style={field}>
                  <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="1.7" aria-hidden="true"><path d="M6.5 3.5h11a1.5 1.5 0 0 1 1.5 1.5v14a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 5 19V5a1.5 1.5 0 0 1 1.5-1.5z" /><path d="M10.5 17.5h3" /></svg>
                  <input type="tel" name="phone" placeholder="Số điện thoại đã đặt hàng" aria-label="Số điện thoại" autoComplete="tel" required />
                </label>
              ) : null}

              <label className="auth-field" style={field}>
                <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="1.7" aria-hidden="true"><rect x="4.5" y="10.5" width="15" height="9.5" rx="2.6" /><path d="M8.2 10.5V7.8a3.8 3.8 0 0 1 7.6 0v2.7" /></svg>
                <input type={showPw ? "text" : "password"} name="password" placeholder="Mật khẩu" aria-label="Mật khẩu" autoComplete={signup ? "new-password" : "current-password"} required />
                <button type="button" onClick={() => setShowPw((v) => !v)} aria-label={showPw ? "Ẩn mật khẩu" : "Hiện mật khẩu"} style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 30, height: 30, padding: 0, border: 0, borderRadius: 999, background: "transparent", color: "rgba(255,255,255,0.55)", cursor: "pointer" }}>
                  <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="M2.5 12S6 6.5 12 6.5 21.5 12 21.5 12S18 17.5 12 17.5 2.5 12 2.5 12z" /><circle cx="12" cy="12" r="2.8" /></svg>
                </button>
              </label>

              {signup ? (
                <label style={{ display: "flex", alignItems: "flex-start", gap: 10, fontSize: 13, lineHeight: 1.6, color: "rgba(255,255,255,0.64)", cursor: "pointer" }}>
                  <input type="checkbox" name="terms" required style={{ marginTop: 3, width: 16, height: 16, accentColor: "var(--color-primary)" }} />
                  <span>
                    Tôi đồng ý với <Link href="/terms" style={{ color: "#4FB0F5" }}>Điều khoản sử dụng</Link> và{" "}
                    <Link href="/privacy" style={{ color: "#4FB0F5" }}>Chính sách quyền riêng tư</Link>.
                  </span>
                </label>
              ) : (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 12, paddingTop: 2 }}>
                  {/* The design also has "Ghi nhớ đăng nhập". Supabase already
                      persists the session in localStorage and refreshes it, so
                      a checkbox that changes nothing would be a lie. */}
                  <Link href="/welcome" style={{ fontSize: 13.5, fontWeight: 600, color: "#4FB0F5" }}>Quên mật khẩu?</Link>
                </div>
              )}

              <button type="submit" disabled={busy} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, height: 54, marginTop: 4, border: 0, borderRadius: 999, background: "var(--color-primary)", color: "#fff", fontFamily: "inherit", fontSize: 15.5, fontWeight: 600, letterSpacing: "0.01em", cursor: busy ? "default" : "pointer", opacity: busy ? 0.6 : 1, boxShadow: "0 18px 40px rgba(0,127,217,0.34)" }}>
                <span>{busy ? "Đang xử lý..." : signup ? "Tạo tài khoản" : "Đăng nhập"}</span>
                {!busy ? (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M5 12h13M13 6l6 6-6 6" /></svg>
                ) : null}
              </button>
            </form>

            {error ? (
              <p role="alert" style={{ margin: 0, padding: "12px 14px", borderRadius: 14, background: "rgba(255,59,48,0.12)", border: "1px solid rgba(255,59,48,0.35)", fontSize: 13.5, lineHeight: 1.55, color: "#FFB4AE" }}>{error}</p>
            ) : null}
            {notice ? (
              <p role="status" style={{ margin: 0, padding: "12px 14px", borderRadius: 14, background: "rgba(53,196,106,0.12)", border: "1px solid rgba(53,196,106,0.35)", fontSize: 13.5, lineHeight: 1.55, color: "#9FE8B9" }}>{notice}</p>
            ) : null}

            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <span style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.12)" }} />
              <span style={{ fontSize: 12.5, color: "rgba(255,255,255,0.5)" }}>hoặc</span>
              <span style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.12)" }} />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <button type="button" className="auth-social" onClick={() => void oauth("apple")} disabled={busy} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, height: 50, borderRadius: 16, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.16)", color: "#fff", fontFamily: "inherit", fontSize: 14, fontWeight: 500, cursor: busy ? "default" : "pointer" }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="#fff" aria-hidden="true"><path d="M16.7 12.9c0-2.3 1.9-3.4 2-3.5-1.1-1.6-2.7-1.8-3.3-1.8-1.4-.1-2.6.8-3.3.8-.7 0-1.7-.8-2.9-.8-1.5 0-2.9.9-3.7 2.3-1.6 2.7-.4 6.8 1.1 9 .8 1.1 1.7 2.3 2.9 2.2 1.2 0 1.6-.7 3-.7s1.8.7 3 .7c1.2 0 2-1.1 2.8-2.2.9-1.3 1.2-2.5 1.3-2.6-.1 0-2.5-1-2.5-3.4zM14.4 5.9c.6-.8 1-1.8.9-2.9-.9.1-2 .6-2.7 1.4-.6.7-1 1.8-.9 2.8 1 .1 2-.5 2.7-1.3z" /></svg>
                <span>Apple</span>
              </button>
              <button type="button" className="auth-social" onClick={() => void oauth("google")} disabled={busy} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, height: 50, borderRadius: 16, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.16)", color: "#fff", fontFamily: "inherit", fontSize: 14, fontWeight: 500, cursor: busy ? "default" : "pointer" }}>
                <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path fill="#4285F4" d="M21.6 12.2c0-.7-.1-1.4-.2-2H12v3.9h5.4a4.6 4.6 0 0 1-2 3v2.5h3.2c1.9-1.7 3-4.3 3-7.4z" /><path fill="#34A853" d="M12 22c2.7 0 4.9-.9 6.6-2.4l-3.2-2.5c-.9.6-2 1-3.4 1a5.9 5.9 0 0 1-5.6-4.1H3.1v2.6A10 10 0 0 0 12 22z" /><path fill="#FBBC05" d="M6.4 14a6 6 0 0 1 0-3.8V7.6H3.1a10 10 0 0 0 0 8.9L6.4 14z" /><path fill="#EA4335" d="M12 6.1c1.5 0 2.8.5 3.8 1.5l2.8-2.8A10 10 0 0 0 3.1 7.6l3.3 2.6A5.9 5.9 0 0 1 12 6.1z" /></svg>
                <span>Google</span>
              </button>
            </div>

            <p style={{ margin: 0, textAlign: "center", fontSize: 14, color: "rgba(255,255,255,0.66)" }}>
              <span>{signup ? "Bạn đã có tài khoản?" : "Bạn mới biết đến TheraHome?"}</span>{" "}
              <Link href={signup ? "/dang-nhap" : "/dang-ky"} style={{ color: "#4FB0F5", fontWeight: 600 }}>
                {signup ? "Đăng nhập" : "Tạo tài khoản"}
              </Link>
            </p>
          </div>
        </section>
      </main>

      <footer style={{ position: "relative", zIndex: 2, display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 14, padding: "22px clamp(20px, 4vw, 64px) 32px", borderTop: "1px solid rgba(255,255,255,0.07)", fontSize: 13, color: "rgba(255,255,255,0.5)" }}>
        <span>Copyright © 2026 TheraHome. All Rights Reserved.</span>
        <div style={{ display: "flex", gap: 22 }}>
          <Link href="/terms" style={{ color: "rgba(255,255,255,0.66)" }}>Điều khoản sử dụng</Link>
          <Link href="/privacy" style={{ color: "rgba(255,255,255,0.66)" }}>Chính sách bảo mật</Link>
          <Link href="/gioi-thieu#lien-he" style={{ color: "rgba(255,255,255,0.66)" }}>Hỗ trợ</Link>
        </div>
      </footer>
    </div>
  );
}
