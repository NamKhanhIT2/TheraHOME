import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { SignJWT, importPKCS8, decodeJwt } from "npm:jose@5";

// Subscription counterpart of verify-apple-purchase / verify-google-purchase.
//
// Those two handle one-off phase unlocks, which are permanent once granted.
// A subscription is not: it has a period that ends, it renews on its own,
// and it can lapse without anybody calling anything. So this function
// records a PERIOD rather than a fact, keyed on the store's stable
// subscription identity (Apple's originalTransactionId, Google's
// purchaseToken) so a renewal updates the same row instead of piling up a
// row a month. Whether that row still grants anything is decided on read,
// by public.active_plan_code().
//
// It reuses the same two sets of store credentials the phase-unlock
// functions already use — no new secret is needed:
//   APPLE_ISSUER_ID / APPLE_KEY_ID / APPLE_PRIVATE_KEY / APPLE_BUNDLE_ID
//   GOOGLE_SERVICE_ACCOUNT_EMAIL / GOOGLE_SERVICE_ACCOUNT_KEY / GOOGLE_PLAY_PACKAGE_NAME

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const APPLE_ISSUER_ID = Deno.env.get("APPLE_ISSUER_ID") ?? "";
const APPLE_KEY_ID = Deno.env.get("APPLE_KEY_ID") ?? "";
const APPLE_PRIVATE_KEY = Deno.env.get("APPLE_PRIVATE_KEY") ?? "";
const APPLE_BUNDLE_ID = Deno.env.get("APPLE_BUNDLE_ID") ?? "";

const GOOGLE_SERVICE_ACCOUNT_EMAIL = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_EMAIL") ?? "";
const GOOGLE_SERVICE_ACCOUNT_KEY = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_KEY") ?? "";
const GOOGLE_PLAY_PACKAGE_NAME = Deno.env.get("GOOGLE_PLAY_PACKAGE_NAME") ?? "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
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

// Apple has no endpoint that serves both real and Sandbox purchases, so
// production is tried first and Sandbox second — TestFlight and sandbox
// testers live only on the latter.
async function fetchSignedTransactionInfo(transactionId: string, appleJwt: string): Promise<string | null> {
  const bases = ["https://api.storekit.itunes.apple.com", "https://api.storekit-sandbox.itunes.apple.com"];
  for (const base of bases) {
    const res = await fetch(`${base}/inApps/v1/transactions/${encodeURIComponent(transactionId)}`, {
      headers: { Authorization: `Bearer ${appleJwt}` },
    });
    if (res.ok) {
      const body = await res.json();
      if (typeof body?.signedTransactionInfo === "string") return body.signedTransactionInfo;
    }
  }
  return null;
}

interface StoreVerdict {
  storeSubscriptionId: string;
  productId: string;
  purchasedAt: string;
  currentPeriodEnd: string | null;
  autoRenewing: boolean | null;
  /** 'active' | 'expired' | 'revoked' | 'pending' — 'pending' means the money
   * is not in yet, which is neither an entitlement nor a failure. */
  state: "active" | "expired" | "revoked" | "pending";
}

