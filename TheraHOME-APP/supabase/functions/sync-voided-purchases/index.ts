import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { SignJWT, importPKCS8 } from "npm:jose@5";

// Closes the refund loophole (owner 2026-09-25): a customer could buy a
// phase, watch all of its days in one sitting, ask Google for a refund
// inside the 48-hour window, and keep the content — nothing ever wrote
// phase_purchases.revoked_at, which the app, the web and the unlock rules
// all read.
//
// Google exposes every voided order (user refund, developer refund,
// chargeback, fraud) through purchases.voidedpurchases. This runs daily,
// reads that list and revokes the matching rows. Idempotent: a token
// already revoked is skipped, so re-running changes nothing.
//
// Refunds are Google's to grant, not ours to prevent — see the Play refund
// policy. The only thing under our control is not still serving the
// content afterwards.

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// Same three secrets verify-google-purchase uses — one service account.
const GOOGLE_SERVICE_ACCOUNT_EMAIL = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_EMAIL")!;
const GOOGLE_SERVICE_ACCOUNT_KEY = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_KEY")!;
const GOOGLE_PLAY_PACKAGE_NAME = Deno.env.get("GOOGLE_PLAY_PACKAGE_NAME")!;
// The shared secret lives in Vault, not in a dashboard env var: pg_cron
// reads it when calling this function, and `cron_secret_matches` (SECURITY
// DEFINER) answers whether the header we were sent equals it. One value,
// one place, nothing to paste by hand.
const CRON_SECRET_NAME = "voided_cron_secret";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-voided-cron-secret",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

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

interface VoidedPurchase {
  purchaseToken?: string;
  orderId?: string;
  voidedTimeMillis?: string;
  /** 0 = the user asked, 1 = the developer did, 2 = Google did. */
  voidedSource?: number;
  /** 0 = other, 1 = remorse, 2 = not_received, 3 = defective,
   *  4 = accidental_purchase, 5 = fraud, 6 = friendly_fraud, 7 = chargeback. */
  voidedReason?: number;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  // Called by pg_cron, never by the app.
  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const { data: secretOk, error: secretError } = await admin.rpc("cron_secret_matches", {
    p_name: CRON_SECRET_NAME,
    p_value: req.headers.get("x-voided-cron-secret") ?? "",
  });
  if (secretError) {
    console.error("cron_secret_matches failed:", secretError);
    return jsonResponse({ error: "secret_check_failed" }, 500);
  }
  if (!secretOk) {
    return jsonResponse({ error: "unauthorized" }, 401);
  }

  let accessToken: string;
  try {
    accessToken = await buildGoogleAccessToken();
  } catch (e) {
    console.error("buildGoogleAccessToken failed — check GOOGLE_* secrets:", e);
    return jsonResponse({ error: "google_auth_setup_invalid" }, 500);
  }

  // Google keeps 30 days of voided orders and REJECTS a startTime exactly on
  // that edge ("Start time must be within [30] days of data", seen
  // 2026-09-25) — so ask for 29, which still covers every refund since the
  // previous daily run with room for a few failed ones.
  const startTime = Date.now() - 29 * 24 * 60 * 60 * 1000;

  const voided: VoidedPurchase[] = [];
  let token: string | undefined;
  try {
    // type=1 returns voided one-time purchases AND subscriptions; we only
    // sell one-time products today, and matching is by token anyway.
    do {
      const url = new URL(
        `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${encodeURIComponent(GOOGLE_PLAY_PACKAGE_NAME)}/purchases/voidedpurchases`,
      );
      url.searchParams.set("startTime", String(startTime));
      url.searchParams.set("type", "1");
      url.searchParams.set("maxResults", "1000");
      if (token) url.searchParams.set("token", token);
      const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
      if (!res.ok) {
        console.error("voidedpurchases failed:", res.status, await res.text());
        return jsonResponse({ error: "voided_list_failed", status: res.status }, 502);
      }
      const page = await res.json();
      for (const item of page?.voidedPurchases ?? []) voided.push(item as VoidedPurchase);
      token = page?.tokenPagination?.nextPageToken;
    } while (token);
  } catch (e) {
    console.error("voidedpurchases request threw:", e);
    return jsonResponse({ error: "voided_list_failed" }, 502);
  }

  const tokens = voided.map((v) => v.purchaseToken).filter((t): t is string => !!t);
  if (tokens.length === 0) return jsonResponse({ ok: true, voided: 0, revoked: 0 });

  // Revoke only rows still live, so revoked_at keeps the FIRST revocation
  // time across runs.
  const { data: revokedRows, error } = await admin
    .from("phase_purchases")
    .update({ revoked_at: new Date().toISOString() })
    .in("google_purchase_token", tokens)
    .is("revoked_at", null)
    .select("id, user_id, phase_id");
  if (error) {
    console.error("revoke update failed:", error);
    return jsonResponse({ error: error.message }, 500);
  }

  if (revokedRows && revokedRows.length > 0) {
    console.log(`revoked ${revokedRows.length} refunded purchase(s):`, revokedRows.map((r) => r.id).join(", "));
  }
  return jsonResponse({ ok: true, voided: tokens.length, revoked: revokedRows?.length ?? 0 });
});
