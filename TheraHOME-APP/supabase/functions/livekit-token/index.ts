// Mints the LiveKit access token for one call, for one participant.
//
// Why a function at all: a LiveKit room is entered with a JWT signed by the
// project's API secret. The secret cannot ship in the app — anyone holding it
// can mint a token for any room and listen in on any call. So the app asks
// here, and this is the only place that knows the secret.
//
// It also decides *whether* the caller may join, which is the real work. The
// rules are deliberately narrow:
//   - the row must be a real call that is currently 'accepted' (a room is
//     joined only after someone picks up — see the migration's note on
//     LiveKit billing every connected minute),
//   - the requester must be that call's customer, or hold admin/cskh.
// Anything else gets a 403 and no token, so a leaked call id is worthless.
//
// The grant is audio-only: `canPublishSources: ['microphone']`. The media
// server refuses a video track from this token even if a future client build
// tries to publish one, which keeps the feature inside the audio price band
// (US$0.99 vs $3.99 per 1,000 participant-minutes) by construction rather
// than by remembering not to turn the camera on.
//
// The JWT is signed here by hand with Web Crypto instead of pulling in
// livekit-server-sdk. It is sixty lines of HS256 against a documented claim
// shape, and it keeps a Node-oriented dependency out of the edge runtime.
//
// Secrets (Supabase dashboard → Edge Functions → Secrets):
//   LIVEKIT_URL         wss://<project>.livekit.cloud
//   LIVEKIT_API_KEY     API key  (LiveKit Cloud → Settings → Keys)
//   LIVEKIT_API_SECRET  API secret for that key
//
// LIVEKIT_URL is returned to the client with the token on purpose: the app
// never hardcodes it, so moving the LiveKit project (or pointing at a
// self-hosted server later) is a secret change, not an app rebuild.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LIVEKIT_URL = Deno.env.get("LIVEKIT_URL");
const LIVEKIT_API_KEY = Deno.env.get("LIVEKIT_API_KEY");
const LIVEKIT_API_SECRET = Deno.env.get("LIVEKIT_API_SECRET");

// Comfortably longer than any call this is for, and short enough that a
// token lifted off a device is not a permanent key to that room. The room
// name is per-call anyway, so the token dies with the conversation.
const TOKEN_TTL_SECONDS = 2 * 60 * 60;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function base64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlJson(value: unknown): string {
  return base64Url(new TextEncoder().encode(JSON.stringify(value)));
}

/** HS256 JWT in LiveKit's claim shape. `sub` is the participant identity the
 * other side sees; `video` is LiveKit's grant object. */
async function mintAccessToken({
  identity,
  name,
  room,
}: { identity: string; name: string; room: string }): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = base64UrlJson({ alg: "HS256", typ: "JWT" });
  const payload = base64UrlJson({
    iss: LIVEKIT_API_KEY,
    sub: identity,
    name,
    // A few seconds of slack for a phone whose clock is slightly behind the
    // edge runtime's; without it a correct token is rejected as not-yet-valid.
    nbf: now - 15,
    exp: now + TOKEN_TTL_SECONDS,
    video: {
      room,
      roomJoin: true,
      canSubscribe: true,
      canPublish: true,
      // The whole audio-only guarantee, enforced server-side.
      canPublishSources: ["microphone"],
      canPublishData: false,
      // Nobody may reconfigure or list rooms with a client token.
      roomCreate: false,
      roomList: false,
      roomAdmin: false,
    },
  });
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(LIVEKIT_API_SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
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

  // A missing secret is a setup error, not a user error — say so plainly
  // rather than returning an unsigned token the client cannot use.
  if (!LIVEKIT_URL || !LIVEKIT_API_KEY || !LIVEKIT_API_SECRET) {
    return json({ error: "livekit_not_configured" }, 503);
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
    .select("id, room_name, status, caller_id")
    .eq("id", callId)
    .maybeSingle();
  if (callError) return json({ error: "lookup_failed", detail: callError.message }, 500);
  if (!call) return json({ error: "call_not_found" }, 404);

  // Only a live conversation gets a token. Refusing 'ringing' is what stops
  // either side from sitting in a room while the phone rings, which is the
  // single biggest way to burn the free tier on calls nobody answered.
  if (call.status !== "accepted") return json({ error: "call_not_accepted", status: call.status }, 409);

  const { data: roles } = await callerClient.rpc("current_web_roles");
  const isStaff = Array.isArray(roles) && (roles.includes("admin") || roles.includes("cskh"));
  if (!isStaff && call.caller_id !== user.id) return json({ error: "not_a_participant" }, 403);

  // Identity doubles as the role marker the other side renders from, so the
  // customer's screen can label the remote participant without a second
  // round trip. Prefixed with the user id to stay unique — LiveKit evicts an
  // existing participant when a second one joins with the same identity.
  const identity = `${isStaff ? "cskh" : "user"}_${user.id}`;
  const { data: profile } = await admin
    .from("profiles")
    .select("full_name")
    .eq("id", user.id)
    .maybeSingle();
  const name = isStaff
    ? "TheraHOME CSKH"
    : (profile?.full_name?.trim() || "Khách hàng");

  const token = await mintAccessToken({ identity, name, room: call.room_name });
  return json({ token, url: LIVEKIT_URL, room: call.room_name, identity });
});
