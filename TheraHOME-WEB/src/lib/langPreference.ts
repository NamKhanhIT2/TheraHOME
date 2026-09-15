// The nav's language choice, as a tiny external store.
//
// A useState + useEffect pair would be the obvious shape, but reading
// localStorage and calling setState synchronously in an effect is exactly the
// cascading-render pattern react-hooks/set-state-in-effect rejects.
// useSyncExternalStore is the supported way to read browser-only state: the
// server snapshot is the default, the client snapshot is the stored value, and
// React reconciles the two without a second render pass of our making.
//
// Ported from lang.js in the design project. Copy is Vietnamese-only for now,
// so choosing English deliberately shows a notice instead of half-switching.

export type Lang = "vi" | "en";

const KEY = "therahome-lang";
export const LANG_LABEL: Record<Lang, string> = { vi: "Tiếng Việt", en: "English" };

const listeners = new Set<() => void>();
let cached: Lang = "vi";

function read(): Lang {
  try {
    return localStorage.getItem(KEY) === "en" ? "en" : "vi";
  } catch {
    // Private mode or blocked storage — the default is correct anyway.
    return "vi";
  }
}

export function subscribeLang(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Must return a stable reference for equal state, or React re-renders forever. */
export function getLangSnapshot(): Lang {
  const next = read();
  if (next !== cached) cached = next;
  return cached;
}

/** The server has no localStorage; Vietnamese is the shipped default. */
export function getLangServerSnapshot(): Lang {
  return "vi";
}

export function setLang(next: Lang): void {
  try {
    localStorage.setItem(KEY, next);
  } catch {
    // Not persisting is survivable — the picker still reflects the choice for
    // this page view because we notify listeners regardless.
  }
  cached = next;
  listeners.forEach((l) => l());
}
