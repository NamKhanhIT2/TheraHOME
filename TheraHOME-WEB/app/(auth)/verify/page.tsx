"use client";

// Real contact-verification gate: after Google sign-in, checks for a
// session, then looks up the entered phone/email against
// web_access_contacts via the lookup_web_access_contact RPC (see
// src/lib/webAccess.ts and CLAUDE.md).
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { verifyWebAccessContact } from "@/lib/webAccess";

export default function VerifyPage() {
  const router = useRouter();
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [contact, setContact] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  async function handleSubmit() {
    if (!contact.trim() || submitting) return;
    setSubmitting(true);
    setError("");
    try {
      const roles = await verifyWebAccessContact(contact);
      if (!roles) {
        setError("Số điện thoại/email này chưa được cấp quyền truy cập.");
        return;
      }
      router.push(roles.includes("admin") ? "/admin" : "/care");
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : "";
      if (message.includes("contact_already_claimed")) {
        setError("Số điện thoại/email này đã được liên kết với một tài khoản khác.");
      } else if (message.includes("account_already_has_contact")) {
        setError("Tài khoản này đã liên kết với một số điện thoại/email khác.");
      } else if (message.includes("order_contact_not_found")) {
        setError("Không tìm thấy đơn hàng hoặc quyền nội bộ với số điện thoại/email này.");
      } else if (message.includes("invalid_contact")) {
        setError("Số điện thoại/email không đúng định dạng.");
      } else if (message.includes("backend_migration_required")) {
        setError("Database chưa được cập nhật flow đăng nhập mới. Vui lòng chạy migration Supabase.");
      } else {
        setError("Có lỗi xảy ra, vui lòng thử lại.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (session === undefined) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <span style={{ color: "var(--text-secondary)" }}>Đang tải...</span>
      </div>
    );
  }

  if (session === null) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 16,
          padding: 20,
          textAlign: "center",
        }}
      >
        <p style={{ color: "var(--text-secondary)" }}>Bạn cần đăng nhập trước.</p>
        <a href="/welcome" style={{ color: "var(--color-primary)", fontWeight: 600 }}>
          Quay lại đăng nhập
        </a>
      </div>
    );
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 420,
          background: "var(--bg-card)",
          borderRadius: "var(--radius-lg)",
          boxShadow: "var(--shadow-card)",
          padding: "var(--space-6)",
        }}
      >
        <h1 style={{ fontSize: "var(--text-h1-size)", fontWeight: "var(--text-h1-weight)", margin: 0 }}>
          Xác nhận truy cập
        </h1>
        <p style={{ color: "var(--text-secondary)", marginTop: 8 }}>
          Nhập số điện thoại hoặc email được cấp quyền để vào trang quản trị.
        </p>
        <input
          value={contact}
          onChange={(e) => setContact(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
          placeholder="Số điện thoại hoặc email"
          autoCapitalize="none"
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
        {error ? (
          <div style={{ fontSize: 12.5, color: "var(--error)", marginTop: 8 }}>{error}</div>
        ) : null}
        <button
          onClick={handleSubmit}
          disabled={!contact.trim() || submitting}
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
          {submitting ? "Đang kiểm tra..." : "Xác nhận"}
        </button>
      </div>
    </div>
  );
}
