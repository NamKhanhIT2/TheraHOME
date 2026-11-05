import React from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { homeGlassColors, useTheme } from '@/theme';
import { supabase } from '@/lib/supabase';
import { useAppStore } from '@/store/useAppStore';
import { useSession } from '@/hooks/useSession';
import { useProfile } from '@/hooks/useProfile';
import { useActivatedPrograms, useProgramDays } from '@/hooks/usePrograms';
import { useAccessibleProgress } from '@/hooks/useAccessibleProgress';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { BackBar } from '@/components/ui/BackBar';
import { AvatarImg } from '@/components/AvatarImg';
import { Icon } from '@/components/icons/Icon';
import { useI18n, type TranslationKey } from '@/lib/i18n';
import { useActivePlanCode } from '@/hooks/useSubscription';

const MENU: { icon: string; labelKey: TranslationKey; route: string }[] = [
  // The subscription ladder (app/subscription.tsx). First row on purpose:
  // it is the only entrance to it, and a free user is meant to be able to
  // read what the paid tiers contain.
  { icon: 'crown', labelKey: 'plansUpgrade', route: '/subscription' },
  { icon: 'pencil', labelKey: 'editProfile', route: '/profile/edit' },
  { icon: 'bell', labelKey: 'workoutReminders', route: '/profile/notifications-settings' },
  // iOS only, and deliberately NOT gated on `isHealthDataAvailable()`:
  // Guideline 2.5.1 wants HealthKit named in the UI, and the device App
  // Review used (an iPad) is exactly the one where that check says no and
  // the Home card hides itself. See app/profile/apple-health.tsx.
  ...(Platform.OS === 'ios'
    ? [{ icon: 'heart-pulse', labelKey: 'appleHealth' as TranslationKey, route: '/profile/apple-health' }]
    : []),
  { icon: 'grid', labelKey: 'accountSettings', route: '/profile/account' },
  { icon: 'phone', labelKey: 'helpSupport', route: '/profile/help' },
];

