import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { SignJWT, importPKCS8, decodeJwt } from "npm:jose@5";

// Picks up renewals. Nothing did.
//
// `verify-subscription` writes a PERIOD, and the only thing that ever wrote a
// new one was a purchase or the catch-up inside `useSubscriptionPurchase` —
// a hook imported by exactly one screen, app/subscription.tsx. So a renewal
// was noticed only if the customer happened to open the paywall, which a
// person who is already paying has no reason to do.
//
// The consequence, found by the owner's first real Android purchase on
// 2026-10-14 (a licence-test subscription whose 3-month period is compressed
// to five minutes, which made a month's worth of staleness visible in one
// sitting): one period after buying, a PAYING customer silently loses AI
// chat, calls, form checks and xu, until they wander into the paywall or
// press Khôi phục. Both platforms, same cause — StoreKit queues the renewal
// transaction and replays it, but only to an observer, and the observer lives
// in that same screen.
//
// So the fix belongs on the server, where it needs neither the app to be open
// nor the customer to do anything: ask the store what the token says now.
//
// The store-credential helpers below are deliberately a second copy of the
// ones in verify-subscription rather than a shared module. Extracting them
// would mean redeploying the payment path to gain nothing here, and that path
// should not change for the convenience of a cron. If a third caller ever
// appears, THAT is when they move to functions/_shared.

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const CRON_SECRET_NAME = "voided_cron_secret";

const APPLE_ISSUER_ID = Deno.env.get("APPLE_ISSUER_ID") ?? "";
const APPLE_KEY_ID = Deno.env.get("APPLE_KEY_ID") ?? "";
const APPLE_PRIVATE_KEY = Deno.env.get("APPLE_PRIVATE_KEY") ?? "";
const APPLE_BUNDLE_ID = Deno.env.get("APPLE_BUNDLE_ID") ?? "";

const GOOGLE_SERVICE_ACCOUNT_EMAIL = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_EMAIL") ?? "";
const GOOGLE_SERVICE_ACCOUNT_KEY = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_KEY") ?? "";
const GOOGLE_PLAY_PACKAGE_NAME = Deno.env.get("GOOGLE_PLAY_PACKAGE_NAME") ?? "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-renewal-cron-secret",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

/** What the store says about one subscription right now. */
interface StoreState {
  currentPeriodEnd: string | null;
  autoRenewing: boolean | null;
  status: "active" | "expired" | "revoked";
}

// ---------------------------------------------------------------- Apple ----

async function buildAppleJwt(): Promise<string> {
  const key = await importPKCS8(APPLE_PRIVATE_KEY, "ES256");
  return await new SignJWT({ bid: APPLE_BUNDLE_ID })
    .setProtectedHeader({ alg: "ES256", kid: APPLE_KEY_ID, typ: "JWT" })
    .setIssuer(APPLE_ISSUER_ID)
    .setIssuedAt()
    .setExpirationTime("55m")
    .setAudience("appstoreconnect-v1")
    .sign(key);
}

/** The SUBSCRIPTION-STATUS endpoint, not the transaction one.
 *
 * verify-subscription reads /inApps/v1/transactions/{id}, which answers about
 * that one transaction — so for an original id it keeps returning the FIRST
 * period's expiry however many times Apple has renewed since. This endpoint
 * returns the latest transaction of the subscription, which is the whole
 * point here, and it carries the auto-renew flag that the transaction payload
 * does not.
 *
 * Production first, Sandbox second: Apple serves them from different hosts and
 * a TestFlight or sandbox tester exists only on the latter. */
