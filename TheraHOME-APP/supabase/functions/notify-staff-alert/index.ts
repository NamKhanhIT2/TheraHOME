import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

// Rings the staff PHONE for a work-queue item that nothing else pushes.
//
// The CSKH console hears every `staff_alerts` row over Realtime. The phone
// is the other half, and it was already covered for two of the three kinds:
// a chat message and a form-check clip both travel as chat messages, so
// `dispatch-push` mode 'chat' already reaches staff. A subscription reaches
// nobody — which is the gap the owner named on 2026-10-13.
//
// So this handles SUBSCRIPTION alerts only. Pushing for the other kinds here
// would double up with dispatch-push, and two notifications for one message
// is worse than one.
//
// Called by a trigger through pg_net, never by the app — same shared-secret
// pattern as the cron functions, reusing the same Vault value so there is
// nothing new to set up by hand. It is NOT called from verify-subscription:
// the payment path should not grow a reason to fail, and the trigger covers
// an admin's manual grant too, which never goes near that function.

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const CRON_SECRET_NAME = "voided_cron_secret";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-staff-alert-secret",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  const { data: secretOk, error: secretError } = await admin.rpc("cron_secret_matches", {
    p_name: CRON_SECRET_NAME,
    p_value: req.headers.get("x-staff-alert-secret") ?? "",
  });
  if (secretError) {
    console.error("cron_secret_matches failed:", secretError);
    return jsonResponse({ error: "secret_check_failed" }, 500);
  }
  if (!secretOk) return jsonResponse({ error: "unauthorized" }, 401);

  let body: { alertId?: string };
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "invalid_json" }, 400);
  }
  if (!body.alertId) return jsonResponse({ error: "missing_alert_id" }, 400);

  // Read the alert rather than trust the trigger's payload: the row is the
  // record, and reading it means a retry can never push a stale title.
  const { data: alert, error: alertError } = await admin
    .from("staff_alerts")
    .select("id, kind, title, body, handled_at")
    .eq("id", body.alertId)
    .maybeSingle();
  if (alertError) return jsonResponse({ error: alertError.message }, 500);
  if (!alert) return jsonResponse({ ok: true, skipped: "gone" });
  // Somebody got there first in the second it took to arrive here.
  if (alert.handled_at) return jsonResponse({ ok: true, skipped: "handled" });
  if (alert.kind !== "subscription" && alert.kind !== "subscription_refund") {
    return jsonResponse({ ok: true, skipped: "kind" });
  }

  // `staff_user_ids()` rather than a query of its own: staff on this project
  // are staff by profiles.account_type and their contact rows carry empty
  // roles, so an inline roles query misses every real one. The same mistake
  // cost dispatch-push its staff recipients once already.
  const { data: staffRows, error: staffError } = await admin.rpc("staff_user_ids");
  if (staffError) return jsonResponse({ error: staffError.message }, 500);
  const ids = (staffRows ?? [])
    .map((row: unknown) => (typeof row === "string" ? row : (row as { staff_user_ids?: string })?.staff_user_ids))
    .filter((id: unknown): id is string => typeof id === "string");
  if (ids.length === 0) return jsonResponse({ ok: true, sent: 0 });

  const { data: tokens, error: tokenError } = await admin
    .from("push_tokens")
    .select("expo_push_token")
    .in("user_id", ids);
  if (tokenError) return jsonResponse({ error: tokenError.message }, 500);

  const messages = (tokens ?? [])
    .map((row: { expo_push_token: string | null }) => row.expo_push_token)
    .filter((token: string | null): token is string => !!token)
    .map((to: string) => ({
      to,
      title: alert.title,
      body: alert.body ?? "Mở TheraHOME để xem",
      sound: "ting.wav",
      channelId: "default-v2",
      priority: "high",
    }));
  if (messages.length === 0) return jsonResponse({ ok: true, sent: 0 });

  const accessToken = Deno.env.get("EXPO_ACCESS_TOKEN");
  const response = await fetch("https://exp.host/--/api/v2/push/send", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}) },
    body: JSON.stringify(messages.slice(0, 100)),
  });
  if (!response.ok) {
    const text = await response.text();
    console.error("Expo push failed:", text);
    return jsonResponse({ error: "push_failed" }, 502);
  }

  return jsonResponse({ ok: true, sent: messages.length });
});
