import React, { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { homeGlassColors, useTheme } from '@/theme';
import { useSession } from '@/hooks/useSession';
import { useProfile, useUpdateProfile } from '@/hooks/useProfile';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { BackBar } from '@/components/ui/BackBar';
import { Icon } from '@/components/icons/Icon';
import type { LegalDocKey } from '@/lib/legalContent';
import { useAppStore, type AppLanguage } from '@/store/useAppStore';
import { useI18n, type TranslationKey } from '@/lib/i18n';
import { AuthError, authErrorKey, requestPasswordReset } from '@/lib/authAccount';

const LEGAL_ROWS: { key: LegalDocKey; icon: string; labelKey: TranslationKey }[] = [
  { key: 'terms', icon: 'file-text', labelKey: 'terms' },
  { key: 'privacy', icon: 'lock', labelKey: 'privacy' },
  { key: 'security', icon: 'shield', labelKey: 'security' },
  { key: 'community', icon: 'users', labelKey: 'communityGuidelines' },
];

function ToggleRow({ icon, title, sub, value, onChange }: { icon: string; title: string; sub?: string; value: boolean; onChange: (v: boolean) => void }) {
  const theme = useTheme();
  return (
    <View style={styles.row}>
      <Icon name={icon} size={20} color={homeGlassColors.tick} />
      <View style={{ flex: 1 }}>
        <Text style={[theme.type.bodyStrong, { color: homeGlassColors.text }]}>{title}</Text>
        {sub ? <Text style={[theme.type.caption, { color: homeGlassColors.textMuted, marginTop: 2 }]}>{sub}</Text> : null}
      </View>
      <Pressable onPress={() => onChange(!value)} style={[styles.toggleTrack, { backgroundColor: value ? homeGlassColors.tick : homeGlassColors.hairline }]}>
        <View style={[styles.toggleThumb, { left: value ? 21 : 3 }]} />
      </Pressable>
    </View>
  );
}

export default function AccountSettingsScreen() {
  const theme = useTheme();
  const { t } = useI18n();
  const { session } = useSession();
  const userId = session?.user.id;
  const profile = useProfile(userId).data;
  const updateProfile = useUpdateProfile(userId);
  const language = useAppStore((s) => s.language);
  const setLanguage = useAppStore((s) => s.setLanguage);

  const shareData = profile?.dataSharingEnabled ?? false;

  // What the account actually signs in with. Supabase records the provider on
  // the user; 'email' means a password account (TheraHOME-issued or
  // self-registered), the others are OAuth and have no password to change.
  const signInProvider = (session?.user.app_metadata?.provider ?? 'email') as string;
  const accountEmail = profile?.email ?? session?.user.email ?? null;
  const [sendingReset, setSendingReset] = useState(false);

  // Reuses the same recovery mail the sign-in screen sends, so there is one
  // password-reset path in the app rather than two that can drift.
  async function changePassword() {
    if (!accountEmail || sendingReset) return;
    setSendingReset(true);
    try {
      await requestPasswordReset(accountEmail);
      Alert.alert(t('authForgotTitle'), t('authCodeSubtitle', { email: accountEmail }));
    } catch (cause) {
      const code = cause instanceof AuthError ? cause.code : 'unknown';
      Alert.alert(t('errGeneric'), t(authErrorKey(code)));
    } finally {
      setSendingReset(false);
    }
  }

  return (
    <ScreenContainer tone="glass">
      <BackBar tone="glass" onBack={() => router.back()} title={t('accountSettings')} />
      <ScrollView contentContainerStyle={styles.body}>
        <View style={[styles.card, { borderWidth: 1, borderColor: homeGlassColors.hairline }, { backgroundColor: homeGlassColors.surface, borderRadius: theme.radius.lg, marginBottom: 20 }]}>
          {/* Was a hardcoded "Quản lý tài khoản Google" label, written when
              Google was the only way in. The app now also signs in with email
              + password and with Apple, so that row told most users something
              untrue and left password accounts with no way to change their
              password anywhere in the app. */}
          <View style={[styles.row, { borderBottomWidth: 1, borderBottomColor: homeGlassColors.hairline }]}>
            <Icon name={signInProvider === 'google' ? 'user' : signInProvider === 'apple' ? 'user' : 'mail'} size={20} color={homeGlassColors.tick} />
            <View style={{ flex: 1 }}>
              <Text style={[theme.type.bodyStrong, { color: homeGlassColors.text }]}>
                {signInProvider === 'google' ? t('signInWithGoogle') : signInProvider === 'apple' ? t('signInWithApple') : t('authEmail')}
              </Text>
              {accountEmail ? (
                <Text style={[theme.type.caption, { color: homeGlassColors.textMuted, marginTop: 2 }]}>{accountEmail}</Text>
              ) : null}
            </View>
          </View>
          {signInProvider === 'email' && accountEmail ? (
            <Pressable
              onPress={changePassword}
              disabled={sendingReset}
              style={[styles.row, { borderBottomWidth: 1, borderBottomColor: homeGlassColors.hairline }]}
              accessibilityRole="button"
            >
              <Icon name="lock" size={20} color={homeGlassColors.tick} />
              <Text style={[theme.type.bodyStrong, { color: homeGlassColors.text, flex: 1 }]}>{t('authNewPasswordTitle')}</Text>
              <Icon name="chevron-right" size={18} color={homeGlassColors.textFaint} />
            </Pressable>
          ) : null}

          <View style={[styles.langBlock, { borderBottomWidth: 1, borderBottomColor: homeGlassColors.hairline }]}>
            <View style={styles.langHeader}>
              <Icon name="book" size={20} color={homeGlassColors.tick} />
              <Text style={[theme.type.bodyStrong, { color: homeGlassColors.text }]}>{t('language')}</Text>
            </View>
            <View style={styles.langOptions}>
              {/* Labels follow the CURRENT UI language (per explicit request
                  2026-09-04: with English active this reads Vietnamese /
                  English / Malay, not the endonyms). */}
              {([
                { code: 'vi', label: t('langNameVi') },
                { code: 'en', label: t('langNameEn') },
                { code: 'ms', label: t('langNameMs') },
              ] as const).map(({ code, label }) => (
                <Pressable
                  key={code}
                  onPress={() => {
                    // Language only. It used to overwrite the market too,
                    // which is how a VN customer reading in English ended
                    // up with US prices — market lives in the block below.
                    const previous = language;
                    setLanguage(code as AppLanguage);
                    updateProfile.mutate(
                      { language: code, language_explicit: true },
                      { onError: () => { setLanguage(previous); Alert.alert(t('errGeneric'), t('tryAgainBody')); } },
                    );
                  }}
                  style={[
                    styles.langBtn,
                    {
                      borderWidth: language === code ? 2 : 1,
                      borderColor: language === code ? homeGlassColors.tick : homeGlassColors.hairline,
                      backgroundColor: language === code ? homeGlassColors.hairline : homeGlassColors.surface,
                      borderRadius: theme.radius.md,
                    },
                  ]}
                >
                  <Text style={[theme.type.body, { color: language === code ? homeGlassColors.tick : homeGlassColors.text, fontFamily: theme.fontFamily.semiBold }]}> 
                    {label}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          {/* No country/region row here, on purpose (owner, 2026-09-06):
              the market is set once at onboarding and is not shown or
              editable in the app — a picker here once let anyone switch to
              VN and buy through the cheaper Vietnamese links. Changes go
              through CSKH from the Admin user drawer. */}

          <ToggleRow
            icon="external-link"
            title={t('shareData')}
            sub={t('anonymousData')}
            value={shareData}
            onChange={(v) => updateProfile.mutate({ data_sharing_enabled: v }, { onError: () => Alert.alert(t('errGeneric'), t('tryAgainBody')) })}
          />
        </View>

        <Text style={[theme.type.captionSm, { color: homeGlassColors.tick, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 8 }]}>
          {t('legal')}
        </Text>
        <View style={[styles.card, { borderWidth: 1, borderColor: homeGlassColors.hairline }, { backgroundColor: homeGlassColors.surface, borderRadius: theme.radius.lg }]}>
          {LEGAL_ROWS.map((row, i) => (
            <Pressable
              key={row.key}
              onPress={() => router.push({ pathname: '/profile/legal/[doc]', params: { doc: row.key } })}
              style={[styles.row, i < LEGAL_ROWS.length - 1 ? { borderBottomWidth: 1, borderBottomColor: homeGlassColors.hairline } : null]}
            >
              <Icon name={row.icon} size={20} color={homeGlassColors.tick} />
              <Text style={[theme.type.bodyStrong, { color: homeGlassColors.text, flex: 1 }]}>{t(row.labelKey)}</Text>
              <Icon name="chevron-right" size={16} color={homeGlassColors.textFaint} />
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  body: {
    paddingHorizontal: 20,
    paddingTop: 4,
    paddingBottom: 40,
  },
  card: {
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  langBlock: {
    padding: 16,
  },
  langHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 10,
  },
  langOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  langBtn: {
    minWidth: '47%',
    flexGrow: 1,
    alignItems: 'center',
    paddingVertical: 10,
  },
  toggleTrack: {
    width: 44,
    height: 26,
    borderRadius: 13,
  },
  toggleThumb: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: homeGlassColors.text,
    position: 'absolute',
    top: 3,
  },
});
