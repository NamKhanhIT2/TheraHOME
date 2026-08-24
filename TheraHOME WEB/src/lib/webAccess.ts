// The web contact gate binds an existing admin/CSKH contact to exactly one
// authenticated account. The database, not localStorage, owns that binding.
import { supabase } from "./supabase";

export type WebAccessRole = "admin" | "cskh";

const STORAGE_KEY = "therahome_web_access_roles";

export async function verifyWebAccessContact(
  contact: string
): Promise<WebAccessRole[] | null> {
  const value = contact.trim();
  const { data, error } = await supabase.rpc("claim_user_access_contact", {
    p_contact: value,
  });
  if (error) throw error;
  const result = (data as { access_roles?: WebAccessRole[] }[] | null)?.[0];
  if (result && !Array.isArray(result.access_roles)) {
    throw new Error("backend_migration_required");
  }
  const roles = result?.access_roles ?? null;
  if (roles && roles.length > 0) {
    storeRoles(roles);
    return roles;
  }
  return null;
}

/** Re-check roles from the database. Unlike localStorage, this also proves
 * that the current auth user is the account that claimed the contact. */
export async function getCurrentWebRoles(): Promise<WebAccessRole[]> {
  const { data, error } = await supabase.rpc("current_web_roles");
  if (error) throw error;
  return ((data as WebAccessRole[] | null) ?? []).filter(
    (role): role is WebAccessRole => role === "admin" || role === "cskh"
  );
}

// Client-side routing convenience only — NOT a security boundary. Real data
// access is still gated by the Supabase auth session + RLS on the actual
// tables each page reads. This just decides which UI shell to show.
export function storeRoles(roles: WebAccessRole[]) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(roles));
}

export function clearStoredRoles() {
  window.localStorage.removeItem(STORAGE_KEY);
}
