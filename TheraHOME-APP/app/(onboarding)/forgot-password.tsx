import React, { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';
import { AuthLayout, AuthInput, PrimaryAuthButton, authStyles as s } from '@/components/onboarding/AuthScreenShell';
import { AuthError, authErrorKey, requestPasswordReset } from '@/lib/authAccount';
import { useI18n } from '@/lib/i18n';

/**
 * Asks for the email, not the username.
 *
 * The code has to be verified against the address it was sent to, and the
 * app is deliberately never told which email belongs to a username — see
 * auth-sign-in. Asking for the address directly keeps that boundary intact
 * and is what every other recovery form does anyway.
 *
 * It moves to the code screen whether or not that address has an account:
 * saying "no account with that email" would turn this into a way to check
 * who is registered.
 */
export default function ForgotPasswordScreen() {
  const { t } = useI18n();
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    const address = email.trim();
    if (busy || !address) return;
    setBusy(true); setError(null);
    try {
      await requestPasswordReset(address);
      router.push({ pathname: '/verify-code', params: { email: address, purpose: 'recovery' } });
    } catch (reason) {
      setError(t(reason instanceof AuthError ? authErrorKey(reason.code) : 'connectionError'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthLayout>
      <Text style={s.title}>{t('authForgotTitle')}</Text>
      <Text style={s.subtitle}>{t('authForgotSubtitle')}</Text>
      <View style={s.fields}>
        <AuthInput icon="mail" value={email} onChangeText={setEmail} placeholder={t('authEmail')} keyboardType="email-address" textContentType="emailAddress" />
      </View>
      {error ? <Text style={s.error}>{error}</Text> : null}
      <PrimaryAuthButton disabled={!email.trim() || busy} busy={busy} label={t('authSendCode')} onPress={() => void submit()} />
      <Pressable accessibilityRole="button" hitSlop={8} onPress={() => router.back()} style={{ alignSelf: 'center', paddingVertical: 14 }}>
        <Text style={s.link}>{t('cancel')}</Text>
      </Pressable>
    </AuthLayout>
  );
}
