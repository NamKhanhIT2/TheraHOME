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

/** How long to wait for the role lookup before giving up on it.
 *
 * Not defensive padding — a real incident: a stalled lookup left the sign-in
 * button on "Đang xử lý..." with no error and no way forward, because the
 * screen had nothing to fall back to. A customer is by far the common case and
 * "/" is where they belong, so waiting longer than this buys nothing. Staff who
 * hit the timeout land on the public site and can retry, which is a far better
 * failure than an infinite spinner. */
const ROLE_LOOKUP_TIMEOUT_MS = 6000;

/** Where this session belongs right now. */
export async function resolvePostSignInRoute(): Promise<string> {
  let roles: Awaited<ReturnType<typeof getCurrentWebRoles>> = [];
  try {
    roles = await Promise.race([
      getCurrentWebRoles(),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("current_web_roles timed out")), ROLE_LOOKUP_TIMEOUT_MS),
      ),
    ]);
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
