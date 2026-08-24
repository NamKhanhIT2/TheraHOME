import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '@/theme';
import { countryQuestion } from '@/lib/mockData';
import { useAppStore, type AppLanguage, type AppMarket } from '@/store/useAppStore';
import { useSession } from '@/hooks/useSession';
import { useUpdateProfile } from '@/hooks/useProfile';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { OptionCard } from '@/components/ui/OptionCard';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/icons/Icon';
import { useI18n } from '@/lib/i18n';

/** Gated by RootNavigator's countryPending (app/_layout.tsx) — shown once,
 * right after activation, for every account type. Was previously the last
 * onboarding question (asked pre-auth) and, before that, a post-tabs popup;
 * moved here specifically so the choice can be persisted for real
 * (updateProfile.mutate({ language })) once userId exists, and gated
 * server-side (profiles.country_confirmed) so it can't be silently skipped
 * or re-shown incorrectly across devices. Two steps — pick, then a
 * dedicated confirm step — since region/language is hard to change
 * correctly later and the user explicitly asked for a second confirmation. */
export default function CountryScreen() {
  const theme = useTheme();
  const { t, language } = useI18n();
  const { session } = useSession();
  const updateProfile = useUpdateProfile(session?.user.id);
  const setMarket = useAppStore((s) => s.setMarket);
  const setLanguage = useAppStore((s) => s.setLanguage);
  const question = countryQuestion[language];
  const [selected, setSelected] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  function mapSelection(option: string): { language: AppLanguage; market: AppMarket } {
    if (option === 'US/EU') return { language: 'en', market: 'us-eu' };
    if (option === 'MALAY') return { language: 'ms', market: 'malay' };
    return { language: 'vi', market: 'vietnam' };
  }

  async function confirm() {
    if (!selected || submitting) return;
    setSubmitting(true);
    const mapped = mapSelection(selected);
    setMarket(mapped.market);
    setLanguage(mapped.language);
    try {
      await updateProfile.mutateAsync({ language: mapped.language, language_explicit: true, country_confirmed: true });
      // RootNavigator's countryPending gate flips false once this profile
      // refetch lands, which swaps the Stack.Protected group to (tabs) —
      // no explicit navigation needed here.
    } catch {
      setSubmitting(false);
    }
  }

  if (confirming && selected) {
    return (
      <ScreenContainer>
        <View style={styles.confirmWrap}>
          <View style={[styles.confirmIcon, { backgroundColor: theme.colors.primaryTint10 }]}>
            <Icon name="globe" size={26} color={theme.colors.primary} />
          </View>
          <Text style={[theme.type.h1, { color: theme.colors.textPrimary, textAlign: 'center', marginTop: 16 }]}>
            {t('countryConfirmTitle')}
          </Text>
          <Text style={[theme.type.body, { color: theme.colors.textSecondary, textAlign: 'center', marginTop: 8 }]}>
            {t('countryConfirmBody', { value: selected })}
          </Text>
        </View>
        <View style={styles.footer}>
          <Button style={{ width: '100%' }} loading={submitting} onPress={() => void confirm()}>
            {t('confirmAndContinue')}
          </Button>
          <Button style={{ width: '100%', marginTop: 10 }} variant="ghost" disabled={submitting} onPress={() => setConfirming(false)}>
            {t('chooseAgain')}
          </Button>
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <View style={styles.body}>
        <Text style={[theme.type.h1, { color: theme.colors.textPrimary }]}>{question.title}</Text>
        {question.subtitle ? (
          <Text style={[theme.type.body, { color: theme.colors.textSecondary, marginTop: 6 }]}>{question.subtitle}</Text>
        ) : null}
        <View style={styles.options}>
          {question.options.map((opt) => (
            <OptionCard key={opt} label={opt} active={selected === opt} onPress={() => setSelected(opt)} />
          ))}
        </View>
      </View>
      <View style={styles.footer}>
        <Button style={{ width: '100%' }} disabled={!selected} onPress={() => setConfirming(true)}>
          {t('continue')}
        </Button>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  body: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 28,
  },
  options: {
    gap: 10,
    marginTop: 22,
  },
  confirmWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  confirmIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footer: {
    padding: 20,
  },
});
