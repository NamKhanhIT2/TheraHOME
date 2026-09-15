"use client";

// Who is signed in, for the public site's nav.
//
// The design's auth-state.js keeps a fake user in localStorage; here the real
// Supabase session is the source of truth, so a customer who signed in on the
// mobile app and opens the site in the same browser is recognised without
// doing anything.
//
// Staff roles are resolved too, because an admin browsing the public site
// should still be offered the way back into their shell rather than having to
// remember the /admin URL.
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { getCurrentWebRoles, type WebAccessRole } from "@/lib/webAccess";

export interface LandingSession {
  /** null while still resolving — render neither state to avoid a flash. */
  signedIn: boolean | null;
  name: string;
  email: string;
  roles: WebAccessRole[];
}

export function useLandingSession(): LandingSession & { signOut: () => Promise<void> } {
  const [state, setState] = useState<LandingSession>({ signedIn: null, name: "", email: "", roles: [] });

  useEffect(() => {
    let cancelled = false;

    async function load(session: Awaited<ReturnType<typeof supabase.auth.getSession>>["data"]["session"]) {
      if (!session) {
        if (!cancelled) setState({ signedIn: false, name: "", email: "", roles: [] });
        return;
      }
      const email = session.user.email ?? "";
      // full_name is what the app shows everywhere else; fall back to the
      // address rather than rendering an empty chip.
      const [{ data: profile }, roles] = await Promise.all([
        supabase.from("profiles").select("full_name").eq("id", session.user.id).maybeSingle(),
        getCurrentWebRoles().catch(() => [] as WebAccessRole[]),
      ]);
      if (cancelled) return;
      setState({ signedIn: true, name: profile?.full_name || email, email, roles });
    }

    supabase.auth.getSession().then(({ data }) => void load(data.session));

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      void load(session);
    });

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  return {
    ...state,
    signOut: async () => {
      await supabase.auth.signOut();
    },
  };
}

/** "Nguyễn Văn An" -> "NV". Matches auth-state.js's initials(). */
export function initials(name: string): string {
  return (name || "Bạn")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}
