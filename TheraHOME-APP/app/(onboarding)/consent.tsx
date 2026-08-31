import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/theme';
import { useSession } from '@/hooks/useSession';
import { useUpdateProfile } from '@/hooks/useProfile';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { Button } from '@/components/ui/Button';
import { BackBar } from '@/components/ui/BackBar';
import { Icon } from '@/components/icons/Icon';
import { AnalyzingHud } from '@/components/onboarding/AnalyzingHud';
import { RoadmapReadyTimeline } from '@/components/RoadmapReadyTimeline';
import { useI18n } from '@/lib/i18n';

// Fixed dark backdrop for the analyzing state regardless of the app's own
// light/dark theme setting — same reasoning as login.tsx's BACKDROP_COLOR:
// this is a one-off full-bleed moment, not themed chrome.
const ANALYZING_BG = '#020813';

const DAY_ITEMS: { dayNumber: number; icon: string }[] = [
  { dayNumber: 1, icon: 'activity' },
  { dayNumber: 2, icon: 'droplet' },
  { dayNumber: 3, icon: 'accessibility' },
  { dayNumber: 4, icon: 'heart' },
  { dayNumber: 5, icon: 'shield' },
];
const FINAL_DAY: { dayNumber: number; icon: string } = { dayNumber: 14, icon: 'star' };

