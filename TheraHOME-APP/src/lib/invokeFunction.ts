// Calling an Edge Function, with the failure visible and a stale login
// handled instead of ignored.
//
// WHY THIS FILE EXISTS. On 2026-10-19 every call from one phone failed for
// hours, and nothing in the app said why. The push that rings the
// specialist, the token that joins the LiveKit room — both were coming back
// 401, and both call sites did this:
//
//   if (error && __DEV__) console.warn('voip push failed:', error);
//
// `__DEV__` is false in a release build. So a call that never rang anybody
// looked exactly like a call that did, the customer saw "mất kết nối", and
// the only evidence of the real problem lived on a server nobody was
// watching.
//
// The cause was worth the trouble too: the device held a correctly signed,
// unexpired token whose SESSION had been deleted server-side. PostgREST
// checks only the signature and expiry, so the app went on loading days and
// charts normally while every Edge Function refused it — a zombie login
// that looked healthy from inside the app. Signing out and back in fixed
// it, which is a thing the app can do for itself.
//
// So every function call goes through here, and here it:
//   1. retries once after refreshing, when the server says 401/403,
//   2. signs out when the refresh says the session is genuinely gone,
//   3. logs the status and body with console.error — which survives a
//      release build, unlike the line above.
import { AuthApiError, FunctionsHttpError, isAuthRetryableFetchError } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

type InvokeResult<T> = { data: T | null; error: unknown };

/** 401/403 from the function gateway or the function itself. Anything else
 * — a 500, a bad request, no network — is not an auth problem and must not
 * cost the customer their session. */
async function authRejected(error: unknown): Promise<boolean> {
  if (!(error instanceof FunctionsHttpError)) return false;
  const status = (error.context as Response | undefined)?.status;
  return status === 401 || status === 403;
}

/** The body, for the log. Read from a clone so the caller can still use the
 * original response. */
async function describe(error: unknown): Promise<string> {
  if (!(error instanceof FunctionsHttpError)) return String(error);
  const response = error.context as Response | undefined;
  if (!response) return error.message;
  try {
    return `${response.status} ${(await response.clone().text()).slice(0, 300)}`;
  } catch {
    return String(response.status);
  }
}

/** True when the refresh failed because the session is gone, rather than
 * because the phone is on a train. Only the first kind is worth signing
 * somebody out over. */
function sessionIsGone(error: unknown): boolean {
  if (isAuthRetryableFetchError(error)) return false;
  return error instanceof AuthApiError;
}

export async function invokeFunction<T = unknown>(
  name: string,
  body?: Record<string, unknown>,
): Promise<InvokeResult<T>> {
  let result = await supabase.functions.invoke<T>(name, { body }) as InvokeResult<T>;
  if (!result.error) return result;

  if (await authRejected(result.error)) {
    const { error: refreshError } = await supabase.auth.refreshSession();
    if (!refreshError) {
      result = await supabase.functions.invoke<T>(name, { body }) as InvokeResult<T>;
      if (!result.error) return result;
    } else if (sessionIsGone(refreshError)) {
      // Nothing this login can do any more: every Edge Function will refuse
      // it, which means no calls, no form checks, no purchases. Ending it
      // sends them to the sign-in screen, which is the one action that
      // works — and the one a customer would never think to take, because
      // the rest of the app still looks fine.
      console.error(`[fn] ${name}: session gone, signing out —`, refreshError.message);
      await supabase.auth.signOut();
      return result;
    }
  }

  // console.error, not console.warn behind __DEV__: this has to be readable
  // from `adb logcat` on a release build, which is where it was needed.
  console.error(`[fn] ${name} failed:`, await describe(result.error));
  return result;
}
