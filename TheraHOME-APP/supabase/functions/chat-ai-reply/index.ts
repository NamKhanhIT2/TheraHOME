import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

// Auto-injected by Supabase into every Edge Function — no manual setup needed.
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// Must be set manually via `supabase secrets set GROQ_API_KEY=...` (or the
// dashboard) — see docs/manual-setup.md. Without this key the function still
// responds (with a localized fallback) instead of erroring, so the chat UI
// stays usable end-to-end before that step is done.
const GROQ_API_KEY = Deno.env.get("GROQ_API_KEY");
const GROQ_MODEL = Deno.env.get("GROQ_MODEL") || "llama-3.3-70b-versatile";

type Lang = "vi" | "en" | "ms";

// Used only if the ai_prompts row is somehow missing (it's seeded by
// migration 202608192000_ai_assistant_admin.sql) — keeps the function
// working even in that edge case rather than erroring. Language-neutral on
// purpose: the LANGUAGE_RULE below is what decides the reply language.
const DEFAULT_SYSTEM_PROMPT =
  'Bạn là Trợ lý AI của TheraHOME, một ứng dụng đồng hành cho các thiết bị hỗ trợ tập luyện TheraNECK/TheraBACK. Trả lời ngắn gọn, thân thiện. KHÔNG chẩn đoán bệnh lý hay thay thế tư vấn y tế chuyên môn — khuyên người dùng nhấn "Chat với Chuyên gia TheraHOME" nếu triệu chứng nghiêm trọng.';

// Reply language follows the customer's APP language (profiles.language),
// which itself defaults to the device language until the user picks one —
// so a phone set to English gets English replies with no extra plumbing.
// Appended AFTER the admin-curated prompt so it wins over any stale
// "trả lời bằng tiếng Việt" wording left in that prompt. Owner rule
// 2026-09-05: language is a wording decision (UI + AI), the market /
// country decides prices and content — never the other way round.
const LANGUAGE_RULE: Record<Lang, string> = {
  vi: "QUY TẮC NGÔN NGỮ (ưu tiên hơn mọi hướng dẫn về ngôn ngữ ở trên): người dùng đang dùng ứng dụng bằng tiếng Việt — luôn trả lời bằng tiếng Việt. Nếu người dùng viết bằng ngôn ngữ khác, trả lời bằng đúng ngôn ngữ họ viết.",
  en: "LANGUAGE RULE (overrides any language instruction above): the user runs the app in English — always reply in English. If the user writes in another language, reply in the language they wrote in.",
  ms: "PERATURAN BAHASA (mengatasi sebarang arahan bahasa di atas): pengguna menggunakan aplikasi dalam Bahasa Melayu — sentiasa balas dalam Bahasa Melayu. Jika pengguna menulis dalam bahasa lain, balas dalam bahasa yang mereka gunakan.",
};

const FALLBACK_MESSAGE: Record<Lang, string> = {
  vi: 'Xin lỗi, trợ lý AI đang gặp sự cố kết nối. Bạn có thể thử lại sau ít phút, hoặc nhấn "Chat với Chuyên gia TheraHOME" để được hỗ trợ trực tiếp.',
  en: 'Sorry, the AI assistant is having connection trouble. Please try again in a few minutes, or tap "Chat with a TheraHOME specialist" for direct support.',
  ms: 'Maaf, pembantu AI menghadapi masalah sambungan. Sila cuba lagi dalam beberapa minit, atau tekan "Sembang dengan Pakar TheraHOME" untuk sokongan terus.',
};

interface HistoryRow {
  sender_type: string;
  body: string;
}

