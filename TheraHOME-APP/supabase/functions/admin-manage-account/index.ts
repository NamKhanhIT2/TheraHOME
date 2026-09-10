import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

// Auto-injected by Supabase into every Edge Function -- no manual secret
// setup needed for these three.
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// 'admin' is deliberately excluded -- there is exactly one admin account,
// seeded directly by a migration (see
// TheraHOME-APP/supabase/migrations/202608230900_thera_accounts_web_roles_and_admin_seed.sql),
// not creatable through this endpoint. A DB-level partial unique index on
// profiles also backs this as a hard invariant, not just an API-level check.
const ACCOUNT_TYPES = ["admin_issued", "review", "staff", "partner", "tester", "cskh"];
const ACCESS_LEVELS = ["free", "premium", "admin_granted"];
// profiles.country -- decides which market's store prices, product links and
// program videos the account sees. Thera-issued accounts skip the onboarding
// country screen, so Admin picks it at creation (2026-09-05); older callers
// that send nothing keep the previous behaviour of defaulting to VN.
const COUNTRIES = ["VN", "US", "MALAY"];
const MARKET_LANGUAGE: Record<string, string> = { VN: "vi", US: "en", MALAY: "ms" };
const USERNAME_RE = /^[a-zA-Z0-9._-]{3,32}$/;

// TheraHOME-issued accounts log in with a plain username, not a real email
// (see TheraHOME WEB/CLAUDE.md) -- Supabase Auth still requires an
// email-shaped identifier, so every such account gets a synthetic
// `<username>@thera.local` address under the hood. resolve_thera_login_email
// (SQL) maps a typed username back to this address at login time.
const SYNTHETIC_EMAIL_DOMAIN = "thera.local";

// Password policy (owner, 2026-09-10) — same rule as the app (authAccount.ts)
// and the web admin: >= 8 chars mixing a letter, a digit and a special char.
function isPasswordStrongEnough(pw: string): boolean {
  return pw.length >= 8 && /[A-Za-z]/.test(pw) && /[0-9]/.test(pw) && /[^A-Za-z0-9]/.test(pw);
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
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

  // Bound to the caller's own JWT so the admin check respects RLS -- same
  // verification pattern chat-ai-reply uses for thread ownership.
  const callerClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: roles, error: rolesError } = await callerClient.rpc("current_web_roles");
  if (rolesError) {
    return jsonResponse({ error: rolesError.message }, 500);
  }
  if (!Array.isArray(roles) || !roles.includes("admin")) {
    return jsonResponse({ error: "forbidden" }, 403);
  }

  const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  if (payload.action === "create") {
    return handleCreate(adminClient, callerClient, payload);
  }
  if (payload.action === "reset_password") {
    return handleResetPassword(adminClient, payload);
  }
  if (payload.action === "delete") {
    return handleDelete(adminClient, callerClient, payload);
  }
  return jsonResponse({ error: "Unknown action" }, 400);
});

