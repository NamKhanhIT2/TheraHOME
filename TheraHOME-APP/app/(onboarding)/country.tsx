import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useTheme } from '@/theme';
import { countryQuestion } from '@/lib/mockData';
import { useAppStore, type AppLanguage, type AppMarket } from '@/store/useAppStore';
import { useSession } from '@/hooks/useSession';
import { useUpdateProfile } from '@/hooks/useProfile';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { OptionCard } from '@/components/ui/OptionCard';
import { Button } from '@/components/ui/Button';
import { BackBar } from '@/components/ui/BackBar';
import { useI18n, type TranslationKey } from '@/lib/i18n';
import { marketForCountryOption } from '@/hooks/useMarket';

/** Gated by RootNavigator's countryPending (app/_layout.tsx) — shown once,
 * right after activation, for every account type. Was previously the last
 * onboarding question (asked pre-auth) and, before that, a post-tabs popup;
 * moved here specifically so the choice can be persisted for real
 * (updateProfile.mutate({ language })) once userId exists, and gated
 * server-side (profiles.country_confirmed) so it can't be silently skipped
 * or re-shown incorrectly across devices. Two steps — pick, then a
 * dedicated confirm step — since region/language is hard to change
 * correctly later and the user explicitly asked for a second confirmation. */
/** The option strings are STABLE KEYS — `mapSelection` and
 * `marketForCountryOption` both switch on them, and `profiles.country` is
 * derived from them — so they stay raw and only the on-screen label is
 * translated. Before this, every language rendered the raw 'US/EU',
 * 'VIET NAM', 'MALAY' tokens, including in the confirmation sentence. */
const OPTION_LABEL_KEY: Record<string, TranslationKey> = {
  'US/EU': 'countryOptionUS',
  'VIET NAM': 'countryNameVN',
  MALAY: 'countryNameMY',
};

const OPTION_FLAG: Record<string, string> = {
  'US/EU': '🇺🇸',
  'VIET NAM': '🇻🇳',
  MALAY: '🇲🇾',
};

export default function CountryScreen() {
  const theme = useTheme();
  const { t, language } = useI18n();
  const { session } = useSession();
  const updateProfile = useUpdateProfile(session?.user.id);
  const setMarket = useAppStore((s) => s.setMarket);
  const setLanguage = useAppStore((s) => s.setLanguage);
  const question = countryQuestion[language];
  const [selected, setSelected] = useState<string | null>(null);
  const optionLabel = (option: string) => {
    const key = OPTION_LABEL_KEY[option];
    return key ? t(key) : option;
  };
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
      // `country` is what every market-specific surface keys off from now
      // on (useMarket.ts) — language is just the initial UI language.
      await updateProfile.mutateAsync({ language: mapped.language, language_explicit: true, country_confirmed: true, country: marketForCountryOption(selected) });
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
            <Text accessibilityLabel={optionLabel(selected)} style={styles.confirmFlag}>
              {OPTION_FLAG[selected]}
            </Text>
          </View>
          <Text style={[theme.type.h1, { color: theme.colors.textPrimary, textAlign: 'center', marginTop: 16 }]}>
            {t('countryConfirmTitle')}
          </Text>
          <Text style={[theme.type.body, { color: theme.colors.textSecondary, textAlign: 'center', marginTop: 8 }]}>
            {t('countryConfirmBody', { value: optionLabel(selected) })}
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
      <BackBar onBack={() => router.replace('/consent')} />
      <View style={styles.body}>
        <Text style={[theme.type.h1, { color: theme.colors.textPrimary }]}>{question.title}</Text>
        <View style={styles.options}>
          {question.options.map((opt) => (
            <OptionCard
              key={opt}
              label={`${OPTION_FLAG[opt]}  ${optionLabel(opt)}`}
              active={selected === opt}
              onPress={() => setSelected(opt)}
            />
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
    paddingTop: 18,
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
  confirmFlag: {
    fontSize: 38,
    lineHeight: 46,
  },
  footer: {
    padding: 20,
  },
});