function asLang(value: unknown): Lang {
  return value === "en" || value === "ms" ? value : "vi";
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405 });
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return new Response(JSON.stringify({ error: "Missing Authorization header" }), { status: 401 });
  }

  let threadId: string | undefined;
  try {
    const body = await req.json();
    threadId = body?.thread_id;
  } catch {
    // fall through to the missing-thread_id response below
  }
  if (!threadId) {
    return new Response(JSON.stringify({ error: "thread_id is required" }), { status: 400 });
  }

  // Bound to the caller's own JWT so this respects RLS — only lets the
  // function read a thread/messages the requesting user actually owns.
  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: thread, error: threadError } = await userClient
    .from("chat_threads")
    .select("id, kind, user_id")
    .eq("id", threadId)
    .maybeSingle();

  if (threadError) {
    return new Response(JSON.stringify({ error: threadError.message }), { status: 500 });
  }
  if (!thread) {
    return new Response(JSON.stringify({ error: "Thread not found" }), { status: 404 });
  }
  if (thread.kind !== "ai") {
    return new Response(JSON.stringify({ error: "Not an AI thread" }), { status: 400 });
  }

  // Order DESCENDING first so `limit(20)` keeps the 20 MOST RECENT messages
  // (not the 20 oldest) — then reverse back to chronological order below.
  const { data: recentHistory, error: historyError } = await userClient
    .from("chat_messages")
    .select("sender_type, body")
    .eq("thread_id", threadId)
    .order("created_at", { ascending: false })
    .limit(20);

  if (historyError) {
    return new Response(JSON.stringify({ error: historyError.message }), { status: 500 });
  }

  const history = (recentHistory ?? []).slice().reverse();

  // Service-role client: reads the admin-curated system prompt (RLS on
  // ai_prompts only lets admin/cskh web roles read it directly), the
  // thread owner's language, and inserts the AI's own reply (RLS only lets
  // `sender_type='user'` rows through for the `authenticated` role).
  const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  const [systemPrompt, lang] = await Promise.all([getSystemPrompt(adminClient), getUserLanguage(adminClient, thread.user_id)]);
  const replyText = await getGroqReply(`${systemPrompt.trim()}\n\n${LANGUAGE_RULE[lang]}`, history as HistoryRow[], lang);

  const { error: insertError } = await adminClient
    .from("chat_messages")
    .insert({ thread_id: threadId, sender_type: "ai", body: replyText });

  if (insertError) {
    return new Response(JSON.stringify({ error: insertError.message }), { status: 500 });
  }

  return new Response(JSON.stringify({ ok: true, lang }), {
    headers: { "Content-Type": "application/json" },
  });
});

// deno-lint-ignore no-explicit-any
async function getSystemPrompt(adminClient: any): Promise<string> {
  const { data } = await adminClient.from("ai_prompts").select("system_prompt").eq("id", true).maybeSingle();
  return data?.system_prompt ?? DEFAULT_SYSTEM_PROMPT;
}

// deno-lint-ignore no-explicit-any
async function getUserLanguage(adminClient: any, userId: string): Promise<Lang> {
  const { data } = await adminClient.from("profiles").select("language").eq("id", userId).maybeSingle();
  return asLang(data?.language);
}

async function getGroqReply(systemPrompt: string, history: HistoryRow[], lang: Lang): Promise<string> {
  if (!GROQ_API_KEY) {
    console.error("GROQ_API_KEY is not set");
    return FALLBACK_MESSAGE[lang];
  }

  const historyMessages = history
    .filter((m) => m.sender_type === "user" || m.sender_type === "ai")
    .map((m) => ({ role: m.sender_type === "user" ? "user" : "assistant", content: m.body }));

  if (historyMessages.length === 0 || historyMessages[historyMessages.length - 1].role !== "user") {
    console.error("No usable history for Groq call", JSON.stringify(historyMessages));
    return FALLBACK_MESSAGE[lang];
  }

  const messages = [{ role: "system", content: systemPrompt }, ...historyMessages];

  try {
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${GROQ_API_KEY}`,
      },
      body: JSON.stringify({ model: GROQ_MODEL, max_tokens: 1024, messages }),
    });

    const rawText = await res.text();

    if (!res.ok) {
      console.error("Groq API error", res.status, rawText);
      return FALLBACK_MESSAGE[lang];
    }

    let data: unknown;
    try {
      data = JSON.parse(rawText);
    } catch {
      console.error("Groq API returned non-JSON body", rawText);
      return FALLBACK_MESSAGE[lang];
    }

    // deno-lint-ignore no-explicit-any
    const text = (data as any)?.choices?.[0]?.message?.content;
    if (typeof text !== "string" || !text.trim()) {
      console.error("Groq API returned no usable content", rawText);
      return FALLBACK_MESSAGE[lang];
    }
    return text.trim();
  } catch (err) {
    console.error("Groq API call failed", err);
    return FALLBACK_MESSAGE[lang];
  }
}
