import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useTheme } from '@/theme';
import { useSession } from '@/hooks/useSession';
import { useProfile, useUpdateProfile } from '@/hooks/useProfile';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { BackBar } from '@/components/ui/BackBar';
import { Icon } from '@/components/icons/Icon';
import type { LegalDocKey } from '@/lib/legalContent';
import { useAppStore, type AppLanguage, type AppMarket } from '@/store/useAppStore';
import { useI18n, type TranslationKey } from '@/lib/i18n';

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
      <Icon name={icon} size={20} color={theme.colors.primary} />
      <View style={{ flex: 1 }}>
        <Text style={[theme.type.bodyStrong, { color: theme.colors.textPrimary }]}>{title}</Text>
        {sub ? <Text style={[theme.type.caption, { color: theme.colors.textSecondary, marginTop: 2 }]}>{sub}</Text> : null}
      </View>
      <Pressable onPress={() => onChange(!value)} style={[styles.toggleTrack, { backgroundColor: value ? theme.colors.primary : theme.colors.borderInput }]}>
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
  const setMarket = useAppStore((s) => s.setMarket);

  const shareData = profile?.dataSharingEnabled ?? false;

  return (
    <ScreenContainer>
      <BackBar onBack={() => router.back()} title={t('accountSettings')} />
      <ScrollView contentContainerStyle={styles.body}>
        <View style={[styles.card, theme.shadows.card, { backgroundColor: theme.colors.bgCard, borderRadius: theme.radius.lg, marginBottom: 20 }]}>
          {/* Sign-in is Google-only in this app (no password), so "Đổi mật khẩu"
              from the reference is replaced with a label-only row. */}
          <View style={[styles.row, { borderBottomWidth: 1, borderBottomColor: theme.colors.divider }]}>
            <Icon name="lock" size={20} color={theme.colors.primary} />
            <Text style={[theme.type.bodyStrong, { color: theme.colors.textPrimary, flex: 1 }]}>{t('googleAccount')}</Text>
          </View>

          <View style={[styles.langBlock, { borderBottomWidth: 1, borderBottomColor: theme.colors.divider }]}>
            <View style={styles.langHeader}>
              <Icon name="book" size={20} color={theme.colors.primary} />
              <Text style={[theme.type.bodyStrong, { color: theme.colors.textPrimary }]}>{t('language')}</Text>
            </View>
            <View style={styles.langOptions}>
              {([
                { code: 'vi', label: 'Tiếng Việt' },
                { code: 'en', label: 'English' },
                { code: 'ms', label: 'Bahasa Melayu' },
              ] as const).map(({ code, label }) => (
                <Pressable
                  key={code}
                  onPress={() => {
                    setLanguage(code as AppLanguage);
                    const market: AppMarket = code === 'ms' ? 'malay' : code === 'en' ? 'us-eu' : 'vietnam';
                    setMarket(market);
                    updateProfile.mutate({ language: code, language_explicit: true });
                  }}
                  style={[
                    styles.langBtn,
                    {
                      borderWidth: language === code ? 2 : 1,
                      borderColor: language === code ? theme.colors.primary : theme.colors.borderInput,
                      backgroundColor: language === code ? theme.colors.primaryTint10 : theme.colors.bgCard,
                      borderRadius: theme.radius.md,
                    },
                  ]}
                >
                  <Text style={[theme.type.body, { color: language === code ? theme.colors.primary : theme.colors.textPrimary, fontFamily: theme.fontFamily.semiBold }]}> 
                    {label}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          <ToggleRow
            icon="external-link"
            title={t('shareData')}
            sub={t('anonymousData')}
            value={shareData}
            onChange={(v) => updateProfile.mutate({ data_sharing_enabled: v })}
          />
        </View>

        <Text style={[theme.type.captionSm, { color: theme.colors.primaryDark, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 8 }]}>
          {t('legal')}
        </Text>
        <View style={[styles.card, theme.shadows.card, { backgroundColor: theme.colors.bgCard, borderRadius: theme.radius.lg }]}>
          {LEGAL_ROWS.map((row, i) => (
            <Pressable
              key={row.key}
              onPress={() => router.push({ pathname: '/profile/legal/[doc]', params: { doc: row.key } })}
              style={[styles.row, i < LEGAL_ROWS.length - 1 ? { borderBottomWidth: 1, borderBottomColor: theme.colors.divider } : null]}
            >
              <Icon name={row.icon} size={20} color={theme.colors.primary} />
              <Text style={[theme.type.bodyStrong, { color: theme.colors.textPrimary, flex: 1 }]}>{t(row.labelKey)}</Text>
              <Icon name="chevron-right" size={16} color={theme.colors.textMuted} />
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
    backgroundColor: '#fff',
    position: 'absolute',
    top: 3,
  },
});
