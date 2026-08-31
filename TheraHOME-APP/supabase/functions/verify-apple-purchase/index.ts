import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { SignJWT, importPKCS8, decodeJwt } from "npm:jose@5";

// Auto-injected by Supabase into every Edge Function.
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// Must be set manually (App Store Connect -> Users and Access ->
// Integrations -> App Store Server API) -- see TheraHOME-APP/CLAUDE.md's
// "Apple IAP" section for exact steps. Not creatable from this codebase.
const APPLE_ISSUER_ID = Deno.env.get("APPLE_ISSUER_ID")!;
const APPLE_KEY_ID = Deno.env.get("APPLE_KEY_ID")!;
const APPLE_PRIVATE_KEY = Deno.env.get("APPLE_PRIVATE_KEY")!; // .p8 contents, PEM
const APPLE_BUNDLE_ID = Deno.env.get("APPLE_BUNDLE_ID")!;

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

// App Store Server API auth token -- ES256 JWT signed with the App Store
// Connect API key, per Apple's spec (aud must be exactly "appstoreconnect-v1").
async function buildAppleJwt(): Promise<string> {
  const key = await importPKCS8(APPLE_PRIVATE_KEY, "ES256");
  return await new SignJWT({ bid: APPLE_BUNDLE_ID })
    .setProtectedHeader({ alg: "ES256", kid: APPLE_KEY_ID, typ: "JWT" })
    .setIssuer(APPLE_ISSUER_ID)
    .setIssuedAt()
    .setExpirationTime("55m") // Apple caps tokens at 1h; leave margin
    .setAudience("appstoreconnect-v1")
    .sign(key);
}

// Apple has no single endpoint that works for both real and Sandbox
// purchases -- try production first (the common case), fall back to
// Sandbox for TestFlight/sandbox-tester transactions.
async function fetchSignedTransactionInfo(transactionId: string, appleJwt: string): Promise<string | null> {
  const bases = ["https://api.storekit.itunes.apple.com", "https://api.storekit-sandbox.itunes.apple.com"];
  for (const base of bases) {
    const res = await fetch(`${base}/inApps/v1/transactions/${transactionId}`, {
      headers: { Authorization: `Bearer ${appleJwt}` },
    });
    if (res.ok) {
      const body = await res.json();
      if (typeof body?.signedTransactionInfo === "string") return body.signedTransactionInfo;
    }
  }
  return null;
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
  const transactionId = String(payload.transactionId ?? "");
  if (!phaseId || !transactionId) {
    return jsonResponse({ error: "missing_required_field" }, 400);
  }

  // Bound to the caller's own JWT -- the purchase gets recorded against
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
    .select("apple_product_id")
    .eq("phase_id", phaseId)
    .maybeSingle();
  if (promoError) {
    return jsonResponse({ error: promoError.message }, 500);
  }
  if (!promo?.apple_product_id) {
    return jsonResponse({ error: "phase_not_purchasable" }, 400);
  }

  let appleJwt: string;
  try {
    appleJwt = await buildAppleJwt();
  } catch (e) {
    console.error("buildAppleJwt failed -- check APPLE_* secrets:", e);
    return jsonResponse({ error: "apple_auth_setup_invalid" }, 500);
  }

  const signedTransactionInfo = await fetchSignedTransactionInfo(transactionId, appleJwt);
  if (!signedTransactionInfo) {
    return jsonResponse({ error: "transaction_not_found" }, 400);
  }

  // We reach this point only after independently calling Apple's own
  // authenticated App Store Server API (over TLS, with a request signed by
  // our own App Store Connect API key) to fetch this exact transaction --
  // that round trip to api.storekit(-sandbox).itunes.apple.com is itself
  // the trust boundary, so the JWS payload is decoded directly rather than
  // re-verifying its x5c certificate chain against Apple's root CA.
  // Hardening note: full chain verification can be added later if needed.
  let claims: Record<string, unknown>;
  try {
    claims = decodeJwt(signedTransactionInfo);
  } catch {
    return jsonResponse({ error: "invalid_transaction_payload" }, 400);
  }

  if (claims.bundleId !== APPLE_BUNDLE_ID) {
    return jsonResponse({ error: "bundle_id_mismatch" }, 400);
  }
  if (claims.productId !== promo.apple_product_id) {
    return jsonResponse({ error: "product_id_mismatch" }, 400);
  }
  if (String(claims.transactionId) !== transactionId) {
    return jsonResponse({ error: "transaction_id_mismatch" }, 400);
  }
  if (claims.revocationDate) {
    return jsonResponse({ error: "transaction_revoked" }, 400);
  }

  // Insert, not upsert -- a transaction id must stay bound to whichever
  // user actually redeemed it first. Upserting on conflict would let a
  // second caller who somehow obtained the same transaction id (e.g. a
  // leaked log line) silently steal the purchase by overwriting user_id.
  const { data: existing, error: existingError } = await adminClient
    .from("phase_purchases")
    .select("user_id")
    .eq("apple_transaction_id", String(claims.transactionId))
    .maybeSingle();
  if (existingError) {
    return jsonResponse({ error: existingError.message }, 500);
  }
  if (existing) {
    // Idempotent retry (e.g. client retried after a network blip) is fine;
    // anyone else trying to redeem an already-claimed transaction is not.
    return existing.user_id === userId
      ? jsonResponse({ ok: true })
      : jsonResponse({ error: "transaction_already_claimed" }, 409);
  }

  const { error: insertError } = await adminClient.from("phase_purchases").insert({
    user_id: userId,
    phase_id: phaseId,
    platform: "ios",
    apple_transaction_id: String(claims.transactionId),
    apple_original_transaction_id: String(claims.originalTransactionId ?? claims.transactionId),
    purchased_at: claims.purchaseDate ? new Date(Number(claims.purchaseDate)).toISOString() : new Date().toISOString(),
  });
  if (insertError) {
    return jsonResponse({ error: insertError.message }, 500);
  }

  return jsonResponse({ ok: true });
});
