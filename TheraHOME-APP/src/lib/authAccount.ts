import { supabase } from '@/lib/supabase';
import { errorMessage } from '@/lib/errorMessage';
import type { TranslationKey } from '@/lib/i18n';

/**
 * Email-and-password accounts: registration, sign-in, and password recovery.
 *
 * Two things shape this file.
 *
 * Sign-in accepts a username OR an email, but Supabase Auth only ever
 * authenticates by email. The lookup happens in the `auth-sign-in` Edge
 * Function rather than here, so the app never learns which email belongs to
 * which username — an endpoint that answered that would be a list of every
 * customer's address to anyone who asked.
 *
 * Confirmation and recovery both use a six-digit code rather than a link
 * (owner, 2026-09-08). Supabase sends whichever the email template asks for:
 * a template containing `{{ .Token }}` produces the code, and `verifyOtp`
 * consumes it. That keeps the whole flow inside the app — no deep link to
 * register, no browser hand-off, and it works identically on both platforms.
 */

export type AuthErrorCode =
  | 'invalid_credentials'
  | 'email_not_confirmed'
  | 'username_taken'
  | 'username_invalid'
  | 'email_taken'
  | 'weak_password'
  | 'invalid_email'
  | 'otp_invalid'
  | 'rate_limited'
  | 'unknown';

export class AuthError extends Error {
  code: AuthErrorCode;
  /** Set when the caller has to continue with a code we just emailed. */
  email?: string;
  constructor(code: AuthErrorCode, email?: string) {
    super(code);
    this.name = 'AuthError';
    this.code = code;
    this.email = email;
  }
}

/** Supabase reports the same condition through several shapes depending on
 * which endpoint answered, so match on the message rather than one field. */
function classify(raw: unknown): AuthErrorCode {
  const message = errorMessage(raw).toLowerCase();
  if (message.includes('username_taken')) return 'username_taken';
  if (message.includes('username_invalid')) return 'username_invalid';
  if (message.includes('already registered') || message.includes('user_already_exists') || message.includes('already been registered')) return 'email_taken';
  if (message.includes('weak') || message.includes('at least 6 characters') || message.includes('password should be')) return 'weak_password';
  if (message.includes('invalid email') || message.includes('unable to validate email')) return 'invalid_email';
  if (message.includes('email not confirmed') || message.includes('email_not_confirmed')) return 'email_not_confirmed';
  if (message.includes('token has expired') || message.includes('invalid') && message.includes('otp')) return 'otp_invalid';
  if (message.includes('rate limit') || message.includes('too many')) return 'rate_limited';
  if (message.includes('invalid login credentials')) return 'invalid_credentials';
  return 'unknown';
}

/** Mirrors `username_is_wellformed` in the database. Duplicated on purpose:
 * checking here means the person is told what is wrong with the name they
 * typed, where the database's own rejection arrives as an untranslatable
 * "Database error saving new user". The database keeps its copy as the
 * authority — this one only decides which message to show. */
const USERNAME_SHAPE = /^[A-Za-z0-9][A-Za-z0-9._-]{2,29}$/;

export function isUsernameWellFormed(username: string): boolean {
  return USERNAME_SHAPE.test(username.trim());
}

/** Minimum password length, enforced in the app on both the sign-up and the
 * password-change paths. Supabase's own server-side minimum (Auth settings)
 * is a dashboard toggle this code cannot reach; enforcing it here is what
 * actually stops a short password being chosen through the app, and every
 * password in the app is set through one of the two functions below. */
const PASSWORD_MIN_LENGTH = 8;

export function isPasswordStrongEnough(password: string): boolean {
  return password.length >= PASSWORD_MIN_LENGTH;
}

/**
 * Creates the account and, when email confirmation is on, asks Supabase to
 * email a code. The username rides along in user metadata; `handle_new_user`
 * copies it onto the profile. It is a customer display name and may repeat,
 * so nothing here rejects a duplicate.
 */
