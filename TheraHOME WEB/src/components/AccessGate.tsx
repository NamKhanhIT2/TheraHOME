"use client";

// Client-side route guard for /admin and /care: requires a real Supabase
// session AND the role that page needs (from the contact-verification gate,
// see src/lib/webAccess.ts). Not a security boundary by itself — see the
// note in webAccess.ts — but keeps the two shells from being reachable
// without having gone through /welcome -> /verify first. Roles + a signOut
// helper are exposed via context so each shell (AppShell) can render its
// own logout/switcher UI matching the design, instead of this component
// drawing a foreign top bar over it.
import { createContext, useContext, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { getCurrentWebRoles, storeRoles, clearStoredRoles, type WebAccessRole } from "@/lib/webAccess";

interface WebAccessContextValue {
  roles: WebAccessRole[];
  email: string;
  signOut: () => Promise<void>;
}

const WebAccessContext = createContext<WebAccessContextValue | null>(null);

export function useWebAccess() {
  const ctx = useContext(WebAccessContext);
  if (!ctx) throw new Error("useWebAccess() must be called within an AccessGate");
  return ctx;
}

export function AccessGate({
  requiredRole,
  children,
}: {
  requiredRole: WebAccessRole;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [roles, setRoles] = useState<WebAccessRole[]>([]);
  const [email, setEmail] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data } = await supabase.auth.getSession();
        if (!data.session) {
          router.replace("/welcome");
          return;
        }
        const verifiedRoles = await getCurrentWebRoles();
        if (verifiedRoles.length === 0) {
          clearStoredRoles();
          router.replace("/verify");
          return;
        }
        storeRoles(verifiedRoles);
        if (!verifiedRoles.includes(requiredRole)) {
          router.replace(verifiedRoles.includes("admin") ? "/admin" : "/care");
          return;
        }
        if (!cancelled) {
          setRoles(verifiedRoles);
          setEmail(data.session.user.email ?? "");
          setReady(true);
        }
      } catch {
        clearStoredRoles();
        router.replace("/verify");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router, requiredRole]);

  // A session can go stale while the tab just sits open — the access token
  // expires (~1h) and a background refresh silently fails (e.g. a revoked
  // refresh token, or the tab having been backgrounded long enough that the
  // browser throttled the refresh timer). supabase-js detects that failure
  // and fires `SIGNED_OUT` on its own; without this listener nothing in the
  // UI reflects it, so every screen keeps rendering as if signed in and any
  // action taken afterward (e.g. submitting a form) just fails with a bare
  // "missing Authorization header" from whatever it called, with no
  // indication to the admin that they need to sign in again. Redirecting
  // here as soon as that happens turns a confusing silent failure into an
  // ordinary re-login prompt.
  useEffect(() => {
    const { data: subscription } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") {
        clearStoredRoles();
        router.replace("/welcome");
      }
    });
    return () => subscription.subscription.unsubscribe();
  }, [router]);

  async function signOut() {
    await supabase.auth.signOut();
    clearStoredRoles();
    router.replace("/welcome");
  }

  if (!ready) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <span style={{ color: "var(--text-secondary)" }}>Đang tải...</span>
      </div>
    );
  }

  return <WebAccessContext.Provider value={{ roles, email, signOut }}>{children}</WebAccessContext.Provider>;
}
