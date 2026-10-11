// Sends the VoIP push that makes a locked iPhone ring.
//
// This exists because Expo's push service cannot. A VoIP push is not a
// louder notification — it is a different APNs message type, to a different
// topic, carrying a different device token:
//
//   apns-push-type: voip          (Expo only ever sends `alert`)
//   apns-topic:     <bundle>.voip (Expo sends the plain bundle id)
//   apns-priority:  10
//   token:          a PushKit token, not an Expo token
//
// So this talks to APNs directly, signing its own ES256 provider JWT. The
// JWT is built with Web Crypto rather than a library for the same reason
// `livekit-token` does: it is thirty lines against a documented shape, and
// it keeps a Node-oriented dependency out of the edge runtime.
//
// WHAT THE RECEIVING APP OWES APPLE: every VoIP push must result in an
// incoming call being reported to CallKit, immediately and unconditionally.
// iOS kills an app that takes a VoIP push without doing so, and repeated
// offences stop VoIP pushes being delivered at all. That is why this
// function refuses to send for a call that is no longer ringing — a push
// the app cannot honour is worse than no push.
//
// Secrets (Supabase dashboard → Edge Functions → Secrets):
//   APNS_KEY_ID      the Key ID of an APNs auth key (Apple Developer → Keys)
//   APNS_TEAM_ID     the Apple Developer team id
//   APNS_PRIVATE_KEY the .p8 contents, including the BEGIN/END lines
//   APNS_ENVIRONMENT "production" (default) or "sandbox" for a dev build
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const APNS_KEY_ID = Deno.env.get("APNS_KEY_ID");
const APNS_TEAM_ID = Deno.env.get("APNS_TEAM_ID");
const APNS_PRIVATE_KEY = Deno.env.get("APNS_PRIVATE_KEY");
const APNS_ENVIRONMENT = Deno.env.get("APNS_ENVIRONMENT") ?? "production";

const BUNDLE_ID = "ai.therahome";
const APNS_HOST = APNS_ENVIRONMENT === "sandbox"
  ? "https://api.sandbox.push.apple.com"
  : "https://api.push.apple.com";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function base64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** Strips the PEM armour and decodes the body to the DER bytes Web Crypto
 * wants for a PKCS#8 import. */
function pemToBytes(pem: string): Uint8Array {
  const body = pem
    .replace(/-----BEGIN [^-]+-----/g, "")
    .replace(/-----END [^-]+-----/g, "")
    .replace(/\s+/g, "");
  const binary = atob(body);
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
}

/** APNs provider token: ES256 over {iss: team, iat}, kid = key id. Valid for
 * up to an hour; minted per invocation because an edge instance is short
 * lived and caching it across cold starts would buy nothing. */
