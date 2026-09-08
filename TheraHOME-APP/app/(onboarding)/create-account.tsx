import React, { useState } from 'react';
import { Platform } from 'react-native';
import { router } from 'expo-router';
import { AuthScreenShell, type AuthFormValues } from '@/components/onboarding/AuthScreenShell';
import { AuthError, authErrorKey, signUpAccount } from '@/lib/authAccount';
import { useI18n } from '@/lib/i18n';

export default function CreateAccountScreen() {
  const { t } = useI18n();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function register({ username, email, password }: AuthFormValues) {
    if (busy) return;
    setBusy(true); setError(null);
    try {
      const { email: address, needsConfirmation } = await signUpAccount({ username, email, password });
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