export async function signUpAccount({
  username,
  email,
  password,
}: {
  username: string;
  email: string;
  password: string;
}): Promise<{ email: string; needsConfirmation: boolean }> {
  const trimmedEmail = email.trim();
  const trimmedUsername = username.trim();

  // A customer's username is a repeatable display name (owner, 2026-09-08),
  // so only its shape is checked, not whether it is free. Staff-name
  // uniqueness lives in a partial index, not on this path.
  if (!isUsernameWellFormed(trimmedUsername)) throw new AuthError('username_invalid');
  if (!isPasswordStrongEnough(password)) throw new AuthError('weak_password');

  const { data, error } = await supabase.auth.signUp({
    email: trimmedEmail,
    password,
    options: { data: { username: trimmedUsername } },
  });
  if (error) throw new AuthError(classify(error));

  // Whether a code has to be entered follows the project's "Confirm email"
  // setting, read straight off the result rather than hard-coded: with
  // confirmation OFF, signUp returns a live session and the user is already
  // in; with it ON, session is null and a code was emailed. The screen
  // branches on this, so flipping the dashboard toggle needs no app change.
  return { email: trimmedEmail, needsConfirmation: !data.session };
}

/** Signs in with either a username or an email. Resolves to `needsOtp` when
 * the account exists but has never confirmed its address. */
export async function signInWithIdentifier({
  identifier,
  password,
}: {
  identifier: string;
  password: string;
}): Promise<{ needsOtp?: true; email?: string }> {
  const { data, error } = await supabase.functions.invoke('auth-sign-in', {
    body: { identifier: identifier.trim(), password },
  });

  if (error) {
    // functions.invoke reports any non-2xx as an error and keeps the body on
    // the Response, which is where our own error code lives.
    const context = (error as { context?: Response }).context;
    let payload: { error?: string; email?: string } | null = null;
    try {
      payload = context ? await context.json() : null;
    } catch {
      payload = null;
    }
    if (payload?.error === 'email_not_confirmed') throw new AuthError('email_not_confirmed', payload.email);
    if (payload?.error === 'invalid_credentials') throw new AuthError('invalid_credentials');
    throw new AuthError('unknown');
  }

  const session = data as { access_token?: string; refresh_token?: string };
  if (!session?.access_token || !session?.refresh_token) throw new AuthError('unknown');

  const { error: sessionError } = await supabase.auth.setSession({
    access_token: session.access_token,
    refresh_token: session.refresh_token,
  });
  if (sessionError) throw new AuthError(classify(sessionError));
  return {};
}

/** Re-sends the sign-up confirmation code. */
export async function resendSignUpCode(email: string): Promise<void> {
  const { error } = await supabase.auth.resend({ type: 'signup', email: email.trim() });
  if (error) throw new AuthError(classify(error));
}

/**
 * Starts password recovery. Always resolves, even for an address that has no
 * account: telling the difference would turn this screen into a way to check
 * who is registered.
 */
export async function requestPasswordReset(email: string): Promise<void> {
  const { error } = await supabase.auth.resetPasswordForEmail(email.trim());
  if (error && classify(error) === 'rate_limited') throw new AuthError('rate_limited');
}

/** Confirms a new account. On success the user is signed in. */
export async function verifySignUpCode(email: string, token: string): Promise<void> {
  const { error } = await supabase.auth.verifyOtp({ email: email.trim(), token: token.trim(), type: 'signup' });
  if (error) throw new AuthError(classify(error) === 'unknown' ? 'otp_invalid' : classify(error));
}

/**
 * Confirms a recovery code. This establishes a session, which is what makes
 * the password change below possible — so the new-password screen must follow
 * immediately, and nothing else may run in between.
 */
export async function verifyRecoveryCode(email: string, token: string): Promise<void> {
  const { error } = await supabase.auth.verifyOtp({ email: email.trim(), token: token.trim(), type: 'recovery' });
  if (error) throw new AuthError(classify(error) === 'unknown' ? 'otp_invalid' : classify(error));
}

export async function updatePassword(password: string): Promise<void> {
  if (!isPasswordStrongEnough(password)) throw new AuthError('weak_password');
  const { error } = await supabase.auth.updateUser({ password });
  if (error) throw new AuthError(classify(error));
}

/** One place that decides what the user reads for each failure, so the four
 * screens in this flow cannot drift into describing the same problem three
 * different ways. */
export function authErrorKey(code: AuthErrorCode): TranslationKey {
  switch (code) {
    case 'invalid_credentials': return 'invalidCredentials';
    case 'email_not_confirmed': return 'errOtpInvalid';
    case 'username_taken': return 'errUsernameTaken';
    case 'username_invalid': return 'errUsernameInvalid';
    case 'email_taken': return 'errEmailTaken';
    case 'weak_password': return 'errWeakPassword';
    case 'invalid_email': return 'errInvalidEmail';
    case 'otp_invalid': return 'errOtpInvalid';
    case 'rate_limited': return 'errRateLimited';
    default: return 'connectionError';
  }
}
