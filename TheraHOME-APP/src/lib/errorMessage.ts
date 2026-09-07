/**
 * Reads the message off anything thrown, including a PostgREST error.
 *
 * `e instanceof Error` looks like the safe way to do this and silently is
 * not: postgrest-js only builds a real `PostgrestError` when a query opts
 * into `throwOnError`. Everywhere else — every `const { error } = await
 * supabase.rpc(...)` in this app — `error` is the parsed response body, a
 * plain `{ code, details, hint, message }` object. `instanceof Error` is
 * false for it, so an `e instanceof Error ? e.message : ''` guard threw the
 * message away and every screen fell through to its generic "something went
 * wrong", never showing the specific one it had translated into three
 * languages. `String(e)` is no better: a plain object stringifies to
 * "[object Object]".
 *
 * Auth (`AuthError`) and Edge Function (`FunctionsError`) errors are real
 * `Error` subclasses, so those paths were always fine and stay fine here.
 */
export function errorMessage(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (typeof e === 'string') return e;
  if (typeof e === 'object' && e !== null) {
    const message = (e as { message?: unknown }).message;
    if (typeof message === 'string') return message;
  }
  return '';
}
