/**
 * Reads the message off anything thrown, including a PostgREST error.
 *
 * Ported verbatim from TheraHOME-APP/src/lib/errorMessage.ts, where this exact
 * trap was already found and fixed. The web never got the fix, and the same
 * bug surfaced here on 2026-09-19: adding a phone number that was already on
 * a product's activation list showed "Không thể thêm. Vui lòng thử lại." —
 * a retry that could never succeed — instead of the "already listed" message
 * the code had written for precisely that case.
 *
 * `e instanceof Error` looks like the safe way to do this and silently is
 * not: postgrest-js only builds a real `PostgrestError` when a query opts
 * into `throwOnError`. Everywhere else — every `const { error } = await
 * supabase.from(...)` / `.rpc(...)` — `error` is the parsed response body, a
 * plain `{ code, details, hint, message }` object. `instanceof Error` is
 * false for it (verified against supabase-js 2.112.3: constructor `Object`),
 * so an `e instanceof Error ? e.message : ''` guard threw the message away
 * and every screen fell through to its generic failure. `String(e)` is no
 * better: a plain object stringifies to "[object Object]".
 *
 * Auth (`AuthError`) and Edge Function (`FunctionsError`) errors are real
 * `Error` subclasses, so those paths were always fine and stay fine here.
 */
export function errorMessage(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (typeof e === "string") return e;
  if (typeof e === "object" && e !== null) {
    const message = (e as { message?: unknown }).message;
    if (typeof message === "string") return message;
  }
  return "";
}

/** The Postgres SQLSTATE off a PostgREST error, when there is one. `23505` is
 * unique_violation — more reliable than matching words in the message, which
 * change with the server's locale and version. */
export function errorCode(e: unknown): string {
  if (typeof e === "object" && e !== null) {
    const code = (e as { code?: unknown }).code;
    if (typeof code === "string") return code;
  }
  return "";
}
