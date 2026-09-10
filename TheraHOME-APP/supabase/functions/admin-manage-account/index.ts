import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// 'admin' is excluded — the single admin account is seeded by a migration.
const ACCOUNT_TYPES = ["admin_issued", "review", "staff", "partner", "tester", "cskh"];
const ACCESS_LEVELS = ["free", "premium", "admin_granted"];
const COUNTRIES = ["VN", "US", "MALAY"];
const MARKET_LANGUAGE: Record<string, string> = { VN: "vi", US: "en", MALAY: "ms" };
const USERNAME_RE = /^[a-zA-Z0-9._-]{3,32}$/;
// Accounts created without a real email get a synthetic <username>@thera.local
// (Supabase Auth requires an email-shaped identifier). A real email is optional.
const SYNTHETIC_EMAIL_DOMAIN = "thera.local";

// Password policy (owner, 2026-09-10) — same rule as the app + web admin.
function isPasswordStrongEnough(pw: string): boolean {
  return pw.length >= 8 && /[A-Za-z]/.test(pw) && /[0-9]/.test(pw) && /[^A-Za-z0-9]/.test(pw);
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// Log + return a 500 so the real cause shows up in the function logs (the HTTP
// summary line alone never carries the error body).
function fail(step: string, err: unknown) {
  const message = (err as { message?: string })?.message ?? String(err);
  console.error(`[admin-manage-account] ${step}:`, message, err);
  return jsonResponse({ error: message || step }, 500);
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return jsonResponse({ error: "Missing Authorization header" }, 401);
  }

  let payload: Record<string, unknown>;
  try {
    payload = await req.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON body" }, 400);
  }

  try {
    const callerClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: roles, error: rolesError } = await callerClient.rpc("current_web_roles");
    if (rolesError) return fail("current_web_roles", rolesError);
    if (!Array.isArray(roles) || !roles.includes("admin")) {
      return jsonResponse({ error: "forbidden" }, 403);
    }

    const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    if (payload.action === "create") return await handleCreate(adminClient, callerClient, payload);
    if (payload.action === "reset_password") return await handleResetPassword(adminClient, payload);
    if (payload.action === "delete") return await handleDelete(adminClient, callerClient, payload);
    return jsonResponse({ error: "Unknown action" }, 400);
  } catch (err) {
    return fail("unhandled", err);
  }
});

// deno-lint-ignore no-explicit-any
async function handleCreate(adminClient: any, callerClient: any, payload: Record<string, unknown>) {
  const username = String(payload.username ?? "").trim().toLowerCase();
  const password = String(payload.password ?? "");
  // Optional real email. When omitted, the synthetic <username>@thera.local is
  // used; admins reset passwords directly in the tab, so no inbox is required.
  const providedEmail = String(payload.email ?? "").trim().toLowerCase();
  const fullName = String(payload.full_name ?? "").trim();
  const accountType = String(payload.account_type ?? "");
  const accessLevel = String(payload.access_level ?? "");
  const expiresAt = payload.expires_at ? String(payload.expires_at) : null;
  const onboardingRequired = Boolean(payload.onboarding_required);
  const country = payload.country ? String(payload.country) : "VN";
  const notes = payload.notes ? String(payload.notes) : null;

  if (!username || !password || !fullName) return jsonResponse({ error: "missing_required_field" }, 400);
  if (!USERNAME_RE.test(username)) return jsonResponse({ error: "invalid_username" }, 400);
  if (!ACCOUNT_TYPES.includes(accountType)) return jsonResponse({ error: "invalid_account_type" }, 400);
  if (!ACCESS_LEVELS.includes(accessLevel)) return jsonResponse({ error: "invalid_access_level" }, 400);
  if (!COUNTRIES.includes(country)) return jsonResponse({ error: "invalid_country" }, 400);
  if (!isPasswordStrongEnough(password)) return jsonResponse({ error: "password_too_weak" }, 400);

  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (providedEmail && (!EMAIL_RE.test(providedEmail) || providedEmail.endsWith(`@${SYNTHETIC_EMAIL_DOMAIN}`))) {
    return jsonResponse({ error: "invalid_email" }, 400);
  }

  // Staff/issued usernames are unique case-insensitively
  // (profiles_staff_username_unique_idx on lower(username) for non-'normal'
  // accounts). Check up front so a collision is a clear 400 the web can name,
  // instead of surfacing as a 500 only after the auth user already exists.
  // `_` is a LIKE wildcard and is allowed in usernames, so escape it.
  const usernamePattern = username.replace(/[_%]/g, (m) => `\\${m}`);
  const { data: usernameTaken, error: usernameLookupError } = await adminClient
    .from("profiles")
    .select("id")
    .ilike("username", usernamePattern)
    .neq("account_type", "normal")
    .limit(1)
    .maybeSingle();
  if (usernameLookupError) return fail("username_lookup", usernameLookupError);
  if (usernameTaken) return jsonResponse({ error: "username_already_registered" }, 400);

  const email = providedEmail || `${username}@${SYNTHETIC_EMAIL_DOMAIN}`;
  const { data: created, error: createError } = await adminClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (createError || !created?.user) {
    const alreadyRegistered = createError?.message?.includes("already been registered");
    if (!alreadyRegistered) console.error("[admin-manage-account] createUser:", createError?.message, createError);
    const message = alreadyRegistered
      ? (providedEmail ? "email_already_registered" : "username_already_registered")
      : createError?.message ?? "create_failed";
    return jsonResponse({ error: message }, 400);
  }

  const userId = created.user.id;
  const { data: callerUser } = await callerClient.auth.getUser();
  const createdBy = callerUser?.user?.id ?? null;

  const { error: profileError } = await adminClient
    .from("profiles")
    .update({
      username,
      email: providedEmail || null,
      full_name: fullName,
      account_type: accountType,
      access_level: accessLevel,
      expires_at: expiresAt,
      onboarding_completed: !onboardingRequired,
      country_confirmed: true,
      country,
      language: MARKET_LANGUAGE[country] ?? "vi",
      language_explicit: true,
      notes,
      created_by: createdBy,
      locked: false,
    })
    .eq("id", userId);
  if (profileError) {
    // The auth user exists but the profile fill failed — delete it so a retry
    // with the same username/email isn't blocked as "already registered".
    await adminClient.auth.admin.deleteUser(userId).catch(() => {});
    return fail("profile_update", profileError);
  }

  // ONLY 'review' is auto-provisioned with the full catalog; every other type
  // goes through the normal activation gate.
  if (accountType !== "review") {
    return jsonResponse({ user_id: userId });
  }

  const provisionError = await provisionFullCatalog(adminClient, userId, email);
  if (provisionError) {
    await adminClient.auth.admin.deleteUser(userId).catch(() => {});
    return fail("provision", provisionError);
  }

  return jsonResponse({ user_id: userId });
}

