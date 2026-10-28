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
  /** For a customer: profiles.avatar_url, the picture they set in the app,
   * falling back to the one Google supplied. For STAFF: never the app
   * picture — see the note on `name` below. Empty when there is none. */
  avatarUrl: string;
  roles: WebAccessRole[];
}

export function useLandingSession(): LandingSession & { signOut: () => Promise<void> } {
  const [state, setState] = useState<LandingSession>({ signedIn: null, name: "", email: "", avatarUrl: "", roles: [] });

  useEffect(() => {
    let cancelled = false;

    async function load(session: Awaited<ReturnType<typeof supabase.auth.getSession>>["data"]["session"]) {
      if (!session) {
        if (!cancelled) setState({ signedIn: false, name: "", email: "", avatarUrl: "", roles: [] });
        return;
      }
      const email = session.user.email ?? "";
      // full_name is what the app shows everywhere else; fall back to the
      // address rather than rendering an empty chip.
      const [{ data: profile, error }, roles] = await Promise.all([
        supabase.from("profiles").select("full_name, avatar_url").eq("id", session.user.id).maybeSingle(),
        getCurrentWebRoles().catch(() => [] as WebAccessRole[]),
      ]);
      if (error) console.error("Unable to read the profile row for the nav", error);
      if (cancelled) return;
      // For a CUSTOMER the name is profiles.full_name on purpose, NOT the
      // Google display name: the app shows full_name everywhere, so taking
      // Google's here would make the same person read differently on phone and
      // web. Someone who renamed themselves in the app means it.
      //
      // STAFF are the exception (owner 2026-10-28). The two owner Google
      // accounts are also ordinary app accounts, so the chip was reading their
      // app profile and showing a personal name and a picture uploaded in the
      // app — "Long", with an avatar from the `avatars` bucket. Signing into
      // the console is not the same act as using the app, and the owner wants
      // the web side to say so: one shared label, and nothing carried over
      // from the app account.
      //
      // Nothing is written to `profiles` for this. The row keeps the name and
      // picture the mobile app renders, so signing in on the phone is
      // completely unaffected — this is a display rule on the web only.
      const meta = session.user.user_metadata ?? {};
      const providerAvatar = typeof meta.avatar_url === "string" ? meta.avatar_url : typeof meta.picture === "string" ? meta.picture : "";
      const staffLabel = roles.includes("admin") ? "Admin" : roles.includes("cskh") ? "CSKH" : "";
      setState({
        signedIn: true,
        name: staffLabel || profile?.full_name || email,
        email,
        // Staff skip profile.avatar_url entirely. Google's picture is still
        // offered, because the owner holds two Google accounts and the face is
        // the quickest way to see which one is signed in; with none, the chip
        // falls back to the "A"/"C" initial it draws underneath.
        avatarUrl: staffLabel ? providerAvatar : profile?.avatar_url || providerAvatar || "",
        roles,
      });
    }

    supabase.auth.getSession().then(({ data }) => void load(data.session));

    // Deferred, and the callback is deliberately not async: supabase-js holds
    // the auth lock while dispatching this, and load() calls supabase again —
    // awaiting here can deadlock the pair (see AuthPanel for the long version).
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setTimeout(() => void load(session), 0);
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
