"use client";

// Real animated welcome screen (translated from the design project) is
// still next-phase work — this wires up the actual sign-in options so the
// auth flow works end to end, on a simple placeholder backdrop. Three
// entry points: Google/Apple (OAuth, -> /verify's contact check) and
// "tài khoản TheraHOME" (username/password, admin/cskh accounts skip
// /verify entirely — see thera-login/page.tsx).
import { useState } from "react";
import { useRouter } from "next/navigation";
import { signInWithGoogle } from "@/lib/googleAuth";
import { signInWithApple } from "@/lib/appleAuth";

export default function WelcomePage() {
  const router = useRouter();
  const [loadingProvider, setLoadingProvider] = useState<"google" | "apple" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleGoogleSignIn() {
    setError(null);
    setLoadingProvider("google");
    try {
      await signInWithGoogle();
    } catch {
      // Most likely cause pre-setup: the Google provider isn't configured
      // in the Supabase dashboard yet, or this redirect URI isn't
      // registered on the Google Cloud OAuth client — see CLAUDE.md.
      setError("Không thể đăng nhập với Google lúc này. Vui lòng thử lại sau.");
      setLoadingProvider(null);
    }
  }

  async function handleAppleSignIn() {
    setError(null);
    setLoadingProvider("apple");
    try {
      await signInWithApple();
    } catch {
      setError("Không thể đăng nhập với Apple lúc này. Vui lòng thử lại sau.");
      setLoadingProvider(null);
    }
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "flex-end",
        padding: "0 28px 48px",
        background: "#16213A",
        color: "#fff",
        textAlign: "center",
        gap: 14,
      }}
    >
      <div style={{ marginBottom: 4 }}>
        <div style={{ fontSize: 30, fontWeight: 700 }}>TheraHOME</div>
        <div style={{ fontSize: 16, fontWeight: 600, opacity: 0.92, marginTop: 4 }}>
          Bảng điều khiển nội bộ
        </div>
      </div>
      <button
        onClick={handleGoogleSignIn}
        disabled={loadingProvider !== null}
        style={{
          width: "100%",
          maxWidth: 360,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 10,
          background: "#fff",
          color: "#16213A",
          border: "none",
          borderRadius: 999,
          padding: "15px 0",
          fontFamily: "var(--font-family)",
          fontSize: 16,
          fontWeight: 600,
          cursor: loadingProvider !== null ? "default" : "pointer",
          opacity: loadingProvider !== null && loadingProvider !== "google" ? 0.5 : 1,
        }}
      >
        {loadingProvider === "google" ? "Đang chuyển hướng..." : "Đăng nhập với Google"}
      </button>
      <button
        onClick={handleAppleSignIn}
        disabled={loadingProvider !== null}
        style={{
          width: "100%",
          maxWidth: 360,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 10,
          background: "#000",
          color: "#fff",
          border: "none",
          borderRadius: 999,
          padding: "15px 0",
          fontFamily: "var(--font-family)",
          fontSize: 16,
          fontWeight: 600,
          cursor: loadingProvider !== null ? "default" : "pointer",
          opacity: loadingProvider !== null && loadingProvider !== "apple" ? 0.5 : 1,
        }}
      >
        {loadingProvider === "apple" ? "Đang chuyển hướng..." : "Đăng nhập với Apple"}
      </button>
      <button
        onClick={() => router.push("/thera-login")}
        disabled={loadingProvider !== null}
        style={{
          width: "100%",
          maxWidth: 360,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 10,
          background: "transparent",
          color: "#fff",
          border: "1.5px solid rgba(255,255,255,0.5)",
          borderRadius: 999,
          padding: "15px 0",
          fontFamily: "var(--font-family)",
          fontSize: 16,
          fontWeight: 600,
          cursor: loadingProvider !== null ? "default" : "pointer",
          opacity: loadingProvider !== null ? 0.5 : 1,
        }}
      >
        Đăng nhập bằng tài khoản TheraHOME
      </button>
      {error ? <div style={{ fontSize: 12.5, color: "#FF8A8A" }}>{error}</div> : null}
    </div>
  );
}