async function verifyWithApple(transactionId: string, expectedProductId: string): Promise<StoreVerdict | { error: string; status: number }> {
  if (!APPLE_PRIVATE_KEY || !APPLE_BUNDLE_ID) {
    return { error: "apple_auth_setup_invalid", status: 500 };
  }
  let appleJwt: string;
  try {
    appleJwt = await buildAppleJwt();
  } catch (e) {
    console.error("buildAppleJwt failed — check APPLE_* secrets:", e);
    return { error: "apple_auth_setup_invalid", status: 500 };
  }

  const signed = await fetchSignedTransactionInfo(transactionId, appleJwt);
  if (!signed) return { error: "transaction_not_found", status: 400 };

  // The authenticated round trip to Apple's own API, signed with our App
  // Store Connect key, IS the trust boundary — same reasoning as
  // verify-apple-purchase, where this is spelled out in full.
  let claims: Record<string, unknown>;
  try {
    claims = decodeJwt(signed);
  } catch {
    return { error: "invalid_transaction_payload", status: 400 };
  }

  if (claims.bundleId !== APPLE_BUNDLE_ID) return { error: "bundle_id_mismatch", status: 400 };
  if (claims.productId !== expectedProductId) return { error: "product_id_mismatch", status: 400 };

  const expiresMs = claims.expiresDate ? Number(claims.expiresDate) : null;
  return {
    // The ORIGINAL id, not this renewal's: it is the only value that stays
    // the same across every renewal of one subscription.
    storeSubscriptionId: String(claims.originalTransactionId ?? claims.transactionId),
    productId: String(claims.productId),
    purchasedAt: claims.purchaseDate ? new Date(Number(claims.purchaseDate)).toISOString() : new Date().toISOString(),
    currentPeriodEnd: expiresMs ? new Date(expiresMs).toISOString() : null,
    // StoreKit's transaction payload does not carry the renewal flag; the
    // subscription-status endpoint does. Left unknown rather than guessed —
    // nothing in the app depends on it yet.
    autoRenewing: null,
    state: claims.revocationDate ? "revoked" : expiresMs && expiresMs <= Date.now() ? "expired" : "active",
  };
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

interface SubscriptionPurchaseV2 {
  subscriptionState?: string;
  acknowledgementState?: string;
  startTime?: string;
  lineItems?: Array<{
    productId?: string;
    expiryTime?: string;
    autoRenewingPlan?: { autoRenewEnabled?: boolean };
  }>;
}

async function verifyWithGoogle(purchaseToken: string, expectedProductId: string): Promise<StoreVerdict | { error: string; status: number }> {
  if (!GOOGLE_SERVICE_ACCOUNT_KEY || !GOOGLE_PLAY_PACKAGE_NAME) {
    return { error: "google_auth_setup_invalid", status: 500 };
  }
  let accessToken: string;
  try {
    accessToken = await buildGoogleAccessToken();
  } catch (e) {
    console.error("buildGoogleAccessToken failed — check GOOGLE_* secrets:", e);
    return { error: "google_auth_setup_invalid", status: 500 };
  }

  // subscriptionsv2, not the classic endpoint: v2 is the one that reports a
  // subscription's state as a state (ACTIVE / IN_GRACE_PERIOD / CANCELED /
  // EXPIRED) instead of leaving it to be inferred from timestamps.
  const base = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${encodeURIComponent(GOOGLE_PLAY_PACKAGE_NAME)}`;
  const res = await fetch(`${base}/purchases/subscriptionsv2/tokens/${encodeURIComponent(purchaseToken)}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  // Scoped to OUR package: a token minted for another app simply 404s here,
  // which is what makes this round trip the trust boundary.
  if (!res.ok) return { error: "purchase_not_found", status: 400 };
  const purchase = (await res.json()) as SubscriptionPurchaseV2;

  const line = purchase.lineItems?.[0];
  if (line?.productId && line.productId !== expectedProductId) {
    return { error: "product_id_mismatch", status: 400 };
  }

  const stateName = purchase.subscriptionState ?? "";
  const state: StoreVerdict["state"] =
    stateName === "SUBSCRIPTION_STATE_PENDING" || stateName === "SUBSCRIPTION_STATE_PENDING_PURCHASE_CANCELED"
      ? "pending"
      : stateName === "SUBSCRIPTION_STATE_ACTIVE" ||
          stateName === "SUBSCRIPTION_STATE_IN_GRACE_PERIOD" ||
          // Cancelled but paid for: Play keeps serving until the period ends,
          // and so do we. Treating this as expired would take away time the
          // buyer has already paid for.
          stateName === "SUBSCRIPTION_STATE_CANCELED"
        ? "active"
        : "expired";

  // Acknowledge as soon as we have granted. An unacknowledged purchase is
  // auto-refunded by Google after three days, which would leave our row
  // saying "active" over money that went back. Non-fatal: the client's
  // finishTransaction acknowledges too.
  if (purchase.acknowledgementState === "ACKNOWLEDGEMENT_STATE_PENDING" && state === "active") {
    try {
      const ack = await fetch(
        `${base}/purchases/subscriptions/${encodeURIComponent(expectedProductId)}/tokens/${encodeURIComponent(purchaseToken)}:acknowledge`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
          body: "{}",
        },
      );
      if (!ack.ok) console.error("subscription acknowledge failed:", ack.status, await ack.text());
    } catch (e) {
      console.error("subscription acknowledge failed:", e);
    }
  }

  return {
    // Play's stable identity for a subscription IS the purchase token: it
    // survives renewals and only changes when the subscription is replaced.
    storeSubscriptionId: purchaseToken,
    productId: line?.productId ?? expectedProductId,
    purchasedAt: purchase.startTime ?? new Date().toISOString(),
    currentPeriodEnd: line?.expiryTime ?? null,
    autoRenewing: line?.autoRenewingPlan?.autoRenewEnabled ?? null,
    state,
  };
}

