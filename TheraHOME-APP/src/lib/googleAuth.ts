// Google sign-in, native.
//
// This used to be Supabase's WEB OAuth flow: the app opened an in-app browser
// at `<project-ref>.supabase.co/auth/v1/authorize?provider=google`, which
// then bounced to Google. That works, and needed no native module, but it
// leaks the plumbing straight into the user's face — twice:
//
//   "TheraHOME Wants to Use supabase.co to Sign In"   (iOS asks this for
//                                                      every web auth session)
//   "Tiếp tục tới nyjvtvmllwbyfokldgtj.supabase.co"   (Google shows the
//                                                      redirect URI's host)
//
// Reported from the device 2026-10-11: "tôi tưởng nó đăng nhập bằng gg rồi
// thì thôi". Fair. Neither string can be changed while the flow goes through
// a browser — the first is iOS's own wording, and the second only becomes a
// brand name if Supabase's auth domain is replaced with a custom one, which
// is a paid add-on and still leaves the browser hop.
//
// Native sign-in removes both: the OS account picker appears, Google returns
// an ID token in-process, and Supabase verifies it. No browser, no redirect,
// no third-party domain on screen. It is also what `appleAuth.ts` already
// does — this brings Google in line rather than inventing anything.
//
// The cost is a native module, so this does NOT run in Expo Go and needs a
// build. The OAuth client IDs live in `app.json` under
// `expo.extra.googleSignIn`. They are public identifiers, not secrets (the
// client SECRET stays in the Supabase dashboard, which is the only place that
// ever needs it), so committing them is correct and keeps the three IDs
// visible next to the bundle id they are tied to.
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as WebBrowser from 'expo-web-browser';
import { makeRedirectUri } from 'expo-auth-session';
import { getQueryParams } from 'expo-auth-session/build/QueryParams';
import { requireOptionalNativeModule } from 'expo-modules-core';
import { supabase } from '@/lib/supabase';

WebBrowser.maybeCompleteAuthSession();

// Same guard the audio and LiveKit modules use: a JS bundle served to a
// binary built before this package was added has no native module, and
// importing it at the top level would throw while the bundle is still
// evaluating — taking the whole app down at launch on the login screen.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const GOOGLE = requireOptionalNativeModule('RNGoogleSignin') ? require('@react-native-google-signin/google-signin') : null;

interface GoogleSignInConfig {
  /** The WEB client id. Required on both platforms: it is the audience Google
   * stamps into the ID token, and the value Supabase checks against the
   * provider configured in its dashboard. Getting this wrong is the usual
   * cause of "Unacceptable audience in id_token". */
  webClientId?: string;
  /** iOS-only, from the iOS OAuth client. Its reversed form is also the URL
   * scheme the config plugin writes into Info.plist. */
  iosClientId?: string;
}

const config: GoogleSignInConfig = (Constants.expoConfig?.extra?.googleSignIn as GoogleSignInConfig) ?? {};

let configured = false;

/** Throws a message worth showing rather than letting the SDK fail obscurely
 * when the Cloud Console side has not been done yet. */
function ensureConfigured() {
  if (!GOOGLE) {
    throw new Error('Bản cài đặt này chưa hỗ trợ đăng nhập Google. Vui lòng cập nhật ứng dụng.');
  }
  if (!config.webClientId) {
    throw new Error('Đăng nhập Google chưa được cấu hình (thiếu webClientId).');
  }
  if (configured) return;
  GOOGLE.GoogleSignin.configure({
    webClientId: config.webClientId,
    ...(Platform.OS === 'ios' && config.iosClientId ? { iosClientId: config.iosClientId } : {}),
    // Email and profile are the defaults and all Supabase needs; asking for
    // more would put extra lines on the consent sheet for nothing.
    scopes: ['email', 'profile'],
  });
  configured = true;
}

/**
 * The browser flow this file used to be, kept as a fallback.
 *
 * It is NOT dead code waiting to be deleted: the native path needs OAuth
 * clients that only exist once someone creates them in the Google Cloud
 * Console, and until then this is what makes the Google button work at all.
 * The moment `extra.googleSignIn.webClientId` is filled in and a build
 * carries the native module, `signInWithGoogle` stops coming here on its own.
 */
async function signInWithGoogleViaBrowser() {
  const redirectTo = makeRedirectUri({ scheme: 'therahome', path: 'auth/callback' });
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo, skipBrowserRedirect: true },
  });
  if (error) throw error;
  if (!data?.url) throw new Error('Supabase không trả về URL đăng nhập Google.');

  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
  if (result.type !== 'success' || !result.url) return null;

  const { params, errorCode } = getQueryParams(result.url);
  if (errorCode) throw new Error(errorCode);
  const { access_token, refresh_token } = params;
  if (!access_token || !refresh_token) return null;

  const { data: sessionData, error: sessionError } =
    await supabase.auth.setSession({ access_token, refresh_token });
  if (sessionError) throw sessionError;
  return sessionData.session;
}

export async function signInWithGoogle() {
  // Native when this build can do it, browser otherwise. Deciding here rather
  // than at the call site means the login screen never has to know which
  // flow it is getting.
  if (!isGoogleSignInAvailable()) return signInWithGoogleViaBrowser();
  ensureConfigured();

  // Android only: surfaces "Play Services is out of date" as a fixable
  // prompt instead of an opaque sign-in failure. A no-op on iOS.
  if (Platform.OS === 'android') {
    await GOOGLE.GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
  }

  // A stale cached account is the one thing that makes this flow pick an
  // identity the user did not choose. Signing out first costs nothing and
  // guarantees the picker appears.
  await GOOGLE.GoogleSignin.signOut().catch(() => undefined);

  const response = await GOOGLE.GoogleSignin.signIn();

  // v13+ returns a discriminated result; a cancelled picker is not an error.
  if (response?.type === 'cancelled') return null;
  const idToken: string | undefined = response?.data?.idToken ?? response?.idToken;
  if (!idToken) throw new Error('Google không trả về id token.');

  const { data, error } = await supabase.auth.signInWithIdToken({
    provider: 'google',
    token: idToken,
  });
  if (error) throw error;
  return data.session;
}

/** Clears the cached Google account alongside the Supabase session, so the
 * next sign-in shows the picker instead of silently reusing the last one. */
export async function signOutGoogle() {
  if (!GOOGLE) return;
  await GOOGLE.GoogleSignin.signOut().catch(() => undefined);
}

/** Whether this build can offer Google sign-in at all — used to hide the
 * button on a binary that predates the native module instead of letting
 * someone tap into an error. */
export function isGoogleSignInAvailable(): boolean {
  return !!GOOGLE && !!config.webClientId;
}