export default function ProfileScreen() {
  const theme = useTheme();
  const { t } = useI18n();
  const selectedProductId = useAppStore((s) => s.selectedProductId);
  const { session } = useSession();
  const userId = session?.user.id;
  const profile = useProfile(userId).data;
  const activatedPrograms = useActivatedPrograms(userId).data ?? [];
  const activePlan = useActivePlanCode(userId).data ?? null;
  const program = activatedPrograms.find((p) => p.productId === selectedProductId) ?? activatedPrograms[0];
  // "Ngày N/X" synced with the selected roadmap — X counts only reachable
  // (non-IAP-locked) phases, same as Home's hero.
  const progress = useAccessibleProgress(userId, program);
  // Days actually watched — replaces the old streak stat box, which just
  // repeated the "N ngày liên tiếp" already shown under the name.
  const profileDays = useProgramDays(program?.userProgramId, program?.productId, program?.activatedAt).data ?? [];
  const sessionsDone = profileDays.filter((day) => day.status === 'done').length;

  async function handleSignOut() {
    // Ends the real Supabase session — the root layout's auth gate reacts to
    // this directly now (Phase 3 removed the mock activation bridge).
    // `await void X` awaits `undefined` — the sign-out was fired and never
    // waited for, so `selectProduct(null)` ran against a session that might
    // still be live.
    await supabase.auth.signOut().catch((e: unknown) => { if (__DEV__) console.warn('signOut failed:', e); });
    // Belt and braces: the root layout clears these off the SIGNED_OUT
    // event, but that event is Supabase's to emit and this is the path a
    // person actually takes.
    useAppStore.getState().clearAccountPreferences();
  }

  return (
    <ScreenContainer tone="glass">
      <BackBar tone="glass" onBack={() => router.back()} title={t('profile')} />
      <ScrollView contentContainerStyle={styles.body}>
        <View style={styles.profileHead}>
          <AvatarImg tone="glass" size={84} editable uri={profile?.avatarUrl} onPress={() => router.push('/profile/edit')} />
          {/* An account created with just an email carries no name until its
              owner sets one (owner, 2026-10-28). "Bạn" is how the app
              addresses them, not what they are called. */}
          <Text style={[theme.type.h1, { color: homeGlassColors.text }]}>{profile?.fullName ?? t('defaultUserName')}</Text>
          {program ? (
            <Text style={[theme.type.caption, { color: homeGlassColors.textMuted }]}>
              {t('day')} {progress.day}/{progress.totalDays} · {program.streak} {t('streakDays')}
            </Text>
          ) : null}
        </View>

        <View style={styles.statsRow}>
          <View style={[styles.statBox, { backgroundColor: homeGlassColors.surfaceRaised, borderRadius: theme.radius.md }]}>
            <Text style={[theme.type.h1, { color: homeGlassColors.text }]}>{sessionsDone}</Text>
            <Text style={[theme.type.caption, { color: homeGlassColors.textMuted, marginTop: 2 }]}>{t('sessionsDone')}</Text>
          </View>
          <View style={[styles.statBox, { backgroundColor: homeGlassColors.surfaceRaised, borderRadius: theme.radius.md }]}>
            <Text style={[theme.type.h1, { color: homeGlassColors.text }]}>{program?.adherencePct ?? 0}%</Text>
            <Text style={[theme.type.caption, { color: homeGlassColors.textMuted, marginTop: 2 }]}>{t('adherence')}</Text>
          </View>
        </View>

        {/* A rim rather than `theme.shadows.card`: a drop shadow is invisible
            on this ground, so the card had no edge at all. */}
        <View style={[styles.menuCard, { backgroundColor: homeGlassColors.surface, borderColor: homeGlassColors.hairline, borderRadius: theme.radius.lg }]}>
          {/* The dark-mode row is gone (owner, 2026-10-26). The app is
              being redesigned dark throughout, so a switch that flips the
              remaining light screens is a setting with nothing left to
              mean. `useAppStore.darkMode` still exists and still drives
              ThemeProvider — only the control was removed. */}
          {MENU.map((item, i) => (
            <Pressable
              key={item.route}
              onPress={() => router.push(item.route as never)}
              style={({ pressed }) => [styles.menuRow, i < MENU.length - 1 ? { borderBottomWidth: 1, borderBottomColor: homeGlassColors.hairline } : null, pressed ? { backgroundColor: homeGlassColors.surfaceRaised } : null]}
            >
              <Icon name={item.icon} size={20} color={homeGlassColors.textMuted} />
              <Text style={[theme.type.bodyStrong, { color: homeGlassColors.text, flex: 1 }]}>
                {/* "Nâng cấp gói" is the wrong word once somebody has one:
                    they are not upgrading, they are looking at what they
                    bought. The screen behind it already says "Gói hiện tại
                    của bạn" on the right card, so the row was the only thing
                    still calling it an upgrade. */}
                {item.labelKey === 'plansUpgrade' && activePlan ? t('plansYourPlan') : t(item.labelKey)}
              </Text>
              <Icon name="chevron-right" size={16} color={homeGlassColors.textFaint} />
            </Pressable>
          ))}
        </View>

        <Pressable
          onPress={() => router.push({ pathname: '/profile/legal/[doc]', params: { doc: 'privacy' } })}
          style={({ pressed }) => [styles.linkCard, { backgroundColor: pressed ? homeGlassColors.surfaceRaised : homeGlassColors.surface, borderColor: homeGlassColors.hairline, borderRadius: theme.radius.lg }]}
        >
          <Icon name="lock" size={20} color={homeGlassColors.textMuted} />
          <Text style={[theme.type.bodyStrong, { color: homeGlassColors.text, flex: 1 }]}>{t('privacy')}</Text>
          <Icon name="chevron-right" size={16} color={homeGlassColors.textFaint} />
        </Pressable>

        {/* `errorTint` is a pale pink wash made for a white page; on this one
            it glowed. A raised surface with the palette's own red on it says
            the same thing without shouting. */}
        <Pressable onPress={handleSignOut} style={({ pressed }) => [styles.signOutBtn, { backgroundColor: homeGlassColors.surfaceRaised, borderRadius: theme.radius.md }, pressed ? { opacity: 0.7 } : null]}>
          <Icon name="log-out" size={18} color={homeGlassColors.dotMissed} />
          <Text style={[theme.type.bodyStrong, { color: homeGlassColors.dotMissed }]}>{t('signOut')}</Text>
        </Pressable>
        <Pressable onPress={() => router.push('/profile/delete-account')} style={styles.deleteBtn}>
          <Text style={[theme.type.bodyStrong, { color: homeGlassColors.textFaint }]}>{t('deleteAccount')}</Text>
        </Pressable>
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
  profileHead: {
    alignItems: 'center',
    gap: 10,
    marginVertical: 12,
    marginBottom: 22,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  statBox: {
    flex: 1,
    padding: 16,
    alignItems: 'center',
  },
  menuCard: {
    overflow: 'hidden',
    marginBottom: 20,
    borderWidth: 1,
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  linkCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
  },
  signOutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
  },
  deleteBtn: {
    alignItems: 'center',
    paddingVertical: 14,
    marginTop: 4,
  },
});