async function appleState(originalTransactionId: string): Promise<StoreState | null> {
  if (!APPLE_PRIVATE_KEY || !APPLE_BUNDLE_ID) return null;
  let jwt: string;
  try {
    jwt = await buildAppleJwt();
  } catch (e) {
    console.error("buildAppleJwt failed — check APPLE_* secrets:", e);
    return null;
  }

  for (const base of ["https://api.storekit.itunes.apple.com", "https://api.storekit-sandbox.itunes.apple.com"]) {
    const res = await fetch(`${base}/inApps/v1/subscriptions/${encodeURIComponent(originalTransactionId)}`, {
      headers: { Authorization: `Bearer ${jwt}` },
    });
    if (!res.ok) continue;
    const body = await res.json();
    const last = body?.data?.[0]?.lastTransactions?.[0];
    if (!last?.signedTransactionInfo) continue;

    let claims: Record<string, unknown>;
    try {
      claims = decodeJwt(last.signedTransactionInfo as string);
    } catch {
      continue;
    }
    if (claims.bundleId !== APPLE_BUNDLE_ID) continue;

    let autoRenewing: boolean | null = null;
    if (typeof last.signedRenewalInfo === "string") {
      try {
        autoRenewing = Number(decodeJwt(last.signedRenewalInfo).autoRenewStatus) === 1;
      } catch { /* the expiry is the part that matters */ }
    }

    const expiresMs = claims.expiresDate ? Number(claims.expiresDate) : null;
    // Apple's status: 1 active, 2 expired, 3 billing retry, 4 grace,
    // 5 revoked. Grace keeps access — Apple is still trying to collect and
    // the customer has not lapsed. Billing retry WITHOUT grace does not, so
    // it is treated as expired rather than given the benefit of the doubt.
    const appleStatus = Number(last.status);
    const status: StoreState["status"] =
      claims.revocationDate || appleStatus === 5 ? "revoked"
        : appleStatus === 1 || appleStatus === 4 ? "active"
          : "expired";

    return {
      currentPeriodEnd: expiresMs ? new Date(expiresMs).toISOString() : null,
      autoRenewing,
      status,
    };
  }
  return null;
}

// --------------------------------------------------------------- Google ----

async function buildGoogleAccessToken(): Promise<string> {
  const key = await importPKCS8(GOOGLE_SERVICE_ACCOUNT_KEY, "RS256");
  const assertion = await new SignJWT({ scope: "https://www.googleapis.com/auth/androidpublisher" })
    .setProtectedHeader({ alg: "RS256", typ: "JWT" })
    .setIssuer(GOOGLE_SERVICE_ACCOUNT_EMAIL)
    .setAudience("https://oauth2.googleapis.com/token")
    .setIssuedAt()
    .setExpirationTime("55m")
    .sign(key);
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion }),
  });
  if (!res.ok) throw new Error(`google_token_exchange_failed: ${res.status}`);
  const body = await res.json();
  if (typeof body?.access_token !== "string") throw new Error("google_token_exchange_failed: no access_token");
  return body.access_token;
}

async function googleState(purchaseToken: string, accessToken: string): Promise<StoreState | null> {
  const base = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${encodeURIComponent(GOOGLE_PLAY_PACKAGE_NAME)}`;
  const res = await fetch(`${base}/purchases/subscriptionsv2/tokens/${encodeURIComponent(purchaseToken)}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) return null;
  const purchase = await res.json();
  const line = purchase?.lineItems?.[0];

  // CANCELED means auto-renew is off, NOT that access ended — the paid period
  // runs to expiryTime. Only EXPIRED, ON_HOLD and PAUSED actually stop it.
  const state = String(purchase?.subscriptionState ?? "");
  const status: StoreState["status"] =
    state === "SUBSCRIPTION_STATE_ACTIVE" || state === "SUBSCRIPTION_STATE_IN_GRACE_PERIOD"
      || state === "SUBSCRIPTION_STATE_CANCELED"
      ? "active"
      : "expired";

  return {
    currentPeriodEnd: line?.expiryTime ? new Date(line.expiryTime).toISOString() : null,
    autoRenewing: line?.autoRenewingPlan?.autoRenewEnabled ?? null,
    status,
  };
}

