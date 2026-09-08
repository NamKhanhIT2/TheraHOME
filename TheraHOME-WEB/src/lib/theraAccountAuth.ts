// "Đăng nhập bằng tài khoản TheraHOME" — the same profiles.account_type
// mechanism as TheraHOME-APP's mobile-only admin-issued accounts, extended
// here to also cover WEB admin/cskh login directly (no Google, no
// /verify contact-check step — current_web_roles() resolves roles from
// account_type as soon as the session exists, see migration
// 202608230900_thera_accounts_web_roles_and_admin_seed.sql).
//
// This used to resolve the username to an email with the
// `resolve_thera_login_email` RPC and then sign in with it. That RPC was
// callable without signing in, so anyone could post a username and be handed
// that person's real email address — a way to harvest every customer's
// address one name at a time. The lookup now happens inside the
// `auth-sign-in` Edge Function, which answers a wrong password and an
// unknown name identically and never returns an address, and the RPC has
// been revoked.
import { supabase } from "./supabase";

export async function signInWithTheraAccount(username: string, password: string): Promise<void> {
  const { data, error } = await supabase.functions.invoke("auth-sign-in", {
    body: { identifier: username.trim(), password },
  });

  if (error) {
    // functions.invoke turns any non-2xx into an error and leaves the body on
    // the Response, which is where the reason lives.
    const context = (error as { context?: Response }).context;
    let payload: { error?: string } | null = null;
    try {
      payload = context ? await context.json() : null;
    } catch {
      payload = null;
    }
    throw new Error(payload?.error ?? "invalid_credentials");
  }

  const session = data as { access_token?: string; refresh_token?: string };
  if (!session?.access_token || !session?.refresh_token) throw new Error("invalid_credentials");

  const { error: sessionError } = await supabase.auth.setSession({
    access_token: session.access_token,
    refresh_token: session.refresh_token,
  });
  if (sessionError) throw sessionError;
}
