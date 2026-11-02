import AsyncStorage from '@react-native-async-storage/async-storage';
import type { QueryClient } from '@tanstack/react-query';

/**
 * A disk copy of the few queries Home's first paint needs.
 *
 * Without it every cold launch walks the same chain before the screen can
 * draw anything real — session, products, programmes, phases, days — and the
 * owner sees placeholders where the day counter and tagline belong, however
 * early the warm-up starts them (2026-10-24, third report). With it, the
 * second launch onward paints from what it knew last time and revalidates
 * underneath.
 *
 * Deliberately a short whitelist rather than the whole cache. These are the
 * slow-moving, user-owned rows the hero is built from; a catalogue of posts,
 * a notification list or anything counted per-day is cheaper to refetch than
 * to reason about when it is stale.
 */
// v2: v1 wrote Maps through plain `JSON.stringify`, which turns them into
// `{}`. Hydrating that put an object with no `.has()` where the phase-lock
// and purchase code expects a Map, and Home died on render with "undefined is
// not a function" (2026-10-24). Anything written by v1 must never be read.
const CACHE_KEY = 'therahome-query-cache-v2';
/** Older than this and it is not worth showing even for a moment. */
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
/** A ceiling on what goes to disk, so a large programme can never turn a
 * launch into a long AsyncStorage read. */
const MAX_BYTES = 512 * 1024;
const WRITE_DEBOUNCE_MS = 1500;

const PERSISTED_KEYS = new Set([
  'products',
  'primary_products',
  'user_programs',
  'default_product_for_contact',
  'program_phases',
  'user_program_days',
  'phase_promos_lock',
  'phase_purchases',
]);

/**
 * `JSON` cannot carry a Map or a Set, and two of the queries below are Maps —
 * `phase_promos_lock` and `phase_purchases`, whose callers do `.has(phaseId)`.
 * Silently flattening them to `{}` is how v1 crashed the screen it was
 * supposed to speed up, so they are tagged on the way out and rebuilt on the
 * way in.
 *
 * Dates are not handled, deliberately: nothing persisted here holds one — the
 * programme rows carry `activatedAt` as the ISO string Supabase returned —
 * and a reviver that guessed at date-shaped strings would do more harm than
 * good.
 */
function replacer(_key: string, value: unknown): unknown {
  if (value instanceof Map) return { __map: Array.from(value.entries()) };
  if (value instanceof Set) return { __set: Array.from(value) };
  return value;
}

function reviver(_key: string, value: unknown): unknown {
  if (value && typeof value === 'object') {
    const tagged = value as { __map?: [unknown, unknown][]; __set?: unknown[] };
    if (Array.isArray(tagged.__map)) return new Map(tagged.__map);
    if (Array.isArray(tagged.__set)) return new Set(tagged.__set);
  }
  return value;
}

interface Entry {
  key: readonly unknown[];
  data: unknown;
  at: number;
}

function persisted(key: readonly unknown[]): boolean {
  return typeof key[0] === 'string' && PERSISTED_KEYS.has(key[0]);
}

/** Read the disk copy into the cache. Call once, before the first render that
 * can reach Home — the splash is already up at that point. */
export async function hydrateQueryCache(client: QueryClient): Promise<void> {
  try {
    // Nothing should ever read v1 again; drop it rather than leave a broken
    // copy on every device that ran the build which wrote it.
    void AsyncStorage.removeItem('therahome-query-cache-v1').catch(() => undefined);
    const raw = await AsyncStorage.getItem(CACHE_KEY);
    if (!raw) return;
    const entries = JSON.parse(raw, reviver) as Entry[];
    const now = Date.now();
    for (const entry of entries) {
      if (!Array.isArray(entry?.key) || !persisted(entry.key)) continue;
      if (now - entry.at > MAX_AGE_MS) continue;
      // The queries start fetching on the first render, before this read
      // finishes. It never wins that race in practice — a disk read is tens
      // of milliseconds against a round trip — but if it did, writing the
      // older copy over the newer one would be a bug nobody would ever
      // reproduce.
      const existing = client.getQueryState(entry.key);
      if (existing?.dataUpdatedAt && existing.dataUpdatedAt >= entry.at) continue;
      // `setQueryData` counts as an update, so `isFetched` is true for these
      // and anything gating on "has this query answered yet" is satisfied —
      // which is the whole point. They still refetch on mount per their own
      // staleTime.
      client.setQueryData(entry.key, entry.data, { updatedAt: entry.at });
    }
  } catch {
    // A corrupt or unreadable cache is not worth failing a launch over.
  }
}

/** Mirror further successful fetches back to disk. Returns an unsubscribe. */
export function startQueryPersistence(client: QueryClient): () => void {
  let timer: ReturnType<typeof setTimeout> | null = null;

  const write = () => {
    timer = null;
    try {
      const entries: Entry[] = [];
      for (const query of client.getQueryCache().getAll()) {
        if (query.state.status !== 'success' || query.state.data === undefined) continue;
        if (!persisted(query.queryKey)) continue;
        entries.push({
          key: query.queryKey,
          data: query.state.data,
          at: query.state.dataUpdatedAt,
        });
      }
      const payload = JSON.stringify(entries, replacer);
      if (payload.length > MAX_BYTES) return;
      void AsyncStorage.setItem(CACHE_KEY, payload).catch(() => undefined);
    } catch {
      // Same: never let the mirror break the app it is mirroring.
    }
  };

  const unsubscribe = client.getQueryCache().subscribe(() => {
    if (timer) return;
    timer = setTimeout(write, WRITE_DEBOUNCE_MS);
  });

  return () => {
    if (timer) clearTimeout(timer);
    unsubscribe();
  };
}
