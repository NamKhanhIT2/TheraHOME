// Native Sign in with Apple (expo-apple-authentication) -> Supabase Auth via
// signInWithIdToken. Unlike googleAuth.ts's browser-session flow, this needs
// a real bundle identifier + Apple Developer "Sign In with Apple" capability
// + Supabase's Apple provider configured (see CLAUDE.md's Manual setup
// section) and an EAS dev client to run at all -- expo-apple-authentication
// is a native module, not available in plain Expo Go.
//
// Apple only returns the user's name on the very first authorization for a
// given Apple ID + app, including for Hide My Email users (who get a
// private relay address as `email`, indistinguishable from a real one to
// this code -- and that's fine, it works as a normal forwarding email).
// Later sign-ins return null for both, so the one-time name is opportunistically
// copied into profiles.full_name only if that column is still empty --
// never overwritten on repeat sign-ins.
import * as AppleAuthentication from 'expo-apple-authentication';
import * as Crypto from 'expo-crypto';
import { supabase } from './supabase';

export async function signInWithApple() {
  // Apple signs the SHA-256 hash, while Supabase verifies the original raw
  // nonce against that token. Supplying both prevents token validation from
  // failing on native iOS builds.
  const nonce = Crypto.randomUUID();
  const hashedNonce = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, nonce);
  const credential = await AppleAuthentication.signInAsync({
    requestedScopes: [
      AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
      AppleAuthentication.AppleAuthenticationScope.EMAIL,
    ],
    nonce: hashedNonce,
  });

  if (!credential.identityToken) {
    throw new Error('Không nhận được thông tin xác thực từ Apple.');
  }

  const { data, error } = await supabase.auth.signInWithIdToken({
    provider: 'apple',
    token: credential.identityToken,
    nonce,
  });
  if (error) throw error;

  const name = [credential.fullName?.givenName, credential.fullName?.familyName]
    .filter(Boolean)
    .join(' ')
    .trim();
  if (name && data.user) {
    const { data: profile } = await supabase.from('profiles').select('full_name').eq('id', data.user.id).single();
    if (profile && !profile.full_name) {
      await supabase.from('profiles').update({ full_name: name }).eq('id', data.user.id);
    }
  }

  return data.session;
}