export default function ConsentScreen() {
  const theme = useTheme();
  const { t } = useI18n();
  // Two very different callers land here: a brand-new visitor still on the
  // pre-auth welcome/questions/consent walkthrough (no session yet — goes
  // on to /login as always), and an already-authenticated TheraHOME account
  // that RootNavigator routed back here because onboarding_completed was
  // false (see app/_layout.tsx). The latter just needs the flag flipped —
  // RootNavigator's own reactive gate (which reads this same profile query)
  // takes it to Home once the mutation's invalidation refetches it.
  const { session } = useSession();
  const updateProfile = useUpdateProfile(session?.user.id);
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();

  const [loading, setLoading] = useState(true);

  function handleBackToQuestions() {
    if (router.canGoBack()) router.back();
    else router.replace('/questions');
  }

  async function handleContinue() {
    if (!session?.user.id) {
      router.push('/login');
      return;
    }
    await updateProfile.mutateAsync({ onboarding_completed: true });
  }

  if (loading) {
    return (
      <View style={[styles.analyzingRoot, { backgroundColor: ANALYZING_BG, paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        <View style={styles.analyzingAmbientGlow} pointerEvents="none" />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('backLabel')}
          onPress={handleBackToQuestions}
          hitSlop={10}
          style={[styles.analyzingBack, { top: insets.top + 12 }]}
        >
          <Icon name="chevron-left" size={22} color="#FFFFFF" />
        </Pressable>
        <AnalyzingHud
          size={Math.min(width - 16, height - insets.top - insets.bottom - 24, 430)}
          preparingLabel={t('loadingPreparing')}
          completedLabel={t('analysisComplete')}
          onComplete={() => setLoading(false)}
        />
      </View>
    );
  }

  return (
    <ScreenContainer>
      <BackBar onBack={handleBackToQuestions} />
      <ScrollView contentContainerStyle={styles.body}>
        <Text style={[theme.type.body, { color: theme.colors.textSecondary }]}>{t('readyHello')}</Text>
        <Text style={[theme.type.display, { color: theme.colors.textPrimary, marginTop: 4 }]}>
          {t('readyHeadingPrefix')}
          <Text style={{ color: theme.colors.primary }}>{t('readyHeadingHighlight')}</Text>
        </Text>

        <View style={{ marginTop: 26 }}>
          <RoadmapReadyTimeline
            topLabels={[t('timelineStart'), t('timelineGoal1'), t('timelineGoalFinal')]}
            bottomLabels={[`${t('day')} 1`, `${t('day')} 7`, `${t('day')} 14`]}
          />
        </View>

        <View style={[styles.roadmapCard, theme.shadows.card, { backgroundColor: theme.colors.bgCard, borderRadius: theme.radius.lg }]}>
          <View style={[styles.roadmapHeader, { backgroundColor: theme.colors.primary, borderTopLeftRadius: theme.radius.lg, borderTopRightRadius: theme.radius.lg }]}>
            <View style={{ flex: 1 }}>
              <Text style={[theme.type.bodyStrong, { color: '#fff', fontFamily: theme.fontFamily.bold }]}>{t('roadmap14DaysTitle')}</Text>
              <Text style={[theme.type.captionSm, { color: 'rgba(255,255,255,0.85)', marginTop: 2 }]}>{t('roadmap14DaysSubtitle')}</Text>
            </View>
            <Pressable style={styles.seeAllPill} onPress={() => router.push('/login')}>
              <Text style={[theme.type.captionSm, { color: '#fff', fontFamily: theme.fontFamily.semiBold }]}>{t('seeAll')}</Text>
              <Icon name="chevron-right" size={12} color="#fff" />
            </Pressable>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.dayRow}>
            {DAY_ITEMS.map((d) => (
              <View key={d.dayNumber} style={[styles.dayTile, { backgroundColor: theme.colors.bgCardAlt, borderRadius: theme.radius.md }]}>
                <Text style={[theme.type.captionSm, { color: theme.colors.textPrimary, fontFamily: theme.fontFamily.bold }]}>{t('day')} {d.dayNumber}</Text>
                <View style={[styles.dayIconWrap, { backgroundColor: theme.colors.primaryTint10 }]}>
                  <Icon name={d.icon} size={20} color={theme.colors.primary} />
                </View>
              </View>
            ))}
            <Text style={[theme.type.h2, { color: theme.colors.textMuted, alignSelf: 'center', marginHorizontal: 2 }]}>···</Text>
            <View style={[styles.dayTile, { backgroundColor: theme.colors.bgCardAlt, borderRadius: theme.radius.md }]}>
              <Text style={[theme.type.captionSm, { color: theme.colors.textPrimary, fontFamily: theme.fontFamily.bold }]}>{t('day')} {FINAL_DAY.dayNumber}</Text>
              <View style={[styles.dayIconWrap, { backgroundColor: theme.colors.primaryTint10 }]}>
                <Icon name={FINAL_DAY.icon} size={20} color={theme.colors.primary} />
              </View>
            </View>
          </ScrollView>
        </View>

        <View style={[styles.noteBox, { backgroundColor: theme.colors.bgCardAlt, borderRadius: theme.radius.md }]}>
          <Icon name="trending-up" size={18} color={theme.colors.primary} />
          <Text style={[theme.type.caption, { color: theme.colors.textSecondary, flex: 1, marginLeft: 10 }]}>
            {t('stayConsistentNote')}
          </Text>
        </View>

        <View style={[styles.notes, { borderTopColor: theme.colors.divider }]}>
          <Text style={[theme.type.caption, { color: theme.colors.textSecondary, lineHeight: 20 }]}>{t('healthDataConsent')}</Text>
          <Text style={[theme.type.caption, { color: theme.colors.textSecondary, lineHeight: 20 }]}>{t('medicalDisclaimer')}</Text>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <Button style={{ width: '100%' }} loading={updateProfile.isPending} onPress={handleContinue}>
          {t('getMyRoadmap')}
        </Button>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  analyzingRoot: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  analyzingAmbientGlow: {
    position: 'absolute',
    width: 420,
    height: 420,
    borderRadius: 210,
    backgroundColor: 'rgba(0,127,217,0.055)',
  },
  analyzingBack: {
    position: 'absolute',
    left: 20,
    zIndex: 5,
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
  },
  body: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 12,
  },
  roadmapCard: {
    marginTop: 24,
    overflow: 'hidden',
  },
  roadmapHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  seeAllPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,255,255,0.16)',
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  dayRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    padding: 14,
  },
  dayTile: {
    width: 78,
    alignItems: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 6,
  },
  dayIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  noteBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: 18,
    padding: 14,
  },
  notes: {
    gap: 12,
    marginTop: 20,
    paddingTop: 16,
    borderTopWidth: 1,
  },
  footer: {
    paddingHorizontal: 20,
    paddingBottom: 16,
    paddingTop: 4,
  },
});
