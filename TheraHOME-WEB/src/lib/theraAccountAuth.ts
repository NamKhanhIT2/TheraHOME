// "Đăng nhập bằng tài khoản TheraHOME" — the same profiles.account_type
// mechanism as TheraHOME-APP's mobile-only admin-issued accounts, extended
// here to also cover WEB admin/cskh login directly (no Google, no
// /verify contact-check step — current_web_roles() resolves roles from
// account_type as soon as the session exists, see migration
// 202608230900_thera_accounts_web_roles_and_admin_seed.sql).
//
// WEB signs in by EMAIL only, matching what the Tài khoản TheraHOME admin tab
// already tells people when it issues an account ("Đăng nhập bằng Email +
// mật khẩu"). Accounts created without a real address get the synthetic
// `<username>@thera.local` the edge function derives, and that address is
// what they type here. The shared `auth-sign-in` function still accepts a
// bare username for the mobile screen; the web form simply never sends one.
//
// The lookup and the password check both happen inside `auth-sign-in`, which
// answers a wrong password and an unknown address identically and never
// returns an address of its own.
import { supabase } from "./supabase";

export async function signInWithTheraAccount(email: string, password: string): Promise<void> {
  const { data, error } = await supabase.functions.invoke("auth-sign-in", {
    body: { identifier: email.trim(), password },
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