// ----------------------------------------------------------------- main ----

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  const { data: secretOk, error: secretError } = await admin.rpc("cron_secret_matches", {
    p_name: CRON_SECRET_NAME,
    p_value: req.headers.get("x-renewal-cron-secret") ?? "",
  });
  if (secretError) {
    console.error("cron_secret_matches failed:", secretError);
    return jsonResponse({ error: "secret_check_failed" }, 500);
  }
  if (!secretOk) return jsonResponse({ error: "unauthorized" }, 401);

  // Past their period and still marked active: either the store renewed and
  // nobody told us, or they really did lapse. Both need the same question
  // asked, and the answer is what stops us asking again — a row the store
  // calls expired is written as 'expired' and drops out of this query.
  //
  // A refund is handled by sync-apple-refunds / sync-voided-purchases, so
  // revoked rows are already excluded.
  const { data: rows, error: rowsError } = await admin
    .from("user_subscriptions")
    .select("id, user_id, platform, plan_code, store_subscription_id, current_period_end, auto_renewing")
    .eq("status", "active")
    .is("revoked_at", null)
    .not("current_period_end", "is", null)
    .lt("current_period_end", new Date().toISOString())
    .limit(200);
  if (rowsError) {
    console.error("could not list past-due subscriptions:", rowsError);
    return jsonResponse({ error: rowsError.message }, 500);
  }
  if (!rows?.length) return jsonResponse({ ok: true, checked: 0, renewed: 0, lapsed: 0 });

  // One token exchange for the whole batch, and only if Android rows exist.
  let googleToken: string | null = null;
  if (rows.some((row) => row.platform === "android") && GOOGLE_SERVICE_ACCOUNT_KEY && GOOGLE_PLAY_PACKAGE_NAME) {
    try {
      googleToken = await buildGoogleAccessToken();
    } catch (e) {
      console.error("buildGoogleAccessToken failed — check GOOGLE_* secrets:", e);
    }
  }

  let renewed = 0;
  let lapsed = 0;
  let unknown = 0;

  for (const row of rows) {
    // A hand-granted row has no store behind it; its end date is whatever an
    // admin typed, and asking Apple about it would be nonsense.
    if (row.platform === "manual") {
      await admin.from("user_subscriptions")
        .update({ status: "expired", updated_at: new Date().toISOString() })
        .eq("id", row.id);
      lapsed += 1;
      continue;
    }

    let state: StoreState | null = null;
    try {
      if (row.platform === "ios") {
        state = await appleState(row.store_subscription_id as string);
      } else if (row.platform === "android" && googleToken) {
        state = await googleState(row.store_subscription_id as string, googleToken);
      }
    } catch (e) {
      console.error(`store lookup failed for ${row.id}:`, e);
    }

    // No answer is NOT a lapse. Leaving the row alone keeps it in tomorrow's
    // batch; writing 'expired' on a network blip would take a paying
    // customer's access away and never give it back.
    if (!state) {
      unknown += 1;
      continue;
    }

    const stillLive = state.status === "active"
      && (!state.currentPeriodEnd || state.currentPeriodEnd > new Date().toISOString());

    const { error: updateError } = await admin.from("user_subscriptions").update({
      current_period_end: state.currentPeriodEnd ?? row.current_period_end,
      auto_renewing: state.autoRenewing ?? row.auto_renewing,
      status: state.status === "revoked" ? "revoked" : stillLive ? "active" : "expired",
      revoked_at: state.status === "revoked" ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    }).eq("id", row.id);
    if (updateError) {
      console.error(`could not update ${row.id}:`, updateError);
      continue;
    }

    if (stillLive) renewed += 1; else lapsed += 1;
  }

  console.log(`renewal sweep: checked ${rows.length}, renewed ${renewed}, lapsed ${lapsed}, no answer ${unknown}`);
  return jsonResponse({ ok: true, checked: rows.length, renewed, lapsed, unknown });
});
