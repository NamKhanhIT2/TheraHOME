import React, { useEffect, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { AuthLayout, AuthInput, PrimaryAuthButton, authStyles as s } from '@/components/onboarding/AuthScreenShell';
import {
  AuthError,
  authErrorKey,
  requestPasswordReset,
  resendSignUpCode,
  verifyRecoveryCode,
  verifySignUpCode,
} from '@/lib/authAccount';
import { useI18n } from '@/lib/i18n';

const RESEND_COOLDOWN_SECONDS = 30;

/**
 * The six-digit code, used by both flows that send one.
 *
 * `purpose` decides which of the two it verifies and where the person goes
 * next: a confirmed sign-up is already a signed-in session, so the root
 * navigator takes over from there, while a confirmed recovery code only
 * unlocks the password change that has to follow immediately.
 */
export default function VerifyCodeScreen() {
  const { t } = useI18n();
  const { email = '', purpose = 'signup' } = useLocalSearchParams<{ email?: string; purpose?: 'signup' | 'recovery' }>();
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(RESEND_COOLDOWN_SECONDS);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    timer.current = setInterval(() => setCooldown((value) => (value > 0 ? value - 1 : 0)), 1000);
    return () => { if (timer.current) clearInterval(timer.current); };
  }, []);

  async function submit() {
    if (busy || code.trim().length < 6) return;
    setBusy(true); setError(null); setNotice(null);
    try {
      if (purpose === 'recovery') {
        await verifyRecoveryCode(email, code);
        router.replace({ pathname: '/reset-password' });
      } else {
        await verifySignUpCode(email, code);
        // The session now exists; RootNavigator's guard swaps the stack.
        router.replace('/');
      }
    } catch (reason) {
      setError(t(reason instanceof AuthError ? authErrorKey(reason.code) : 'connectionError'));
    } finally {
      setBusy(false);
    }
  }

  async function resend() {
    if (busy || cooldown > 0) return;
    setBusy(true); setError(null); setNotice(null);
    try {
      if (purpose === 'recovery') await requestPasswordReset(email);
      else await resendSignUpCode(email);
      setNotice(t('authResent'));
      setCooldown(RESEND_COOLDOWN_SECONDS);
    } catch (reason) {
      setError(t(reason instanceof AuthError ? authErrorKey(reason.code) : 'connectionError'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthLayout>
      <Text style={s.title}>{t('authCodeTitle')}</Text>
      <Text style={s.subtitle}>{t('authCodeSubtitle', { email })}</Text>
      <View style={s.fields}>
        <AuthInput
          icon="shield-check"
          value={code}
          onChangeText={(value: string) => setCode(value.replace(/[^0-9]/g, '').slice(0, 8))}
          placeholder={t('authCodePlaceholder')}
          keyboardType="number-pad"
          textContentType="oneTimeCode"
          autoComplete="one-time-code"
          maxLength={8}
        />
      </View>
      {error ? <Text style={s.error}>{error}</Text> : null}
      {notice ? <Text style={[s.error, { color: '#1B8A5A' }]}>{notice}</Text> : null}
      <PrimaryAuthButton disabled={code.length < 6 || busy} busy={busy} label={t('authVerify')} onPress={() => void submit()} />
      <Pressable accessibilityRole="button" disabled={cooldown > 0 || busy} onPress={() => void resend()} style={{ alignSelf: 'center', paddingVertical: 14 }}>
        <Text style={[s.link, cooldown > 0 && { color: '#8FA3BC' }]}>
          {cooldown > 0 ? t('authResendIn', { seconds: String(cooldown) }) : t('authResend')}
        </Text>
      </Pressable>
    </AuthLayout>
  );
}
