import React, { useState } from 'react';
import { Platform } from 'react-native';
import { router } from 'expo-router';
import { AuthScreenShell, type AuthFormValues } from '@/components/onboarding/AuthScreenShell';
import { AuthError, authErrorKey, signUpAccount } from '@/lib/authAccount';
import { useI18n } from '@/lib/i18n';
import { useAppStore } from '@/store/useAppStore';

export default function CreateAccountScreen() {
  const { t } = useI18n();
  const resetOnboardingAnswers = useAppStore((s) => s.resetOnboardingAnswers);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function register({ username, email, password }: AuthFormValues) {
    if (busy) return;
    setBusy(true); setError(null);
    try {
      const { email: address, needsConfirmation } = await signUpAccount({ username, email, password });
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
      showApple={Platform.OS === 'ios'}
      onSubmit={(values) => void register(values)}
    />
  );
}
