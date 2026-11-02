import React, { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import { router } from 'expo-router';
import * as AppleAuthentication from 'expo-apple-authentication';
import { AuthScreenShell, type AuthFormValues } from '@/components/onboarding/AuthScreenShell';
import { signInWithGoogle } from '@/lib/googleAuth';
import { signInWithApple } from '@/lib/appleAuth';
import { AuthError, authErrorKey, signUpAccount } from '@/lib/authAccount';
import { useI18n } from '@/lib/i18n';
import { useAppStore } from '@/store/useAppStore';

/**
 * The sign-up form itself, separate from its route.
 *
 * `login` renders this directly on a device that has never held a session,
 * instead of redirecting to `/create-account` (owner, 2026-10-28: the
 * redirect showed the empty login route's background first, then slid the
 * real screen in — "thấy màn nền lặp lại rồi mới thấy màn tạo tài khoản").
 * One mount, no navigation, nothing to see on the way past.
 */
export function CreateAccountForm() {
  const { t } = useI18n();
  const resetOnboardingAnswers = useAppStore((s) => s.resetOnboardingAnswers);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [appleAvailable, setAppleAvailable] = useState(false);

  useEffect(() => {
    if (Platform.OS !== 'ios') return;
    void AppleAuthentication.isAvailableAsync().then(setAppleAvailable).catch(() => setAppleAvailable(false));
  }, []);

  // Apple and Google were drawn on this screen but wired to nothing — both
  // were dead buttons (owner, 2026-10-28). Signing in with either creates
  // the account when it is new, so this is the call the login screen makes.
  async function google() {
    setBusy(true);
    setError(null);
    try {
      resetOnboardingAnswers();
      await signInWithGoogle();
    } catch (reason) {
      if (__DEV__) console.warn('Google sign-up failed:', reason);
      setError(t('googleSignInError'));
    } finally {
      setBusy(false);
    }
  }

  async function apple() {
    setBusy(true);
    setError(null);
    try {
      resetOnboardingAnswers();
      await signInWithApple();
    } catch (reason) {
      if ((reason as { code?: string })?.code !== 'ERR_REQUEST_CANCELED') setError(t('appleSignInError'));
    } finally {
      setBusy(false);
    }
  }

  async function register({ email, password }: AuthFormValues) {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const { email: address, needsConfirmation } = await signUpAccount({ email, password });
      // A brand-new account starts the questionnaire at the beginning. The
      // answers persist in the store to survive an app kill mid-onboarding, so
      // without this a new sign-up would resume the PREVIOUS person's answers
      // (owner report 2026-09-09: new account landed on question 6/8). Reset
      // here, at the sign-up moment, rather than on every questions mount — so
      // the same user reopening after a kill still resumes where they left off.
      resetOnboardingAnswers();
      // With "Confirm email" off the account already has a live session and
      // RootNavigator takes it into the app on its own — nothing to do here.
      // With it on, a code was emailed and has to be entered first.
      if (needsConfirmation) {
        router.push({ pathname: '/verify-code', params: { email: address, purpose: 'signup' } });
      }
    } catch (reason) {
      setError(t(reason instanceof AuthError ? authErrorKey(reason.code) : 'connectionError'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthScreenShell
      mode="create"
      busy={busy}
      error={error}
      showApple={appleAvailable}
      onApple={() => void apple()}
      onGoogle={() => void google()}
      onSubmit={(values) => void register(values)}
    />
  );
}
