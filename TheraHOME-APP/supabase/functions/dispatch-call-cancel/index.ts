// Stops a phone that is still ringing for a call that no longer is.
//
// WHY THIS EXISTS AT ALL. Ending a call reaches the other side over
// Realtime, and that is enough whenever the app is running. The one case it
// cannot reach is the one that matters most: the app closed, the phone
// locked, and the only thing on screen a system call screen raised by a
// push. Nothing in the app is alive to take that screen down — being dead is
// the whole reason the screen exists — so it rings on until someone answers
// a call that ended minutes ago. A second push is the only way in.
//
// WHY IT IS NOT A MODE IN `dispatch-push`. It was, briefly. That function is
// 400 lines serving broadcasts, chat, social and roadmap pushes; this is
// ninety lines serving one event, and redeploying the big one to add it put
// every other notification in the app at risk for no benefit. The Expo send
// below is the only thing duplicated, and it is fifteen lines.
//
// THE iOS HALF IS ELSEWHERE: `dispatch-voip-push` with `cancel: true`.
// PushKit is a separate channel with separate tokens, and a cancel there has
// to obey Apple's rule that every VoIP push reports a call to CallKit — it
// reports one and ends it in the same breath. The client calls both, exactly
// as it calls both to start a call ringing.
//
// Deliberately silent: no title, no body, no sound. A visible notification
// saying "that call is over" is the opposite of the point.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const authorization = request.headers.get("Authorization") ?? "";
    const callerClient = createClient(url, anonKey, {
      global: { headers: { Authorization: authorization } },
    });
    const admin = createClient(url, serviceKey);

    // The token is passed explicitly, which is the documented form and the
    // only one that does not depend on the client having a stored session.
    //
    // Not a fix for a library bug, despite how it looked on 2026-10-19: for
    // hours every call from one device came back 401 and `getUser()` said
    // "Auth session missing!", which reads like the library losing the
    // token. It was not. The Auth server was answering 403
    // `session_not_found` — a correctly signed, unexpired token whose
    // session row had been deleted — and the library rendered that as a
    // missing session. The same code answered 200 all along for every
    // device whose session still existed.
    //
    // Worth keeping anyway: it removes a dependency on where the library
    // looks for the token, and it costs nothing.
    const { data: { user }, error: userError } = await callerClient.auth.getUser(authorization.replace(/^Bearer\s+/i, ""));
    if (userError || !user) return json({ error: "unauthorized" }, 401);

    const body = await request.json() as { callId?: unknown };
    if (typeof body.callId !== "string" || !body.callId) {
      return json({ error: "call_id_required" }, 400);
    }

    const { data: call, error: callError } = await admin
      .from("calls")
      .select("id, caller_id, callee_id, answered_by, status")
      .eq("id", body.callId)
      .maybeSingle();
    if (callError) return json({ error: "lookup_failed", detail: callError.message }, 500);
    if (!call) return json({ error: "call_not_found" }, 404);

    // Staff ids are needed twice for a call addressed to the support LINE —
    // once to decide whether this user may cancel it, once to decide whose
    // phones to unring — so they are loaded here, before either.
    let staffIds: string[] = [];
    if (!call.callee_id) {
      const { data: staff, error: staffError } = await admin.rpc("staff_user_ids");
      if (staffError) return json({ error: "staff_lookup_failed", detail: staffError.message }, 500);
      staffIds = (staff ?? [])
        .map((row: unknown) => (
          typeof row === "string" ? row : (row as { staff_user_ids?: string })?.staff_user_ids
        ))
        .filter((id: unknown): id is string => typeof id === "string" && !!id);
    }

    // Anyone who was in the call may unring the others: the caller who gave
    // up, and whoever answered first. On a support-line call the answerer is
    // `answered_by` and not `callee_id`, because answering a call addressed
    // to the line does not address it to a person.
    //
    // Staff count as participants in a call addressed to the LINE even when
    // they never answered it. Declining is a resolution too, and it is the
    // one that most needs the other phones told. `end_call` has allowed
    // exactly this from the start (`callee_id is null and v_is_staff`);
    // leaving it out here meant a declined support call came back 403 and
    // every other staff phone went on ringing, with nothing alive on a
    // locked handset able to take the call screen down. Measured on call
    // 96e36ee8 at 2026-10-14 17:48:58, where both cancel channels were
    // refused one second after the decline landed.
    const isParticipant = call.caller_id === user.id
      || call.callee_id === user.id
      || call.answered_by === user.id
      || (!call.callee_id && staffIds.includes(user.id));
    if (!isParticipant) return json({ error: "participant_required" }, 403);

    // Refused while the call is still ringing, which is what stops this
    // being a way to silence somebody else's live call. A cancel can only
    // ever follow a real resolution.
    if (call.status === "ringing") return json({ sent: 0, reason: "still_ringing" });

    // Loaded above, from the same single source as every other staff fan-out
    // — see 202610111300_staff_user_ids_single_source.sql for why that is an
    // RPC and not a query against web_access_contacts.
    let recipientIds: string[] = call.callee_id ? [call.callee_id as string] : staffIds;
    // Never back to whoever resolved it. On the "answered first" path that
    // device is the one holding a LIVE call, and telling it to stop ringing
    // would hang up on a conversation in progress.
    recipientIds = [...new Set(recipientIds)].filter((id) => id && id !== user.id);
    if (!recipientIds.length) return json({ sent: 0, reason: "no_recipients" });

    const { data: tokens, error: tokenError } = await admin
      .from("push_tokens")
      .select("expo_push_token")
      .in("user_id", recipientIds);
    if (tokenError) return json({ error: "token_lookup_failed", detail: tokenError.message }, 500);

    const seen = new Set<string>();
    const messages = (tokens ?? [])
      .map((row: { expo_push_token: string | null }) => row.expo_push_token)
      .filter((token): token is string => {
        if (!token || seen.has(token)) return false;
        seen.add(token);
        return true;
      })
      .map((token) => ({
        to: token,
        // No title and no body: expo-notifications hands this to the app's
        // background task and shows nothing at all.
        data: { type: "call_cancel", callId: call.id },
        // What makes iOS wake the app for a push carrying no alert. Harmless
        // on Android, which delivers data messages either way.
        _contentAvailable: true,
        priority: "high",
        channelId: "calls-v1",
      }));
    if (!messages.length) return json({ sent: 0, reason: "no_tokens" });

    const accessToken = Deno.env.get("EXPO_ACCESS_TOKEN");
    const tickets: unknown[] = [];
    for (let index = 0; index < messages.length; index += 100) {
      const response = await fetch("https://exp.host/--/api/v2/push/send", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
        body: JSON.stringify(messages.slice(index, index + 100)),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(JSON.stringify(result));
      tickets.push(result);
    }
    return json({ sent: messages.length, tickets });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : String(error) }, 500);
  }
});
