// One login door, three destinations.
//
// The site has a single sign-in for everybody. Where you land afterwards is
// decided by what the database says you are, never by which page you came
// from: an admin gets the Admin shell, a CSKH specialist gets the Care shell,
// and an ordinary customer stays on the public site.
//
// `current_web_roles()` returns an empty array for a normal customer (see
// migration 202609042300_web_roles_empty_array_falls_through.sql), which is
// exactly the "not staff" signal — not an error, and not a reason to send
// them to /verify.
import { getCurrentWebRoles, storeRoles, clearStoredRoles } from "./webAccess";

/** Where this session belongs right now. */
export async function resolvePostSignInRoute(): Promise<string> {
  let roles: Awaited<ReturnType<typeof getCurrentWebRoles>> = [];
  try {
    roles = await getCurrentWebRoles();
  } catch {
    // The role lookup failing must not strand a customer on the login screen.
    // Treating it as "not staff" sends them to the public site, which is both
    // the safe direction and the common case.
    roles = [];
  }

  if (roles.length === 0) {
    clearStoredRoles();
    return "/";
  }

  storeRoles(roles);
  return roles.includes("admin") ? "/admin" : "/care";
}
