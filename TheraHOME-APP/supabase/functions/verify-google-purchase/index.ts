import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { SignJWT, importPKCS8 } from "npm:jose@5";

// Android counterpart of verify-apple-purchase: the app sends the Play
// Billing purchaseToken (NOT purchase.id — react-native-iap's Android id
// falls back between orderId and purchaseToken), this function verifies it
// against the Google Play Developer API, records the entitlement, and
// acknowledges the purchase server-side so Google's 3-day auto-refund
// window can't fire after we've granted access.

// Auto-injected by Supabase into every Edge Function.
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// Must be set manually — a Google Cloud service account granted access in
// Play Console (Users and permissions) with the Android Publisher API
// enabled; see TheraHOME-APP/docs/manual-setup.md "Google Play Billing".
const GOOGLE_SERVICE_ACCOUNT_EMAIL = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_EMAIL")!;
const GOOGLE_SERVICE_ACCOUNT_KEY = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_KEY")!; // service-account JSON's private_key (PEM)
const GOOGLE_PLAY_PACKAGE_NAME = Deno.env.get("GOOGLE_PLAY_PACKAGE_NAME")!;

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

// OAuth2 service-account flow: RS256 JWT asserting the androidpublisher
// scope, exchanged at Google's token endpoint for a short-lived access
// token (Google offers no direct JWT auth for this API, unlike Apple's).
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
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });
  if (!res.ok) {
    throw new Error(`google_token_exchange_failed: ${res.status}`);
  }
  const body = await res.json();
  if (typeof body?.access_token !== "string") {
    throw new Error("google_token_exchange_failed: no access_token");
  }
  return body.access_token;
}

interface ProductPurchase {
  purchaseState?: number; // 0 purchased, 1 canceled, 2 pending
  acknowledgementState?: number; // 0 yet to be acknowledged, 1 acknowledged
  orderId?: string;
  purchaseTimeMillis?: string;
  productId?: string;
}

function purchaseUrl(productId: string, purchaseToken: string): string {
  return (
    `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/` +
    `${encodeURIComponent(GOOGLE_PLAY_PACKAGE_NAME)}/purchases/products/` +
    `${encodeURIComponent(productId)}/tokens/${encodeURIComponent(purchaseToken)}`
  );
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

  const phaseId = String(payload.phaseId ?? "");
  const purchaseToken = String(payload.purchaseToken ?? "");
  if (!phaseId || !purchaseToken) {
    return jsonResponse({ error: "missing_required_field" }, 400);
  }

  // Bound to the caller's own JWT — the purchase gets recorded against
  // whoever is actually signed in, not a client-supplied user id.
  const callerClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: callerUser, error: callerError } = await callerClient.auth.getUser();
  if (callerError || !callerUser?.user) {
    return jsonResponse({ error: "unauthorized" }, 401);
  }
  const userId = callerUser.user.id;

  const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  const { data: promo, error: promoError } = await adminClient
    .from("phase_promos")
    .select("google_product_id")
    .eq("phase_id", phaseId)
    .maybeSingle();
  if (promoError) {
    return jsonResponse({ error: promoError.message }, 500);
  }
  if (!promo?.google_product_id) {
    return jsonResponse({ error: "phase_not_purchasable" }, 400);
  }
  const productId = promo.google_product_id as string;

  let accessToken: string;
  try {
    accessToken = await buildGoogleAccessToken();
  } catch (e) {
    console.error("buildGoogleAccessToken failed — check GOOGLE_* secrets:", e);
    return jsonResponse({ error: "google_auth_setup_invalid" }, 500);
  }

  // The authenticated round trip to Google's own API — scoped to OUR
  // package and the EXPECTED product id — is the trust boundary: a token
  // minted for another app or product simply 404s here.
  const purchaseRes = await fetch(purchaseUrl(productId, purchaseToken), {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!purchaseRes.ok) {
    return jsonResponse({ error: "purchase_not_found" }, 400);
  }
  const purchase = (await purchaseRes.json()) as ProductPurchase;

  if (purchase.purchaseState !== 0) {
    // 1 = canceled, 2 = pending — neither grants the phase.
    return jsonResponse({ error: "purchase_not_valid" }, 400);
  }
  if (purchase.productId && purchase.productId !== productId) {
    return jsonResponse({ error: "product_id_mismatch" }, 400);
  }

  // Insert, not upsert — a purchase token must stay bound to whichever
  // user actually redeemed it first (same rule as verify-apple-purchase).
  const { data: existing, error: existingError } = await adminClient
    .from("phase_purchases")
    .select("user_id")
    .eq("google_purchase_token", purchaseToken)
    .maybeSingle();
  if (existingError) {
    return jsonResponse({ error: existingError.message }, 500);
  }
  if (existing) {
    // Idempotent retry (network blip, restore) is fine; anyone else trying
    // to redeem an already-claimed token is not.
    return existing.user_id === userId
      ? jsonResponse({ ok: true })
      : jsonResponse({ error: "transaction_already_claimed" }, 409);
  }

  const { error: insertError } = await adminClient.from("phase_purchases").insert({
    user_id: userId,
    phase_id: phaseId,
    platform: "android",
    google_purchase_token: purchaseToken,
    google_order_id: purchase.orderId ?? null,
    purchased_at: purchase.purchaseTimeMillis
      ? new Date(Number(purchase.purchaseTimeMillis)).toISOString()
      : new Date().toISOString(),
  });
  if (insertError) {
    return jsonResponse({ error: insertError.message }, 500);
  }

  // Acknowledge server-side right after granting: if the app dies before
  // its own finishTransaction and isn't reopened within 3 days, Google
  // would auto-refund an unacknowledged purchase while our row says
  // "purchased". Failure here is non-fatal — the client's
  // finishTransaction acknowledges too.
  if (purchase.acknowledgementState === 0) {
    try {
      const ackRes = await fetch(`${purchaseUrl(productId, purchaseToken)}:acknowledge`, {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: "{}",
      });
      if (!ackRes.ok) {
        console.error("acknowledge failed:", ackRes.status, await ackRes.text());
      }
    } catch (e) {
      console.error("acknowledge failed:", e);
    }
  }

  return jsonResponse({ ok: true });
});
