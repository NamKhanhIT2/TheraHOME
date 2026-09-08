import React, { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import { router } from 'expo-router';
import * as AppleAuthentication from 'expo-apple-authentication';
import { AuthScreenShell, type AuthFormValues } from '@/components/onboarding/AuthScreenShell';
import { signInWithGoogle } from '@/lib/googleAuth';
import { signInWithApple } from '@/lib/appleAuth';
import { AuthError, authErrorKey, signInWithIdentifier } from '@/lib/authAccount';
import { useI18n } from '@/lib/i18n';

export default function LoginScreen() {
  const { t } = useI18n();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [appleAvailable, setAppleAvailable] = useState(false);
  useEffect(() => {
    if (Platform.OS !== 'ios') return;
    void AppleAuthentication.isAvailableAsync().then(setAppleAvailable).catch(() => setAppleAvailable(false));
  }, []);
  async function google() {
    setBusy(true); setError(null);
    try { await signInWithGoogle(); } catch { setError(t('googleSignInError')); } finally { setBusy(false); }
  }
  async function apple() {
    setBusy(true); setError(null);
    try { await signInWithApple(); } catch (reason) {
      if ((reason as { code?: string })?.code !== 'ERR_REQUEST_CANCELED') setError(t('appleSignInError'));
    } finally { setBusy(false); }
  }
  /** The first field takes a username or an email; which one it is gets
   * resolved server-side (see auth-sign-in). */
  async function password({ username, password: secret }: AuthFormValues) {
    if (busy) return;
    setBusy(true); setError(null);
    try {
      await signInWithIdentifier({ identifier: username, password: secret });
      // The session now exists; RootNavigator's guard swaps the stack.
    } catch (reason) {
      if (reason instanceof AuthError && reason.code === 'email_not_confirmed' && reason.email) {
        // Right password, unfinished sign-up: send them to the code they were
        // already emailed rather than making them start over.
        router.push({ pathname: '/verify-code', params: { email: reason.email, purpose: 'signup' } });
        return;
      }
      setError(t(reason instanceof AuthError ? authErrorKey(reason.code) : 'connectionError'));
    } finally {
      setBusy(false);
    }
  }
  return (
    <AuthScreenShell
      mode="signIn"
      busy={busy}
      error={error}
      showApple={appleAvailable}
      onApple={() => void apple()}
      onGoogle={() => void google()}
      onSubmit={(values) => void password(values)}
      onForgot={() => router.push('/forgot-password')}
    />
  );
}