// Grants a review account access to every product's whole roadmap. Returns an
// error object on the first failing step (the caller rolls back the auth user).
// deno-lint-ignore no-explicit-any
async function provisionFullCatalog(adminClient: any, userId: string, email: string) {
  const { error: contactError } = await adminClient.from("user_access_contacts").upsert(
    { user_id: userId, contact_type: "email", contact_value: email, normalized_value: email },
    { onConflict: "user_id" },
  );
  if (contactError) return contactError;

  const { data: products, error: productsError } = await adminClient.from("products").select("id");
  if (productsError) return productsError;

  for (const product of products ?? []) {
    const { data: program, error: programError } = await adminClient
      .from("user_programs")
      .upsert({ user_id: userId, product_id: product.id, order_id: null }, { onConflict: "user_id,product_id" })
      .select("id")
      .single();
    if (programError) return programError;

    const { data: days, error: daysError } = await adminClient
      .from("program_days")
      .select("id, day_number")
      .eq("product_id", product.id);
    if (daysError) return daysError;

    const rows = (days ?? []).map((d: { id: string; day_number: number }) => ({
      user_program_id: program.id,
      program_day_id: d.id,
      status: d.day_number === 1 ? "current" : "locked",
    }));
    if (rows.length) {
      const { error: rowsError } = await adminClient
        .from("user_program_days")
        .upsert(rows, { onConflict: "user_program_id,program_day_id" });
      if (rowsError) return rowsError;
    }
  }
  return null;
}

// deno-lint-ignore no-explicit-any
async function handleDelete(adminClient: any, callerClient: any, payload: Record<string, unknown>) {
  const userId = String(payload.user_id ?? "");
  if (!userId) return jsonResponse({ error: "missing_required_field" }, 400);

  const { data: callerUser } = await callerClient.auth.getUser();
  if (callerUser?.user?.id === userId) return jsonResponse({ error: "cannot_delete_self" }, 400);

  const { data: target, error: targetError } = await adminClient
    .from("profiles")
    .select("account_type")
    .eq("id", userId)
    .maybeSingle();
  if (targetError) return fail("delete_lookup", targetError);
  if (!target) return jsonResponse({ error: "account_not_found" }, 404);
  if (target.account_type === "admin") return jsonResponse({ error: "cannot_delete_root_admin" }, 400);
  if (target.account_type === "normal") return jsonResponse({ error: "not_a_thera_account" }, 400);

  const { error } = await adminClient.auth.admin.deleteUser(userId);
  if (error) return fail("delete_user", error);
  return jsonResponse({ ok: true });
}

// deno-lint-ignore no-explicit-any
async function handleResetPassword(adminClient: any, payload: Record<string, unknown>) {
  const userId = String(payload.user_id ?? "");
  const newPassword = String(payload.new_password ?? "");
  if (!userId || !newPassword) return jsonResponse({ error: "missing_required_field" }, 400);
  if (!isPasswordStrongEnough(newPassword)) return jsonResponse({ error: "password_too_weak" }, 400);
  const { error } = await adminClient.auth.admin.updateUserById(userId, { password: newPassword });
  if (error) return fail("reset_password", error);
  return jsonResponse({ ok: true });
}
