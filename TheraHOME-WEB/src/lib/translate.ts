// Auto-draft translation for admin-authored VN content (per explicit
// request 2026-09-04): when staff saves Vietnamese content whose EN/MS
// variants are empty, the caller sends just those VN strings here and gets
// machine-translated drafts back to store alongside the VN base. Staff can
// edit the drafts later in the same VN/EN/MS tabs; untouched drafts simply
// ship as-is (they live in the same columns the app already reads).
//
// Backed by the `translate-content` Edge Function (Groq, staff-gated).
// Failures resolve to null — saving must never block on the translator.
import { supabase } from "@/lib/supabase";

export interface TranslationDrafts {
  en: Record<string, string>;
  ms: Record<string, string>;
}

/** Translate a flat map of VN strings to EN + MS. Returns null (and logs)
 * on any failure so callers can save without drafts. Keys with empty
 * values are ignored; an empty input resolves to null immediately. */
export async function translateDrafts(texts: Record<string, string>): Promise<TranslationDrafts | null> {
  const payload: Record<string, string> = {};
  for (const [key, value] of Object.entries(texts)) {
    if (value && value.trim()) payload[key] = value;
  }
  if (Object.keys(payload).length === 0) return null;
  try {
    const { data, error } = await supabase.functions.invoke("translate-content", {
      body: { texts: payload },
    });
    if (error) throw error;
    const translations = (data as { translations?: TranslationDrafts } | null)?.translations;
    if (!translations?.en || !translations?.ms) return null;
    return translations;
  } catch (err) {
    console.warn("Auto-translate failed (saving without drafts):", err);
    return null;
  }
}
