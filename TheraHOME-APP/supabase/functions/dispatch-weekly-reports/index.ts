import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

// "Báo cáo tiến độ gửi hàng tuần" — a Premium benefit that did not exist
// until now. Once a week it writes one notification per subscriber with the
// week they just had, and pushes it.
//
// The numbers come from `weekly_progress_for()` so the window is
// Asia/Ho_Chi_Minh and the client does no arithmetic of its own. The one
// figure worth the trouble is the discomfort trend: days done and streak are
// already on the Home screen, but whether the score is moving WEEK over WEEK
// is not visible anywhere in the app.
//
// Called by pg_cron, never by the app — same shared-secret pattern as the
// refund sweeps, reusing the same Vault value so nothing new has to be set
// up by hand.

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const CRON_SECRET_NAME = "voided_cron_secret";

type Lang = "vi" | "en" | "ms";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-weekly-cron-secret",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function asLang(value: unknown): Lang {
  return value === "en" || value === "ms" ? value : "vi";
}

const TITLE: Record<Lang, string> = {
  vi: "Báo cáo tuần của bạn",
  en: "Your week in review",
  ms: "Laporan minggu anda",
};

/** A week with nothing in it still gets a report — that IS the report, and
 * the nudge is the point of sending one. */
const NOTHING: Record<Lang, string> = {
  vi: "Tuần qua bạn chưa tập buổi nào. Mở lộ trình và bắt đầu lại từ hôm nay nhé — một buổi cũng tính.",
  en: "You did not train at all last week. Open your plan and start again today — one session counts.",
  ms: "Anda tidak berlatih minggu lepas. Buka pelan anda dan mulakan semula hari ini — satu sesi pun dikira.",
};

interface Progress {
  days_done?: number;
  streak?: number;
  adherence_pct?: number;
  pain_avg?: number | null;
  pain_avg_prev?: number | null;
}

/** The discomfort sentence, or '' when there is nothing honest to say.
 *
 * Only claims a direction when BOTH weeks have data and the gap is at least
 * 0.5 — below that it is noise on a 0–10 self-report, and telling somebody
 * their pain improved by 0.1 is the kind of number that destroys trust in
 * every other number beside it. */
function painSentence(lang: Lang, progress: Progress): string {
  const now = progress.pain_avg;
  const before = progress.pain_avg_prev;
  if (now == null) return "";
  const score = Number(now).toFixed(1);
  if (before == null) {
    return { vi: ` Mức khó chịu trung bình ${score}/10.`, en: ` Average discomfort ${score}/10.`, ms: ` Ketidakselesaan purata ${score}/10.` }[lang];
  }
  const delta = Number(before) - Number(now);
  if (Math.abs(delta) < 0.5) {
    return { vi: ` Mức khó chịu giữ ở ${score}/10.`, en: ` Discomfort steady at ${score}/10.`, ms: ` Ketidakselesaan kekal pada ${score}/10.` }[lang];
  }
  const size = Math.abs(delta).toFixed(1);
  if (delta > 0) {
    return { vi: ` Mức khó chịu giảm ${size} điểm, còn ${score}/10.`, en: ` Discomfort down ${size} points to ${score}/10.`, ms: ` Ketidakselesaan turun ${size} mata ke ${score}/10.` }[lang];
  }
  return { vi: ` Mức khó chịu tăng ${size} điểm, lên ${score}/10. Nếu còn tăng, nhắn cho chuyên viên nhé.`, en: ` Discomfort up ${size} points to ${score}/10. If it keeps rising, message a specialist.`, ms: ` Ketidakselesaan naik ${size} mata ke ${score}/10. Jika terus naik, hantar mesej kepada pakar.` }[lang];
}

function reportBody(lang: Lang, progress: Progress): string {
  const days = Number(progress.days_done ?? 0);
  if (days === 0) return NOTHING[lang];
  const streak = Number(progress.streak ?? 0);
  const adherence = Number(progress.adherence_pct ?? 0);
  const head = {
    vi: `Tuần qua bạn hoàn thành ${days} buổi, chuỗi ${streak} ngày, tuân thủ ${adherence}%.`,
    en: `Last week: ${days} sessions, a ${streak}-day streak, ${adherence}% adherence.`,
    ms: `Minggu lepas: ${days} sesi, rentetan ${streak} hari, kepatuhan ${adherence}%.`,
  }[lang];
  return head + painSentence(lang, progress);
}

/** Expo accepts 100 messages a request. Copied in shape from
 * dispatch-system-notifications so both crons push identically — same sound,
 * same Android channel, same priority. */