// ----------------------------------------------------------------- main ----

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return jsonResponse({ error: "Missing Authorization header" }, 401);

  let payload: Record<string, unknown>;
  try {
    payload = await req.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON body" }, 400);
  }

  const planCode = String(payload.planCode ?? "");
  const transactionId = String(payload.transactionId ?? "");
  const purchaseToken = String(payload.purchaseToken ?? "");
  if (!planCode || (!transactionId && !purchaseToken)) {
    return jsonResponse({ error: "missing_required_field" }, 400);
  }
  // The platform comes from WHICH receipt arrived, not from a client-supplied
  // field: an Apple transaction id cannot be verified against Play, so there
  // is nothing to choose.
  const platform = purchaseToken ? "android" : "ios";

  // Bound to the caller's own JWT — the subscription is recorded against
  // whoever is actually signed in, never a client-supplied user id.
  const callerClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: callerUser, error: callerError } = await callerClient.auth.getUser();
  if (callerError || !callerUser?.user) return jsonResponse({ error: "unauthorized" }, 401);
  const userId = callerUser.user.id;

  const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  const { data: plan, error: planError } = await adminClient
    .from("subscription_plans")
    .select("code, apple_product_id, google_product_id")
    .eq("code", planCode)
    .maybeSingle();
  if (planError) return jsonResponse({ error: planError.message }, 500);
  const expectedProductId = platform === "android" ? plan?.google_product_id : plan?.apple_product_id;
  if (!expectedProductId) return jsonResponse({ error: "plan_not_purchasable" }, 400);

  const verdict =
    platform === "android"
      ? await verifyWithGoogle(purchaseToken, expectedProductId)
      : await verifyWithApple(transactionId, expectedProductId);
  if ("error" in verdict) return jsonResponse({ error: verdict.error }, verdict.status);

  // Money not collected yet (Play's bank transfer / cash-at-a-counter
  // methods take hours). Not an entitlement and not a failure — 200 so the
  // client can tell this apart, because supabase-js flattens every non-2xx
  // into one generic error.
  if (verdict.state === "pending") return jsonResponse({ ok: false, pending: true });

  const { data: existing, error: existingError } = await adminClient
    .from("user_subscriptions")
    .select("id, user_id, revoked_at")
    .eq("platform", platform)
    .eq("store_subscription_id", verdict.storeSubscriptionId)
    .maybeSingle();
  if (existingError) return jsonResponse({ error: existingError.message }, 500);

  // A store subscription stays bound to whoever redeemed it first. Letting a
  // second caller overwrite user_id would let a leaked receipt move a paid
  // subscription to another account — same rule as the phase-unlock
  // functions, which is where this bit me before.
  if (existing && existing.user_id !== userId) {
    return jsonResponse({ error: "transaction_already_claimed" }, 409);
  }
  // Refunded earlier. Nothing a renewal says brings it back; a refund is a
  // decision about the money, not about the period.
  if (existing?.revoked_at) {
    return jsonResponse({ ok: false, revoked: true });
  }

  const row = {
    user_id: userId,
    plan_code: planCode,
    platform,
    product_id: verdict.productId,
    store_subscription_id: verdict.storeSubscriptionId,
    status: verdict.state === "revoked" ? "revoked" : verdict.state,
    current_period_end: verdict.currentPeriodEnd,
    auto_renewing: verdict.autoRenewing,
    purchased_at: verdict.purchasedAt,
    revoked_at: verdict.state === "revoked" ? new Date().toISOString() : null,
    updated_at: new Date().toISOString(),
  };

  if (existing) {
    const { error } = await adminClient.from("user_subscriptions").update(row).eq("id", existing.id);
    if (error) return jsonResponse({ error: error.message }, 500);
  } else {
    const { error } = await adminClient.from("user_subscriptions").insert(row);
    if (error) {
      // 23505 = the (platform, store_subscription_id) unique index. The store
      // hands the same purchase over twice — once through the purchase
      // callback, once through the account's purchase list — so two
      // verifications of ONE purchase can race. The row exists, which means
      // this succeeded; answering 500 would tell the buyer their payment
      // failed.
      if (error.code === "23505") {
        const { data: raced } = await adminClient
          .from("user_subscriptions")
          .select("user_id, revoked_at")
          .eq("platform", platform)
          .eq("store_subscription_id", verdict.storeSubscriptionId)
          .maybeSingle();
        if (!raced || raced.user_id !== userId) return jsonResponse({ error: "transaction_already_claimed" }, 409);
        if (raced.revoked_at) return jsonResponse({ ok: false, revoked: true });
      } else {
        return jsonResponse({ error: error.message }, 500);
      }
    }
  }

  if (verdict.state === "revoked") return jsonResponse({ ok: false, revoked: true });
  if (verdict.state === "expired") return jsonResponse({ ok: false, expired: true });
  return jsonResponse({ ok: true, planCode, currentPeriodEnd: verdict.currentPeriodEnd });
});
