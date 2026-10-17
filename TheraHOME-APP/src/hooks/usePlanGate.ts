// The one dialog shown when somebody taps a feature their plan does not
// include (owner 2026-10-13): cancel, or go to the plans.
//
// A native Alert rather than a designed sheet, deliberately. It is an
// interruption with two answers, which is exactly what the platform dialog
// is for, and it is what Zalo and Messenger use for the same moment. The
// designed sheet in UpgradePromptModal earns its weight because it ADVERTISES
// — this one only answers "why did nothing happen when I tapped that".
//
// Routing lives here too, so no caller has to remember where the paywall is.
import { useCallback } from 'react';
import { Alert } from 'react-native';
import { router } from 'expo-router';
import { useI18n, type TranslationKey } from '@/lib/i18n';

/** The features that can be gated. Named keys rather than free text so a
 * caller cannot accidentally put an untranslated string in front of a
 * customer reading the app in English or Malay. */
export type GatedFeature = Extract<TranslationKey, 'featureFormReview' | 'featureCall' | 'featureMotionTracking'>;

export function usePlanGate() {
  const { t } = useI18n();
  return useCallback(
    (feature: GatedFeature) => {
      Alert.alert(t('planRequiredTitle'), t('planRequiredBody', { feature: t(feature) }), [
        { text: t('cancel'), style: 'cancel' },
        { text: t('planRequiredCta'), onPress: () => router.push('/subscription') },
      ]);
    },
    [t],
  );
}
