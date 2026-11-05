import React from 'react';
import { Linking, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { homeGlassColors, useTheme } from '@/theme';
import { isHealthDataAvailable } from '@kingstinct/react-native-healthkit';
import { useSession } from '@/hooks/useSession';
import { useHealthActivity } from '@/hooks/useHealthActivity';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { BackBar } from '@/components/ui/BackBar';
import { Icon } from '@/components/icons/Icon';
import { useI18n, type TranslationKey } from '@/lib/i18n';

/**
 * What TheraHOME does with Apple Health, written where anybody can find it.
 *
 * App Review rejected 1.0.3 (50) under Guideline 2.5.1 on 2026-11-04: the
 * binary links HealthKit, but the reviewer — on an iPad Air, where HealthKit
 * does not exist and `GlassHealthCard` therefore renders nothing — could not
 * find any mention of it in the app's UI. The Home card now names Apple
 * Health in every state, and this screen is the part that is reachable on
 * EVERY iOS device, iPad included: it names the framework, lists exactly
 * which types are read, says plainly that nothing is ever written, and says
 * where the data stays.
 *
 * It is deliberately not gated on `isHealthDataAvailable()`. A screen that
 * hides itself on the one device App Review happened to use is the whole bug.
 */
const READS: TranslationKey[] = [
  'appleHealthReadSteps',
  'appleHealthReadDistance',
  'appleHealthReadFlights',
  'appleHealthReadRings',
];

function Section({ icon, title, body }: { icon: string; title: string; body: string }) {
  const theme = useTheme();
  return (
    <View
      style={[
        styles.card,
        { backgroundColor: homeGlassColors.surface, borderColor: homeGlassColors.hairline, borderRadius: theme.radius.lg },
      ]}
    >
      <View style={styles.cardHead}>
        <Icon name={icon} size={18} color={homeGlassColors.tick} />
        <Text style={[theme.type.bodyStrong, { color: homeGlassColors.text, flex: 1 }]}>{title}</Text>
      </View>
      <Text style={[theme.type.caption, { color: homeGlassColors.textMuted, lineHeight: 20 }]}>{body}</Text>
    </View>
  );
}

export default function AppleHealthScreen() {
  const theme = useTheme();
  const { t } = useI18n();
  const { session } = useSession();
  const { status, connect } = useHealthActivity(session?.user.id);
  // `useHealthActivity` folds three different things into 'unsupported'
  // (not iOS, no Health app, no signed-in user). Only the middle one is
  // worth a sentence about iPhones, so ask HealthKit itself rather than
  // telling a signed-out user their device has no Health app.
  const noHealthApp = Platform.OS !== 'ios' || !isHealthDataAvailable();

  const statusLabel =
    status === 'ready'
      ? t('appleHealthStatusReady')
      : status === 'empty'
        ? t('appleHealthStatusEmpty')
        : status === 'unsupported' && noHealthApp
          ? t('appleHealthStatusUnsupported')
          : status === 'loading'
            ? t('loading')
            : t('appleHealthStatusNeeds');
  const connected = status === 'ready' || status === 'empty';

  return (
    <ScreenContainer tone="glass">
      <BackBar tone="glass" onBack={() => router.back()} title={t('appleHealth')} />
      <ScrollView contentContainerStyle={styles.body}>
        <View style={styles.intro}>
          <View style={[styles.badge, { backgroundColor: homeGlassColors.surfaceRaised }]}>
            <Icon name="heart-pulse" size={24} color={homeGlassColors.ringMove} strokeWidth={2.2} />
          </View>
          <Text style={[theme.type.h2, { color: homeGlassColors.text }]}>{t('appleHealth')}</Text>
          <Text style={[theme.type.caption, styles.centered, { color: homeGlassColors.textMuted, lineHeight: 20 }]}>
            {t('appleHealthIntro')}
          </Text>
        </View>

        {/* Status first: it is the one line that differs per device, and the
            only one anybody comes back to this screen for. */}
        <View
          style={[
            styles.card,
            { backgroundColor: homeGlassColors.surface, borderColor: homeGlassColors.hairline, borderRadius: theme.radius.lg },
          ]}
        >
          <View style={styles.cardHead}>
            <Icon name={connected ? 'shield-check' : 'activity'} size={18} color={connected ? homeGlassColors.tick : homeGlassColors.textMuted} />
            <View style={{ flex: 1 }}>
              <Text style={[theme.type.captionSm, { color: homeGlassColors.textFaint }]}>{t('appleHealthStatus')}</Text>
              <Text style={[theme.type.bodyStrong, { color: homeGlassColors.text }]}>{statusLabel}</Text>
            </View>
          </View>

          {status === 'unsupported' ? (
            <Text style={[theme.type.caption, { color: homeGlassColors.textMuted, lineHeight: 20 }]}>
              {t('appleHealthIpadHint')}
            </Text>
          ) : status === 'needsPermission' ? (
            <Pressable
              accessibilityRole="button"
              onPress={() => void connect()}
              style={({ pressed }) => [
                styles.action,
                { backgroundColor: homeGlassColors.surfaceRaised, borderRadius: 999 },
                pressed && { opacity: 0.75 },
              ]}
            >
              <Text style={[theme.type.captionSm, { color: homeGlassColors.text, fontFamily: theme.fontFamily.semiBold }]}>
                {t('healthConnect')}
              </Text>
            </Pressable>
          ) : (
            <>
              <Text style={[theme.type.caption, { color: homeGlassColors.textMuted, lineHeight: 20 }]}>
                {t('appleHealthSettingsHint')}
              </Text>
              {/* iOS only — `openSettings` is a no-op worth hiding elsewhere. */}
              {Platform.OS === 'ios' ? (
                <Pressable
                  accessibilityRole="button"
                  onPress={() => void Linking.openSettings().catch(() => undefined)}
                  style={({ pressed }) => [
                    styles.action,
                    { backgroundColor: homeGlassColors.surfaceRaised, borderRadius: 999 },
                    pressed && { opacity: 0.75 },
                  ]}
                >
                  <Text style={[theme.type.captionSm, { color: homeGlassColors.text, fontFamily: theme.fontFamily.semiBold }]}>
                    {t('appleHealthOpenSettings')}
                  </Text>
                </Pressable>
              ) : null}
            </>
          )}
        </View>

        <View
          style={[
            styles.card,
            { backgroundColor: homeGlassColors.surface, borderColor: homeGlassColors.hairline, borderRadius: theme.radius.lg },
          ]}
        >
          <View style={styles.cardHead}>
            <Icon name="eye" size={18} color={homeGlassColors.tick} />
            <Text style={[theme.type.bodyStrong, { color: homeGlassColors.text, flex: 1 }]}>{t('appleHealthReadsTitle')}</Text>
          </View>
          {READS.map((key) => (
            <View key={key} style={styles.readRow}>
              <View style={[styles.dot, { backgroundColor: homeGlassColors.ringMove }]} />
              <Text style={[theme.type.caption, { color: homeGlassColors.textMuted, flex: 1, lineHeight: 20 }]}>{t(key)}</Text>
            </View>
          ))}
        </View>

        <Section icon="lock" title={t('appleHealthWriteTitle')} body={t('appleHealthWriteBody')} />
        <Section icon="shield" title={t('appleHealthPrivacyTitle')} body={t('appleHealthPrivacyBody')} />
        <Section icon="flame" title={t('appleHealthWhereTitle')} body={t('appleHealthWhereBody')} />
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  body: {
    paddingHorizontal: 20,
    paddingTop: 4,
    paddingBottom: 40,
    gap: 12,
  },
  intro: {
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 8,
    paddingBottom: 6,
  },
  badge: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  centered: {
    textAlign: 'center',
  },
  card: {
    borderWidth: 1,
    padding: 16,
    gap: 10,
  },
  cardHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  readRow: {
    flexDirection: 'row',
    // The rings line wraps onto two lines, and a centred bullet then sits in
    // the gap between them rather than against the first word.
    alignItems: 'flex-start',
    gap: 10,
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    // Half the caption's 20pt line height, less half the dot.
    marginTop: 7.5,
  },
  action: {
    alignSelf: 'flex-start',
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
});
