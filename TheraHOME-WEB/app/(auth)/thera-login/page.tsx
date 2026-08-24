"use client";

// "Đăng nhập bằng tài khoản TheraHOME" — username/password, no OAuth. On
// success this skips /verify entirely: current_web_roles() already resolves
// admin/cskh roles straight from profiles.account_type once a session
// exists, so AccessGate on /admin (or its own redirect to /care for a
// cskh-only account) is all that's needed next.
import { useState } from "react";
import { useRouter } from "next/navigation";
import { signInWithTheraAccount } from "@/lib/theraAccountAuth";

export default function TheraLoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit() {
    if (!username.trim() || !password || submitting) return;
    setSubmitting(true);
    setError("");
    try {
      await signInWithTheraAccount(username.trim(), password);
      router.push("/admin");
    } catch {
      setError("Tên đăng nhập hoặc mật khẩu không chính xác.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
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
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
          placeholder="Tên đăng nhập"
          autoCapitalize="none"
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
          disabled={!username.trim() || !password || submitting}
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
