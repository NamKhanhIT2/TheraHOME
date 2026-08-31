// Google sign-in via Supabase's OAuth flow, opened in an in-app browser
// session (works in Expo Go — no native Google Sign-In SDK / EAS dev client
// required). Standard Supabase+Expo pattern.
//
// Requires manual setup before this will actually work (see CLAUDE.md):
// 1. A Google Cloud OAuth client (Web application type).
// 2. The Google provider enabled in the Supabase dashboard
//    (Authentication -> Providers -> Google) with that client's ID/secret.
// 3. Supabase's callback URL (shown on that same dashboard page) added as an
//    authorized redirect URI on the Google Cloud OAuth client.
// Until all three are done, `signInWithGoogle()` rejects with a clear error
// rather than crashing.
import * as WebBrowser from 'expo-web-browser';
import { makeRedirectUri } from 'expo-auth-session';
import { getQueryParams } from 'expo-auth-session/build/QueryParams';
import { supabase } from '@/lib/supabase';

WebBrowser.maybeCompleteAuthSession();

// Pin the native return route to the app scheme. Without an explicit scheme,
// a development session may create an `exp://` callback and iOS offers Expo
// Go after Google completes authentication instead of returning to TheraHOME.
const redirectTo = makeRedirectUri({
  scheme: 'therahome',
  path: 'auth/callback',
});

async function createSessionFromUrl(url: string) {
  const { params, errorCode } = getQueryParams(url);
  if (errorCode) throw new Error(errorCode);
  const { access_token, refresh_token } = params;
  if (!access_token || !refresh_token) return null;

  const { data, error } = await supabase.auth.setSession({ access_token, refresh_token });
  if (error) throw error;
  return data.session;
}

export async function signInWithGoogle() {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo, skipBrowserRedirect: true },
  });
  if (error) throw error;
  if (!data.url) throw new Error('Không lấy được đường dẫn đăng nhập Google.');

  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
  if (result.type === 'success' && result.url) {
    return createSessionFromUrl(result.url);
  }
  if (result.type === 'cancel' || result.type === 'dismiss') {
    return null;
  }
  throw new Error('Đăng nhập với Google không thành công. Vui lòng thử lại.');
}