async function sendExpo(messages: Array<{ to: string; title: string; body: string }>) {
  if (messages.length === 0) return;
  const accessToken = Deno.env.get("EXPO_ACCESS_TOKEN");
  for (let index = 0; index < messages.length; index += 100) {
    const response = await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}) },
      body: JSON.stringify(
        messages.slice(index, index + 100).map((message) => ({
          ...message,
          sound: "ting.wav",
          channelId: "default-v2",
          priority: "high",
        })),
      ),
    });
    if (!response.ok) throw new Error(`Expo push failed: ${await response.text()}`);
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  const { data: secretOk, error: secretError } = await admin.rpc("cron_secret_matches", {
    p_name: CRON_SECRET_NAME,
    p_value: req.headers.get("x-weekly-cron-secret") ?? "",
  });
  if (secretError) {
    console.error("cron_secret_matches failed:", secretError);
    return jsonResponse({ error: "secret_check_failed" }, 500);
  }
  if (!secretOk) return jsonResponse({ error: "unauthorized" }, 401);

  // Everyone holding a live subscription right now. Expiry is evaluated here
  // the same way active_plan_code() evaluates it, rather than trusting
  // `status` alone — a subscription whose period ended yesterday is not owed
  // a report.
  const nowIso = new Date().toISOString();
  const { data: subscriptions, error: subsError } = await admin
    .from("user_subscriptions")
    .select("user_id, current_period_end")
    .eq("status", "active")
    .is("revoked_at", null);
  if (subsError) {
    console.error("could not list subscribers:", subsError);
    return jsonResponse({ error: subsError.message }, 500);
  }

  const recipients = new Set(
    (subscriptions ?? [])
      .filter((row) => !row.current_period_end || row.current_period_end > nowIso)
      .map((row) => row.user_id as string),
  );

  // Review accounts too: App Review has to be able to SEE a benefit it did
  // not buy, and the same rule already exempts them from every gate.
  const { data: reviewers } = await admin.from("profiles").select("id").eq("account_type", "review");
  for (const reviewer of reviewers ?? []) recipients.add(reviewer.id as string);

  if (recipients.size === 0) return jsonResponse({ ok: true, sent: 0 });

  const { data: profiles } = await admin
    .from("profiles")
    .select("id, language")
    .in("id", [...recipients]);
  const langOf = new Map((profiles ?? []).map((row) => [row.id as string, asLang(row.language)]));

  const rows: Array<{ user_id: string; type: string; title: string; body: string; push_title: string; push_body: string }> = [];
  for (const userId of recipients) {
    const lang = langOf.get(userId) ?? "vi";
    const { data: progress, error: progressError } = await admin.rpc("weekly_progress_for", { p_user: userId });
    if (progressError) {
      // One customer's report failing must not cost everyone else theirs.
      console.error(`weekly_progress_for(${userId}) failed:`, progressError);
      continue;
    }
    const body = reportBody(lang, (progress ?? {}) as Progress);
    rows.push({
      user_id: userId,
      // An existing type on purpose. The app maps unknown types to nothing,
      // so a brand-new one would render as a blank row in the inbox of every
      // build already in the wild.
      type: "schedule",
      title: TITLE[lang],
      body,
      push_title: TITLE[lang],
      push_body: body,
    });
  }

  if (rows.length === 0) return jsonResponse({ ok: true, sent: 0 });

  const { error: insertError } = await admin.from("notifications").insert(rows);
  if (insertError) {
    console.error("could not write the reports:", insertError);
    return jsonResponse({ error: insertError.message }, 500);
  }

  // The inbox row IS the report; the push is only how somebody finds out it
  // arrived. A failed push is therefore logged and swallowed — the report is
  // already saved either way.
  //
  // Sent from here rather than through `dispatch-push`: that function
  // authenticates its caller with `auth.getUser()` and derives staff rights
  // from the caller's own roles, so a service-role key is not a user to it
  // and the call would come back 401. Same inline pattern as
  // dispatch-system-notifications, the other cron that notifies customers.
  try {
    const { data: tokens } = await admin
      .from("push_tokens")
      .select("user_id, expo_push_token")
      .in("user_id", rows.map((row) => row.user_id));
    const contentOf = new Map(rows.map((row) => [row.user_id, { title: row.push_title, body: row.push_body }]));
    const messages = (tokens ?? [])
      .map((token) => {
        const content = contentOf.get(token.user_id as string);
        if (!content || !token.expo_push_token) return null;
        return { to: token.expo_push_token as string, title: content.title, body: content.body };
      })
      .filter((message): message is { to: string; title: string; body: string } => message !== null);
    await sendExpo(messages);
  } catch (e) {
    console.error("push delivery failed (the reports are saved):", e);
  }

  console.log(`sent ${rows.length} weekly reports`);
  return jsonResponse({ ok: true, sent: rows.length });
});
