// Auto-draft translator for the WEB Admin/CSKH surfaces: takes a flat map of
// Vietnamese strings and returns machine-translated EN + MS drafts, so staff
// who author only the VN content still ship usable UK/ML variants (editable
// afterwards in the same VN/EN/MS tabs; if never edited, the draft ships
// as-is — per explicit request 2026-09-04).
//
// Auth: verify_jwt is ON (gateway requires a logged-in user), and the
// function additionally requires the caller to hold an admin/cskh role in
// web_access_contacts — end users can never burn the Groq quota.
//
// Uses the same Groq account as chat-ai-reply (GROQ_API_KEY secret). When
// the key is missing or Groq fails, this returns 503 and the WEB caller
// simply saves without drafts — authoring must never be blocked by the
// translator being down.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const GROQ_API_KEY = Deno.env.get("GROQ_API_KEY");
const GROQ_MODEL = Deno.env.get("GROQ_MODEL") || "llama-3.3-70b-versatile";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const LANG_NAMES: Record<string, string> = {
  en: "English",
  ms: "Malay (Bahasa Melayu)",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json({ error: "Missing Authorization header" }, 401);

  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData, error: userError } = await userClient.auth.getUser();
  if (userError || !userData?.user) return json({ error: "Invalid session" }, 401);

  // Staff gate: an enabled admin/cskh row claimed by this Google identity.
  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const { data: staffRow, error: staffError } = await admin
    .from("web_access_contacts")
    .select("id")
    .eq("claimed_by_user_id", userData.user.id)
    .eq("disabled", false)
    .overlaps("roles", ["admin", "cskh"])
    .limit(1)
    .maybeSingle();
  if (staffError) return json({ error: staffError.message }, 500);
  if (!staffRow) return json({ error: "Staff role required" }, 403);

  let texts: Record<string, string> = {};
  try {
    const body = await req.json();
    if (body && typeof body.texts === "object" && body.texts !== null) {
      for (const [key, value] of Object.entries(body.texts as Record<string, unknown>)) {
        if (typeof value === "string" && value.trim()) texts[key] = value.trim();
      }
    }
  } catch {
    // handled by the empty-texts check below
  }
  const keys = Object.keys(texts);
  if (keys.length === 0) return json({ error: "texts (non-empty object of strings) is required" }, 400);
  if (keys.length > 40) return json({ error: "Too many fields (max 40)" }, 400);
  const totalChars = Object.values(texts).reduce((sum, t) => sum + t.length, 0);
  if (totalChars > 8000) return json({ error: "Content too long (max 8000 chars)" }, 400);

  if (!GROQ_API_KEY) return json({ error: "Translator not configured (GROQ_API_KEY missing)" }, 503);

  const result: Record<string, Record<string, string>> = {};
  for (const lang of ["en", "ms"]) {
    const translated = await translate(texts, lang);
    if (!translated) return json({ error: `Translation to ${lang} failed` }, 503);
    result[lang] = translated;
  }
  return json({ translations: result });
});

async function translate(texts: Record<string, string>, lang: string): Promise<Record<string, string> | null> {
  const prompt = [
    `Translate the VALUES of this JSON object from Vietnamese to ${LANG_NAMES[lang]}.`,
    "Rules:",
    "- Return ONLY a JSON object with exactly the same keys; each value is the translation.",
    "- Keep product/brand names unchanged (TheraHOME, TheraNECK+, TheraNECK PRO, TheraBACK+, TheraBACK PRO).",
    "- Keep URLs, numbers, prices and line breaks (\\n) unchanged.",
    "- Keep placeholder tokens such as {{day}} or {{days}} EXACTLY as written, braces included; never translate or reword them.",
    "- Natural, concise wording suited to a health & wellness mobile app; no diagnosis/medical-claim language.",
    "",
    JSON.stringify(texts),
  ].join("\n");

  try {
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${GROQ_API_KEY}` },
      body: JSON.stringify({
        model: GROQ_MODEL,
        max_tokens: 4096,
        response_format: { type: "json_object" },
        messages: [{ role: "user", content: prompt }],
      }),
    });
    if (!res.ok) {
      console.error("Groq error", res.status, await res.text());
      return null;
    }
    const data = await res.json();
    const content = data?.choices?.[0]?.message?.content;
    if (typeof content !== "string") return null;
    const parsed = JSON.parse(content) as Record<string, unknown>;
    const out: Record<string, string> = {};
    for (const key of Object.keys(texts)) {
      const value = parsed[key];
      // A missing/garbled key falls back to the VN original rather than
      // failing the whole batch — staff can still edit that one field.
      out[key] = typeof value === "string" && value.trim() ? value.trim() : texts[key];
    }
    return out;
  } catch (err) {
    console.error("Groq call failed", err);
    return null;
  }
}

function json(value: unknown, status = 200) {
  return new Response(JSON.stringify(value), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