// deno-lint-ignore no-explicit-any
async function handleCreate(adminClient: any, callerClient: any, payload: Record<string, unknown>) {
  const username = String(payload.username ?? "").trim().toLowerCase();
  const password = String(payload.password ?? "");
  // Real, deliverable email (optional). When given, the account signs in and
  // resets its password by this address, exactly like a self-service customer.
  // When omitted, we fall back to the synthetic <username>@thera.local below —
  // login by username only, no email password reset.
  const providedEmail = String(payload.email ?? "").trim().toLowerCase();
  const fullName = String(payload.full_name ?? "").trim();
  const accountType = String(payload.account_type ?? "");
  const accessLevel = String(payload.access_level ?? "");
  const expiresAt = payload.expires_at ? String(payload.expires_at) : null;
  const onboardingRequired = Boolean(payload.onboarding_required);
  const country = payload.country ? String(payload.country) : "VN";
  const notes = payload.notes ? String(payload.notes) : null;

  if (!username || !password || !fullName) {
    return jsonResponse({ error: "missing_required_field" }, 400);
  }
  if (!USERNAME_RE.test(username)) {
    return jsonResponse({ error: "invalid_username" }, 400);
  }
  if (!ACCOUNT_TYPES.includes(accountType)) {
    return jsonResponse({ error: "invalid_account_type" }, 400);
  }
  if (!ACCESS_LEVELS.includes(accessLevel)) {
    return jsonResponse({ error: "invalid_access_level" }, 400);
  }
  if (!COUNTRIES.includes(country)) {
    return jsonResponse({ error: "invalid_country" }, 400);
  }
  if (!isPasswordStrongEnough(password)) {
    return jsonResponse({ error: "password_too_weak" }, 400);
  }
  // A provided email must be a real, deliverable address — never one on the
  // synthetic domain (that would defeat the point and collide with a
  // username's fallback address).
  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (providedEmail && (!EMAIL_RE.test(providedEmail) || providedEmail.endsWith(`@${SYNTHETIC_EMAIL_DOMAIN}`))) {
    return jsonResponse({ error: "invalid_email" }, 400);
  }

  const email = providedEmail || `${username}@${SYNTHETIC_EMAIL_DOMAIN}`;
  const { data: created, error: createError } = await adminClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (createError || !created?.user) {
    // A duplicate collides on whichever identifier was actually used.
    const alreadyRegistered = createError?.message?.includes("already been registered");
    const message = alreadyRegistered
      ? (providedEmail ? "email_already_registered" : "username_already_registered")
      : createError?.message ?? "create_failed";
    return jsonResponse({ error: message }, 400);
  }

  const userId = created.user.id;
  const { data: callerUser } = await callerClient.auth.getUser();
  const createdBy = callerUser?.user?.id ?? null;

  // The DB trigger on auth.users insert already created a base profiles row
  // (see TheraHOME-APP/CLAUDE.md) -- fill in the admin-chosen fields on it.
  const { error: profileError } = await adminClient
    .from("profiles")
    .update({
      username,
      // Real email onto the profile too (so it shows in Admin and the app);
      // null for synthetic-only accounts rather than storing the fake address.
      email: providedEmail || null,
      full_name: fullName,
      account_type: accountType,
      access_level: accessLevel,
      expires_at: expiresAt,
      onboarding_completed: !onboardingRequired,
      // Thera-issued accounts never see the country screen (RootNavigator
      // skips it for them), so mark it done -- a false default sent old app
      // builds to an unregistered /country route (blank screen). `country`
      // is what useMarket() reads, so Admin's choice lands here instead of
      // the app guessing the market from the UI language.
      country_confirmed: true,
      country,
      // The market Admin picks IS the deliberate language choice for these
      // accounts: they never see country.tsx (which is where a normal user
      // sets language + language_explicit), so without this they inherited
      // whatever language the phone happened to be on -- a UK-market account
      // read the whole app, onboarding questionnaire included, in Vietnamese.
      language: MARKET_LANGUAGE[country] ?? "vi",
      language_explicit: true,
      notes,
      created_by: createdBy,
      locked: false,
    })
    .eq("id", userId);
  if (profileError) {
    return jsonResponse({ error: profileError.message }, 500);
  }

  // ONLY 'review' (Apple/Google reviewers, who need the full app visible
  // immediately with no purchase to reference) is auto-provisioned with the
  // whole catalog. Every other type goes through the normal activation gate
  // (phone/email must be listed in the WEB "Kích hoạt" tab per product) --
  // per explicit request 2026-09-01: 'cskh' is pure staff (no patient
  // program at all), and 'admin_issued'/'tester'/'staff'/'partner' should
  // experience the app exactly as a real customer does.
  if (accountType !== "review") {
    return jsonResponse({ user_id: userId });
  }

  // Grant full catalog access immediately regardless of the onboarding
  // choice -- onboarding_completed only controls whether the intake screens
  // show before Home, not whether the account has programs. Mirrors the
  // provisioning block in claim_user_access_contact (see
  // TheraHOME-APP/supabase/migrations/202608180001_unique_contact_catalog_access.sql)
  // rather than reusing that RPC directly, since it's keyed off auth.uid()
  // and this runs in a service-role context with no caller session.
  const { error: contactError } = await adminClient.from("user_access_contacts").upsert(
    { user_id: userId, contact_type: "email", contact_value: email, normalized_value: email },
    { onConflict: "user_id" }
  );
  if (contactError) {
    return jsonResponse({ error: contactError.message }, 500);
  }

  const { data: products, error: productsError } = await adminClient.from("products").select("id");
  if (productsError) {
    return jsonResponse({ error: productsError.message }, 500);
  }
  for (const product of products ?? []) {
    const { data: program, error: programError } = await adminClient
      .from("user_programs")
      .upsert({ user_id: userId, product_id: product.id, order_id: null }, { onConflict: "user_id,product_id" })
      .select("id")
      .single();
    if (programError) {
      return jsonResponse({ error: programError.message }, 500);
    }
    const { data: days, error: daysError } = await adminClient
      .from("program_days")
      .select("id, day_number")
      .eq("product_id", product.id);
    if (daysError) {
      return jsonResponse({ error: daysError.message }, 500);
    }
    const rows = (days ?? []).map((d: { id: string; day_number: number }) => ({
      user_program_id: program.id,
      program_day_id: d.id,
      status: d.day_number === 1 ? "current" : "locked",
    }));
    if (rows.length) {
      const { error: rowsError } = await adminClient
        .from("user_program_days")
        .upsert(rows, { onConflict: "user_program_id,program_day_id" });
      if (rowsError) {
        return jsonResponse({ error: rowsError.message }, 500);
      }
    }
  }

  return jsonResponse({ user_id: userId });
}

