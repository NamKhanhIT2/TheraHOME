import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { SignJWT, importPKCS8, decodeJwt } from "npm:jose@5";

// iOS half of the refund guard (owner 2026-09-29). Android has had one since
// 2026-09-25 (`sync-voided-purchases`); without this, an Apple refund would
// leave `phase_purchases.revoked_at` null and the customer would keep the
// phase they were paid back for.
//
// POLLING, not Apple's Server Notifications V2, and deliberately:
//   * Apple has no "list every refund" endpoint — the notification webhook is
//     the push side, but each notification is a signed JWS whose x5c chain
//     must be verified against Apple's root CA before it can be trusted. A
//     public unauthenticated endpoint that revokes access is exactly the
//     thing to get right, and we cannot test it until iOS sells.
//   * We already hold live purchases in our own table, few of them, and Apple
//     answers "was this refunded?" per transaction through the same
//     authenticated App Store Server API that verify-apple-purchase uses. So
//     ask it, with our own key, over our own list.
//   * Same shape and same daily cadence as the Google job, so there is one
//     way refunds are handled, not two.
// If volume ever makes per-transaction polling silly, the notification
// webhook is the upgrade — this function stays valid as its backstop.

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// The same four secrets verify-apple-purchase uses — one App Store Connect
// API key. Until they are set (App Store Connect → Users and Access →
// Integrations → App Store Server API), this function cannot talk to Apple —
// which is harmless, because it returns before touching them while no iOS
// purchase exists.
const APPLE_ISSUER_ID = Deno.env.get("APPLE_ISSUER_ID")!;
const APPLE_KEY_ID = Deno.env.get("APPLE_KEY_ID")!;
const APPLE_PRIVATE_KEY = Deno.env.get("APPLE_PRIVATE_KEY")!; // .p8 contents, PEM
const APPLE_BUNDLE_ID = Deno.env.get("APPLE_BUNDLE_ID")!;

// Shared with sync-voided-purchases: one secret in Vault for the internal
// cron jobs, answered by the `cron_secret_matches` SECURITY DEFINER RPC, so
// nothing has to be pasted into a dashboard env var by hand.
const CRON_SECRET_NAME = "voided_cron_secret";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-refunds-cron-secret",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

/** ES256 JWT for the App Store Server API — identical to the one
 * verify-apple-purchase builds (aud must be exactly "appstoreconnect-v1"). */
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

/** Apple keeps real and Sandbox transactions on different hosts and offers no
 * endpoint that serves both, so try production first (the common case) and
 * fall back — same order as verify-apple-purchase. */
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

interface LivePurchase {
  id: string;
  user_id: string;
  phase_id: string;
  apple_transaction_id: string | null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  // Called by pg_cron, never by the app.
  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const { data: secretOk, error: secretError } = await admin.rpc("cron_secret_matches", {
    p_name: CRON_SECRET_NAME,
    p_value: req.headers.get("x-refunds-cron-secret") ?? "",
  });
  if (secretError) {
    console.error("cron_secret_matches failed:", secretError);
    return jsonResponse({ error: "secret_check_failed" }, 500);
  }
  if (!secretOk) {
    return jsonResponse({ error: "unauthorized" }, 401);
  }

  // Our own list first. While no iOS purchase exists — which is the state
  // until iOS IAP ships — this returns here, so the job can be scheduled now
  // and simply does nothing rather than failing nightly on absent secrets.
  const { data: live, error: liveError } = await admin
    .from("phase_purchases")
    .select("id, user_id, phase_id, apple_transaction_id")
    .eq("platform", "ios")
    .is("revoked_at", null)
    .not("apple_transaction_id", "is", null);
  if (liveError) {
    console.error("reading live ios purchases failed:", liveError);
    return jsonResponse({ error: liveError.message }, 500);
  }
  const purchases = (live ?? []) as LivePurchase[];
  if (purchases.length === 0) return jsonResponse({ ok: true, checked: 0, revoked: 0, unknown: 0 });

  let appleJwt: string;
  try {
    appleJwt = await buildAppleJwt();
  } catch (e) {
    console.error("buildAppleJwt failed — check APPLE_* secrets:", e);
    return jsonResponse({ error: "apple_auth_setup_invalid" }, 500);
  }

  let revoked = 0;
  let unknown = 0;
  for (const purchase of purchases) {
    const transactionId = purchase.apple_transaction_id!;
    let claims: Record<string, unknown>;
    try {
      const signed = await fetchSignedTransactionInfo(transactionId, appleJwt);
      if (!signed) {
        // Apple did not answer for this one (network, rate limit, a sandbox
        // transaction it no longer serves). Say nothing and leave the
        // entitlement alone: revoking on a failed lookup would take content
        // away from someone who paid for it.
        unknown += 1;
        continue;
      }
      // Decoded rather than chain-verified for the same reason as
      // verify-apple-purchase: we fetched it ourselves over TLS from Apple's
      // authenticated API, and that round trip is the trust boundary.
      claims = decodeJwt(signed);
    } catch (e) {
      console.error("transaction lookup failed:", transactionId, e);
      unknown += 1;
      continue;
    }

    if (!claims.revocationDate) continue;

    // Apple tells us WHEN it was refunded, so keep that rather than "now" —
    // the Google job only has "now" because voidedpurchases is a feed.
    const revokedAt = new Date(Number(claims.revocationDate)).toISOString();
    const { error: updateError } = await admin
      .from("phase_purchases")
      .update({ revoked_at: revokedAt })
      .eq("id", purchase.id)
      .is("revoked_at", null);
    if (updateError) {
      console.error("revoke update failed:", purchase.id, updateError);
      continue;
    }
    revoked += 1;
    console.log(`revoked refunded purchase ${purchase.id} (phase ${purchase.phase_id}) at ${revokedAt}`);
  }

  return jsonResponse({ ok: true, checked: purchases.length, revoked, unknown });
});
