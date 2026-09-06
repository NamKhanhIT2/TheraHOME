// Chunked key/value storage for the Supabase session on top of a store with
// a per-entry size limit (expo-secure-store: 2048 bytes). Kept free of any
// React Native import so the layout rules can be exercised in plain Node.
//
// Layout ("v2", 2026-09-06): the entry at `key` is authoritative. It holds
// either the value itself (when it fits) or a header `__chunked__:<n>` that
// is written LAST, after the n parts `${key}_c<i>`. A reader therefore never
// sees a header whose parts are still being written, and a write always
// supersedes whatever was there before by *setting* `key` — it never relies
// on a delete succeeding.
//
// The previous layout kept a separate manifest (`${key}_chunks`) whose mere
// presence overrode `key`. When a login stored a small session in `key` but
// the stale manifest of the previous, larger (Google) session survived, the
// app resumed the OLD session on its next cold start — observed 2026-09-06
// as "Refresh Token Not Found" ×3 followed by a surprise logout on iOS. The
// old layout is still read so existing installs keep their session across
// the update; the first write migrates them.
//
// Every operation is serialised through one queue: supabase-js reads storage
// on each getSession() and can interleave that with a save.

export interface KeyValueStore {
  getItemAsync(key: string): Promise<string | null>;
  setItemAsync(key: string, value: string): Promise<void>;
  deleteItemAsync(key: string): Promise<void>;
}

export interface ChunkedStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

export const CHUNK_SIZE = 1800;
const HEADER = '__chunked__:';
const MAX_CHUNKS = 100;

function validCount(raw: string | null | undefined): number | null {
  if (raw === null || raw === undefined || raw === '') return null;
  const count = Number(raw);
  return Number.isInteger(count) && count > 0 && count <= MAX_CHUNKS ? count : null;
}

function headerCount(value: string | null): number | null {
  if (!value || !value.startsWith(HEADER)) return null;
  return validCount(value.slice(HEADER.length));
}

export function createChunkedStorage(store: KeyValueStore): ChunkedStorage {
  let queue: Promise<unknown> = Promise.resolve();
  function serial<T>(op: () => Promise<T>): Promise<T> {
    const run = queue.then(op, op);
    queue = run.catch(() => undefined);
    return run;
  }

  async function readParts(prefix: string, count: number): Promise<string | null> {
    const parts = await Promise.all(
      Array.from({ length: count }, (_, i) => store.getItemAsync(`${prefix}${i}`)),
    );
    return parts.every((p) => p !== null) ? parts.join('') : null;
  }

  async function deleteQuietly(keys: string[]) {
    await Promise.all(keys.map((k) => store.deleteItemAsync(k).catch(() => undefined)));
  }

  async function readLegacy(key: string): Promise<string | null> {
    const count = validCount(await store.getItemAsync(`${key}_chunks`));
    return count === null ? null : readParts(`${key}_`, count);
  }

  async function deleteLegacy(key: string) {
    const count = validCount(await store.getItemAsync(`${key}_chunks`).catch(() => null));
    const parts = Array.from({ length: count ?? 0 }, (_, i) => `${key}_${i}`);
    await deleteQuietly([`${key}_chunks`, ...parts]);
  }

  return {
    getItem(key) {
      return serial(async () => {
        const value = await store.getItemAsync(key);
        if (value === null) return readLegacy(key);
        const count = headerCount(value);
        if (count === null) return value;
        // A header whose parts are missing means an interrupted write:
        // report "no session", but never delete anything from a read path.
        return readParts(`${key}_c`, count);
      });
    },
    setItem(key, value) {
      return serial(async () => {
        if (value.length <= CHUNK_SIZE) {
          await store.setItemAsync(key, value);
        } else {
          const chunks: string[] = [];
          for (let i = 0; i < value.length; i += CHUNK_SIZE) chunks.push(value.slice(i, i + CHUNK_SIZE));
          if (chunks.length > MAX_CHUNKS) throw new Error('secure session storage: value too large');
          await Promise.all(chunks.map((c, i) => store.setItemAsync(`${key}_c${i}`, c)));
          await store.setItemAsync(key, `${HEADER}${chunks.length}`);
        }
        // Best effort: the authoritative entry is already in place.
        await deleteLegacy(key);
      });
    },
    removeItem(key) {
      return serial(async () => {
        const count = headerCount(await store.getItemAsync(key).catch(() => null));
        // The authoritative entry goes first, and its failure is not
        // swallowed: supabase-js must know a sign-out did not stick.
        await store.deleteItemAsync(key);
        await deleteQuietly(Array.from({ length: count ?? 0 }, (_, i) => `${key}_c${i}`));
        await deleteLegacy(key);
      });
    },
  };
}