async function mintProviderToken(): Promise<string> {
  const header = base64Url(new TextEncoder().encode(
    JSON.stringify({ alg: "ES256", kid: APNS_KEY_ID }),
  ));
  const payload = base64Url(new TextEncoder().encode(
    JSON.stringify({ iss: APNS_TEAM_ID, iat: Math.floor(Date.now() / 1000) }),
  ));
  const key = await crypto.subtle.importKey(
    "pkcs8",
    pemToBytes(APNS_PRIVATE_KEY!),
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"],
  );
  // Web Crypto emits the raw r||s pair ECDSA JWTs require, so unlike the
  // openssl path there is no DER unwrapping to do here.
  const signature = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    key,
    new TextEncoder().encode(`${header}.${payload}`),
  );
  return `${header}.${payload}.${base64Url(new Uint8Array(signature))}`;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  // A setup gap, not a user error. The caller treats this as "iOS cannot
  // ring from the lock screen yet" and carries on with the normal push.
  //
  // NAMES the missing variables. A bare "not configured" sent us looking at
  // the wrong thing once already: all four secrets had in fact been added,
  // one under a name this code does not read, and nothing said which.
  // Reporting absence is safe — it is a list of variable names, never values.
  const missing = [
    ["APNS_KEY_ID", APNS_KEY_ID],
    ["APNS_TEAM_ID", APNS_TEAM_ID],
    ["APNS_PRIVATE_KEY", APNS_PRIVATE_KEY],
  ].filter(([, value]) => !value).map(([name]) => name);
  if (missing.length) {
    return json({ error: "apns_not_configured", missing }, 503);
  }
  // A .p8 pasted without its armour is the other way this fails, and it
  // fails later and far less clearly — at importKey, as a DataError.
  if (!APNS_PRIVATE_KEY.includes("BEGIN PRIVATE KEY")) {
    return json({
      error: "apns_private_key_malformed",
      hint: "APNS_PRIVATE_KEY must include the -----BEGIN PRIVATE KEY----- and -----END PRIVATE KEY----- lines",
    }, 503);
  }

  const authorization = request.headers.get("Authorization");
  if (!authorization) return json({ error: "unauthorized" }, 401);
  const callerClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authorization } },
  });
  const { data: userData, error: userError } = await callerClient.auth.getUser();
  if (userError || !userData?.user) return json({ error: "unauthorized" }, 401);
  const user = userData.user;

  let callId: string;
  try {
    const body = await request.json() as { callId?: unknown };
    if (typeof body.callId !== "string" || !body.callId) throw new Error("callId");
    callId = body.callId;
  } catch {
    return json({ error: "call_id_required" }, 400);
  }

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const { data: call, error: callError } = await admin
    .from("calls")
    .select("id, caller_id, callee_id, status, media")
    .eq("id", callId)
    .maybeSingle();
  if (callError) return json({ error: "lookup_failed", detail: callError.message }, 500);
  if (!call) return json({ error: "call_not_found" }, 404);
  // Same authority rule as the normal push: the row says who is calling, not
  // the request body.
  if (call.caller_id !== user.id) return json({ error: "caller_required" }, 403);
  if (call.status !== "ringing") return json({ sent: 0, reason: "not_ringing" });

  // Who should ring: the named callee, or every staff account when the call
  // is addressed to the support line.
  let recipientIds: string[];
  if (call.callee_id) {
    recipientIds = [call.callee_id as string];
  } else {
    const { data: staff, error: staffError } = await admin.rpc("staff_user_ids");
    if (staffError) return json({ error: "staff_lookup_failed", detail: staffError.message }, 500);
    recipientIds = (staff ?? [])
      .map((row: unknown) => (typeof row === "string" ? row : (row as { staff_user_ids?: string })?.staff_user_ids))
      .filter((id: unknown): id is string => typeof id === "string" && !!id);
  }
  if (!recipientIds.length) return json({ sent: 0, reason: "no_recipients" });

  const { data: tokenRows, error: tokenError } = await admin
    .rpc("voip_tokens_for", { p_user_ids: recipientIds });
  if (tokenError) return json({ error: "token_lookup_failed", detail: tokenError.message }, 500);
  const tokens = (tokenRows ?? [])
    .map((row: unknown) => (typeof row === "string" ? row : (row as { voip_tokens_for?: string })?.voip_tokens_for))
    .filter((t: unknown): t is string => typeof t === "string" && !!t);
  if (!tokens.length) return json({ sent: 0, reason: "no_voip_tokens" });

  const { data: callerProfile } = await admin
    .from("profiles").select("full_name").eq("id", user.id).maybeSingle();
  const callerName = call.callee_id
    ? "TheraHOME CSKH"
    : (callerProfile?.full_name?.trim() || "Khách hàng");

  const providerToken = await mintProviderToken();
  // The payload the app hands straight to CallKit. Deliberately flat and
  // small: PushKit caps VoIP payloads, and the receiving code runs in a
  // context with no time to go and look anything up.
  const payload = JSON.stringify({
    callId: call.id,
    callerName,
    media: call.media,
    hasVideo: call.media === "video",
  });

  const results = await Promise.all(tokens.map(async (token) => {
    try {
      const response = await fetch(`${APNS_HOST}/3/device/${token}`, {
        method: "POST",
        headers: {
          authorization: `bearer ${providerToken}`,
          // The .voip suffix is what makes this a PushKit delivery; without
          // it APNs rejects the push type.
          "apns-topic": `${BUNDLE_ID}.voip`,
          "apns-push-type": "voip",
          "apns-priority": "10",
          "apns-expiration": "0",
        },
        body: payload,
      });
      if (response.ok) return { token: token.slice(0, 8), ok: true };
      const detail = await response.text();
      // 410 Unregistered means the device will never accept another push on
      // this token — clear it so the next call does not wait on a dead one.
      if (response.status === 410) {
        await admin.from("voip_tokens").delete().eq("token", token);
      }
      return { token: token.slice(0, 8), ok: false, status: response.status, detail };
    } catch (error) {
      return { token: token.slice(0, 8), ok: false, detail: String(error) };
    }
  }));

  const sent = results.filter((r) => r.ok).length;
  return json({ sent, results });
});
