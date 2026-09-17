"use client";

// "Đăng nhập bằng tài khoản TheraHOME" — email/password, no OAuth. On
// success this skips /verify entirely: current_web_roles() already resolves
// admin/cskh roles straight from profiles.account_type once a session
// exists, so the destination can be decided here — see
// src/lib/postSignInRoute.ts. Staff land in their shell, everyone else on
// the public site.
import { useState } from "react";
import { useRouter } from "next/navigation";
import { signInWithTheraAccount } from "@/lib/theraAccountAuth";
import { resolvePostSignInRoute } from "@/lib/postSignInRoute";

export default function TheraLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit() {
    if (!email.trim() || !password || submitting) return;
    setSubmitting(true);
    setError("");
    try {
      await signInWithTheraAccount(email.trim(), password);
      // One door, three destinations: admin -> /admin, cskh -> /care, and an
      // ordinary customer -> the public site. This used to push everyone at
      // /admin and lean on AccessGate to bounce them, which worked for staff
      // but left a customer signing in here staring at a redirect loop.
      router.push(await resolvePostSignInRoute());
    } catch {
      setError("Email hoặc mật khẩu không chính xác.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className="dark-surface"
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
        background: "#16213A",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 380,
          background: "#fff",
          borderRadius: "var(--radius-lg)",
          boxShadow: "var(--shadow-card)",
          padding: "var(--space-6)",
        }}
      >
        <h1 style={{ fontSize: "var(--text-h1-size)", fontWeight: "var(--text-h1-weight)", margin: 0 }}>
          Đăng nhập TheraHOME
        </h1>
        <p style={{ color: "var(--text-secondary)", marginTop: 8, fontSize: 13.5 }}>
          Dành cho Admin, chăm sóc khách hàng, và tài khoản được cấp riêng.
        </p>
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
          placeholder="Email"
          type="email"
          autoCapitalize="none"
          autoComplete="username"
          autoFocus
          style={{
            width: "100%",
            marginTop: 20,
            padding: 14,
            border: "1px solid var(--border-input)",
            borderRadius: "var(--radius-md)",
            fontFamily: "var(--font-family)",
            fontSize: 16,
            boxSizing: "border-box",
          }}
        />
        <input
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
          placeholder="Mật khẩu"
          type="password"
          autoComplete="current-password"
          style={{
            width: "100%",
            marginTop: 12,
            padding: 14,
            border: "1px solid var(--border-input)",
            borderRadius: "var(--radius-md)",
            fontFamily: "var(--font-family)",
            fontSize: 16,
            boxSizing: "border-box",
          }}
        />
        {error ? (
          <div style={{ fontSize: 12.5, color: "var(--error)", marginTop: 8 }}>{error}</div>
        ) : null}
        <button
          onClick={handleSubmit}
          disabled={!email.trim() || !password || submitting}
          style={{
            width: "100%",
            marginTop: 16,
            padding: "14px 0",
            background: "var(--color-primary)",
            color: "var(--text-on-primary)",
            border: "none",
            borderRadius: "var(--radius-md)",
            fontFamily: "var(--font-family)",
            fontSize: "var(--text-button-size)",
            fontWeight: "var(--text-button-weight)",
            cursor: submitting ? "default" : "pointer",
            opacity: submitting ? 0.7 : 1,
          }}
        >
          {submitting ? "Đang đăng nhập..." : "Đăng nhập"}
        </button>
        <a
          href="/welcome"
          style={{ display: "block", textAlign: "center", marginTop: 16, fontSize: 13, color: "var(--text-secondary)" }}
        >
          Quay lại
        </a>
      </div>
    </div>
  );
}
