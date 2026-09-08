import React, { useState } from 'react';
import { Text, View } from 'react-native';
import { router } from 'expo-router';
import { AuthLayout, AuthInput, PrimaryAuthButton, authStyles as s } from '@/components/onboarding/AuthScreenShell';
import { AuthError, authErrorKey, updatePassword } from '@/lib/authAccount';
import { useI18n } from '@/lib/i18n';
import { useAppStore } from '@/store/useAppStore';

/**
 * Reached only from a verified recovery code, which is what put a session in
 * place — `updateUser` changes the password of whoever is signed in, so this
 * screen must never be reachable any other way.
 */
export default function ResetPasswordScreen() {
  const { t } = useI18n();
  const setRecoveringPassword = useAppStore((state) => state.setRecoveringPassword);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (busy || !password) return;
    if (password !== confirm) { setError(t('errPasswordMismatch')); return; }
    setBusy(true); setError(null);
    try {
      await updatePassword(password);
      // Done recovering: clearing this lets RootNavigator show the app shell,
      // and the user is already signed in from the recovery session.
      setRecoveringPassword(false);
      // Already signed in as this account, so hand back to the root navigator.
      router.replace('/');
    } catch (reason) {
      setError(t(reason instanceof AuthError ? authErrorKey(reason.code) : 'connectionError'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthLayout>
      <Text style={s.title}>{t('authNewPasswordTitle')}</Text>
      <Text style={s.subtitle}>{t('authNewPasswordSubtitle')}</Text>
      <View style={s.fields}>
        <AuthInput icon="lock" value={password} onChangeText={setPassword} placeholder={t('authNewPassword')} secureTextEntry textContentType="newPassword" />
        <AuthInput icon="lock" value={confirm} onChangeText={setConfirm} placeholder={t('authConfirmPassword')} secureTextEntry textContentType="newPassword" />
      </View>
      {error ? <Text style={s.error}>{error}</Text> : null}
      <PrimaryAuthButton disabled={!password || !confirm || busy} busy={busy} label={t('authSavePassword')} onPress={() => void submit()} />
    </AuthLayout>
  );
}
