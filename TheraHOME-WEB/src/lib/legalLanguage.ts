import { headers } from "next/headers";
import type { LegalLanguage } from "@/lib/appLegalContent";

/**
 * Which language a public legal page should render in.
 *
 * These pages back the store listings in three markets, and Google Play
 * accepts only ONE privacy-policy URL for the whole app — so the same URL has
 * to answer sensibly to a reviewer in London, Kuala Lumpur or Hanoi. It reads,
 * in order:
 *
 *  1. `?lang=` — an explicit choice, and what the language switcher links to,
 *     so a chosen language survives being copied, bookmarked or handed to
 *     someone else.
 *  2. `Accept-Language` — so an English or Malay reader lands on their own
 *     language without touching anything.
 *  3. Vietnamese, which is the legally authoritative text.
 *
 * Only the three languages the app itself ships are offered; anything else
 * falls through to Vietnamese rather than guessing at a near match.
 */
export const LEGAL_LANGUAGES: { code: LegalLanguage; label: string }[] = [
  { code: "vi", label: "Tiếng Việt" },
  { code: "en", label: "English" },
  { code: "ms", label: "Bahasa Melayu" },
];

function isLegalLanguage(value: string | undefined): value is LegalLanguage {
  return value === "vi" || value === "en" || value === "ms";
}

/** Picks the best of our three languages out of an Accept-Language header,
 * honouring q-weights so `en;q=0.8, vi;q=0.9` resolves to Vietnamese. */
function fromAcceptLanguage(header: string | null): LegalLanguage | null {
  if (!header) return null;
  const ranked = header
    .split(",")
    .map((part) => {
      const [tag, ...params] = part.trim().split(";");
      const q = params
        .map((p) => p.trim())
        .find((p) => p.startsWith("q="))
        ?.slice(2);
      return { tag: tag.trim().toLowerCase(), q: q === undefined ? 1 : Number.parseFloat(q) };
    })
    .filter((entry) => entry.tag && Number.isFinite(entry.q) && entry.q > 0)
    .sort((a, b) => b.q - a.q);

  for (const { tag } of ranked) {
    // The primary subtag is enough: en-GB, en-US and en all mean English here.
    const primary = tag.split("-")[0];
    if (isLegalLanguage(primary)) return primary;
  }
  return null;
}

export async function resolveLegalLanguage(
  searchParams?: Promise<Record<string, string | string[] | undefined>>,
): Promise<LegalLanguage> {
  const params = await searchParams;
  const requested = params?.lang;
  const explicit = Array.isArray(requested) ? requested[0] : requested;
  if (isLegalLanguage(explicit)) return explicit;

  const headerList = await headers();
  return fromAcceptLanguage(headerList.get("accept-language")) ?? "vi";
}
