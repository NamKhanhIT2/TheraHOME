import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

// Deletes form-check clips once they have served their purpose.
//
// A clip is watched once by a specialist, answered in writing, and then
// never needed again — but it was the heaviest thing the app stores, and
// nothing deleted it. The project is on Supabase's free plan: 1 GB of file
// storage as a HARD cap, where exceeding it disrupts the service rather than
// producing a bill. At ~5 MB a clip the feature would have walked the
// project into that wall and stopped there.
//
// What goes and what stays is the whole point: the FILE goes, the review row
// and the specialist's written answer stay. The customer keeps the advice,
// which is what they paid for; nobody re-watches their own 15-second clip
// from three weeks ago.
//
// The message that carried the clip has its attachment_path cleared in the
// same step. Leaving it pointed at a deleted object would make the chat
// screen ask for a signed URL to a file that is gone — a broken thumbnail
// instead of a message. Every one of these messages has a caption ("Nhờ
// chuyên viên xem giúp em bài tập Ngày N"), so what remains reads as a
// normal message rather than an empty bubble.
//
// Called by pg_cron, never by the app — same shared-secret pattern as
// sync-apple-refunds, reusing the same Vault secret so there is nothing new
// to set up by hand.

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const CRON_SECRET_NAME = "voided_cron_secret";
const BUCKET = "chat-attachments";

/** How long a graded clip is kept. Long enough that a customer who comes
 * back to the conversation a week later still sees their own video next to
 * the answer; short enough that the standing total is about half a month's
 * uploads rather than every clip ever sent. */
const RETENTION_DAYS = 14;

/** Rows per run. One batch a day is plenty at any volume this app will see
 * for a long time, and a bounded batch keeps the function well inside its
 * execution limit no matter how far behind it has fallen. */
const BATCH = 200;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-prune-cron-secret",
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
    p_value: req.headers.get("x-prune-cron-secret") ?? "",
  });
  if (secretError) {
    console.error("cron_secret_matches failed:", secretError);
    return jsonResponse({ error: "secret_check_failed" }, 500);
  }
  if (!secretOk) return jsonResponse({ error: "unauthorized" }, 401);

  const cutoff = new Date(Date.now() - RETENTION_DAYS * 86_400_000).toISOString();

  // Finished with, one way or the other. A review still 'pending' keeps its
  // clip however old it is — the specialist has not watched it yet, and
  // deleting it would destroy the thing the customer is waiting on.
  const { data: rows, error: rowsError } = await admin
    .from("form_reviews")
    .select("id, message_id, status, reviewed_at, created_at, video_bytes")
    .in("status", ["reviewed", "cancelled"])
    .is("clip_deleted_at", null)
    // Cancelled rows may never have been reviewed, so fall back to when the
    // clip was sent.
    .or(`reviewed_at.lt.${cutoff},and(reviewed_at.is.null,created_at.lt.${cutoff})`)
    .limit(BATCH);
  if (rowsError) {
    console.error("could not list reviews to prune:", rowsError);
    return jsonResponse({ error: rowsError.message }, 500);
  }
  if (!rows?.length) return jsonResponse({ ok: true, pruned: 0, freedBytes: 0 });

  const messageIds = rows.map((row) => row.message_id).filter(Boolean);
  const { data: messages, error: messagesError } = await admin
    .from("chat_messages")
    .select("id, attachment_path")
    .in("id", messageIds);
  if (messagesError) {
    console.error("could not read the messages:", messagesError);
    return jsonResponse({ error: messagesError.message }, 500);
  }

  const paths = (messages ?? [])
    .map((message) => message.attachment_path)
    .filter((path): path is string => !!path);

  // How much this run recovers — worth logging, since the whole reason this
  // function exists is a storage ceiling. Taken from the size recorded when
  // the review was filed, NOT by querying storage.objects: the `storage`
  // schema is not exposed through the API, so that read would simply fail.
  const freedBytes = rows.reduce((total, row) => total + Number(row.video_bytes ?? 0), 0);

  if (paths.length) {
    const { error: removeError } = await admin.storage.from(BUCKET).remove(paths);
    // A file already gone is not a failure — it means a previous run removed
    // it and died before writing clip_deleted_at. Pressing on is what makes
    // this job idempotent; stopping here would wedge it on one bad row
    // forever.
    if (removeError) console.error("some objects could not be removed (continuing):", removeError);
  }

  // Clear the pointer BEFORE marking the review pruned. In the other order a
  // crash between the two would leave a message pointing at a deleted file
  // and a row saying the work was finished, which nothing would ever fix.
  if (messageIds.length) {
    const { error: clearError } = await admin
      .from("chat_messages")
      .update({ attachment_path: null })
      .in("id", messageIds);
    if (clearError) {
      console.error("could not clear attachment paths:", clearError);
      return jsonResponse({ error: clearError.message }, 500);
    }
  }

  const { error: markError } = await admin
    .from("form_reviews")
    .update({ clip_deleted_at: new Date().toISOString() })
    .in("id", rows.map((row) => row.id));
  if (markError) {
    console.error("could not mark reviews pruned:", markError);
    return jsonResponse({ error: markError.message }, 500);
  }

  console.log(`pruned ${rows.length} clips, freed ${(freedBytes / 1048576).toFixed(1)} MB`);
  return jsonResponse({ ok: true, pruned: rows.length, freedBytes });
});