// Really deletes a TheraHOME-issued account (2026-09-06). The WEB "Xóa"
// button used to only set profiles.locked, so the row stayed in the list
// and the owner reported "đã xoá rồi mà vẫn hiện". Deleting the auth user
// cascades: profiles, user_programs + progress, pain/water logs, chat
// threads and messages, notifications, push tokens, quiz attempts and
// access contacts all go with it. community_posts.author_id is SET NULL, so
// anything the account published in the feed survives without an author.
// upsell_campaigns.created_by is RESTRICT — an account that scheduled a
// campaign cannot be deleted until that campaign is gone, and the FK error
// is returned as-is rather than being swallowed.
// deno-lint-ignore no-explicit-any
async function handleDelete(adminClient: any, callerClient: any, payload: Record<string, unknown>) {
  const userId = String(payload.user_id ?? "");
  if (!userId) {
    return jsonResponse({ error: "missing_required_field" }, 400);
  }

  const { data: callerUser } = await callerClient.auth.getUser();
  if (callerUser?.user?.id === userId) {
    return jsonResponse({ error: "cannot_delete_self" }, 400);
  }

  const { data: target, error: targetError } = await adminClient
    .from("profiles")
    .select("account_type")
    .eq("id", userId)
    .maybeSingle();
  if (targetError) {
    return jsonResponse({ error: targetError.message }, 500);
  }
  if (!target) {
    return jsonResponse({ error: "account_not_found" }, 404);
  }
  // The singleton admin is seeded by migration and backed by a partial
  // unique index; deleting it would lock everyone out of WEB.
  if (target.account_type === "admin") {
    return jsonResponse({ error: "cannot_delete_root_admin" }, 400);
  }
  // This endpoint manages TheraHOME-issued accounts only. Ordinary
  // customers delete themselves from the app (profile → xoá tài khoản).
  if (target.account_type === "normal") {
    return jsonResponse({ error: "not_a_thera_account" }, 400);
  }

  const { error } = await adminClient.auth.admin.deleteUser(userId);
  if (error) {
    return jsonResponse({ error: error.message }, 500);
  }
  return jsonResponse({ ok: true });
}

// deno-lint-ignore no-explicit-any
async function handleResetPassword(adminClient: any, payload: Record<string, unknown>) {
  const userId = String(payload.user_id ?? "");
  const newPassword = String(payload.new_password ?? "");
  if (!userId || !newPassword) {
    return jsonResponse({ error: "missing_required_field" }, 400);
  }
  if (!isPasswordStrongEnough(newPassword)) {
    return jsonResponse({ error: "password_too_weak" }, 400);
  }
  const { error } = await adminClient.auth.admin.updateUserById(userId, { password: newPassword });
  if (error) {
    return jsonResponse({ error: error.message }, 500);
  }
  return jsonResponse({ ok: true });
}
