// "Đăng nhập bằng tài khoản TheraHOME" — the same profiles.account_type
// mechanism as TheraHOME-APP's mobile-only admin-issued accounts, extended
// here to also cover WEB admin/cskh login directly (no Google, no
// /verify contact-check step — current_web_roles() resolves roles from
// account_type as soon as the session exists, see migration
// 202608230900_thera_accounts_web_roles_and_admin_seed.sql).
import { supabase } from "./supabase";

export async function signInWithTheraAccount(username: string, password: string): Promise<void> {
  const { data: email, error: resolveError } = await supabase.rpc("resolve_thera_login_email", {
    p_username: username,
  });
  if (resolveError) throw resolveError;
  if (!email) {
    // Same generic failure GoTrue itself returns for a bad password — don't
    // let this path reveal whether a username exists.
    throw new Error("invalid_credentials");
  }
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
}
