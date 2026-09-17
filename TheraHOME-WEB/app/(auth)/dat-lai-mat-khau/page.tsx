"use client";

// Where the password-reset email lands. Until this existed, "Quên mật khẩu?"
// on the customer sign-in pointed at /welcome — the STAFF console entrance,
// which offers no reset — so a customer who forgot their password had nowhere
// to go on the web at all (audit 2026-09-16).
//
// Supabase's recovery link carries its token in the URL fragment; the browser
// client exchanges it on load (detectSessionInUrl) and emits a session. So the
// page waits for that session rather than reading anything out of the URL
// itself, and only then lets a new password be set.
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

/** Same rule as the app and the admin console: at least 8 characters with a
 * letter, a digit and a special character. */
function isStrongEnough(password: string): boolean {
  return password.length >= 8 && /[A-Za-z]/.test(password) && /[0-9]/.test(password) && /[^A-Za-z0-9]/.test(password);
}

export default function ResetPasswordPage() {
  const router = useRouter();
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  async function submit() {
    if (busy) return;
    if (!isStrongEnough(password)) {
      setError("Mật khẩu cần tối thiểu 8 ký tự, gồm chữ, số và ký tự đặc biệt.");
      return;
    }
    if (password !== confirm) {
      setError("Hai mật khẩu không khớp.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) throw updateError;
      setDone(true);
    } catch {
      setError("Chưa đổi được mật khẩu. Liên kết có thể đã hết hạn — hãy yêu cầu gửi lại.");
    } finally {
      setBusy(false);
    }
  }

  const shell: React.CSSProperties = {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    background: "#050912",
  };
  const cardStyle: React.CSSProperties = {
    width: "100%",
    maxWidth: 420,
    display: "flex",
    flexDirection: "column",
    gap: 16,
    padding: 28,
    borderRadius: 24,
    background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(255,255,255,0.10)",
    color: "#fff",
  };
  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "13px 14px",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.16)",
    background: "rgba(255,255,255,0.05)",
    color: "#fff",
    fontFamily: "inherit",
    fontSize: 14.5,
    boxSizing: "border-box",
  };

  return (
    <main className="dark-surface" style={shell}>
      <div style={cardStyle}>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 600 }}>Đặt mật khẩu mới</h1>

        {done ? (
          <>
            <p style={{ margin: 0, fontSize: 14.5, lineHeight: 1.6, color: "rgba(255,255,255,0.72)" }}>
              Đã đổi mật khẩu. Bạn có thể đăng nhập lại bằng mật khẩu mới, trên web và cả trong ứng dụng.
            </p>
            <button
              type="button"
              onClick={() => router.push("/dang-nhap")}
              style={{ ...inputStyle, cursor: "pointer", fontWeight: 600, background: "var(--color-primary)", border: "none" }}
            >
              Về trang đăng nhập
            </button>
          </>
        ) : session === undefined ? (
          <p style={{ margin: 0, fontSize: 14.5, color: "rgba(255,255,255,0.6)" }}>Đang kiểm tra liên kết...</p>
        ) : !session ? (
          <>
            <p style={{ margin: 0, fontSize: 14.5, lineHeight: 1.6, color: "rgba(255,255,255,0.72)" }}>
              Liên kết đặt lại mật khẩu không còn hiệu lực. Hãy mở lại trang đăng nhập và bấm &ldquo;Quên mật khẩu?&rdquo; để nhận liên kết mới.
            </p>
            <button
              type="button"
              onClick={() => router.push("/dang-nhap")}
              style={{ ...inputStyle, cursor: "pointer", fontWeight: 600, background: "var(--color-primary)", border: "none" }}
            >
              Về trang đăng nhập
            </button>
          </>
        ) : (
          <>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Mật khẩu mới"
              aria-label="Mật khẩu mới"
              autoComplete="new-password"
              style={inputStyle}
            />
            <input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="Nhập lại mật khẩu"
              aria-label="Nhập lại mật khẩu"
              autoComplete="new-password"
              style={inputStyle}
            />
            <p style={{ margin: 0, fontSize: 12.5, color: "rgba(255,255,255,0.5)" }}>
              Tối thiểu 8 ký tự, gồm chữ, số và ký tự đặc biệt.
            </p>
            {error ? <p style={{ margin: 0, fontSize: 13.5, color: "#FF9A9A" }}>{error}</p> : null}
            <button
              type="button"
              onClick={() => void submit()}
              disabled={busy}
              style={{ ...inputStyle, cursor: busy ? "default" : "pointer", fontWeight: 600, background: "var(--color-primary)", border: "none", opacity: busy ? 0.7 : 1 }}
            >
              {busy ? "Đang lưu..." : "Lưu mật khẩu"}
            </button>
          </>
        )}
      </div>
    </main>
  );
}
