import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useTheme } from '@/theme';
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

const MENU: { icon: string; labelKey: TranslationKey; route: string }[] = [
  { icon: 'pencil', labelKey: 'editProfile', route: '/profile/edit' },
  { icon: 'bell', labelKey: 'workoutReminders', route: '/profile/notifications-settings' },
  { icon: 'grid', labelKey: 'accountSettings', route: '/profile/account' },
  { icon: 'phone', labelKey: 'helpSupport', route: '/profile/help' },
];

export default function ProfileScreen() {
  const theme = useTheme();
  const { t } = useI18n();
  const darkMode = useAppStore((s) => s.darkMode);
  const toggleDarkMode = useAppStore((s) => s.toggleDarkMode);
  const selectProduct = useAppStore((s) => s.selectProduct);
  const selectedProductId = useAppStore((s) => s.selectedProductId);
  const { session } = useSession();
  const userId = session?.user.id;
  const profile = useProfile(userId).data;
  const activatedPrograms = useActivatedPrograms(userId).data ?? [];
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
    await supabase.auth.signOut();
    selectProduct(null);
  }

  return (
    <ScreenContainer>
      <BackBar onBack={() => router.back()} title={t('profile')} />
      <ScrollView contentContainerStyle={styles.body}>
        <View style={styles.profileHead}>
          <AvatarImg size={84} editable uri={profile?.avatarUrl} onPress={() => router.push('/profile/edit')} />
          <Text style={[theme.type.h1, { color: theme.colors.textPrimary }]}>{profile?.fullName ?? t('you')}</Text>
          {program ? (
            <Text style={[theme.type.caption, { color: theme.colors.textSecondary }]}>
              {t('day')} {progress.day}/{progress.totalDays} · {program.streak} {t('streakDays')}
            </Text>
          ) : null}
        </View>

        <View style={styles.statsRow}>
          <View style={[styles.statBox, { backgroundColor: theme.colors.bgCardAlt, borderRadius: theme.radius.md }]}>
            <Text style={[theme.type.h1, { color: theme.colors.textPrimary }]}>{sessionsDone}</Text>
            <Text style={[theme.type.caption, { color: theme.colors.textSecondary, marginTop: 2 }]}>{t('sessionsDone')}</Text>
          </View>
          <View style={[styles.statBox, { backgroundColor: theme.colors.bgCardAlt, borderRadius: theme.radius.md }]}>
            <Text style={[theme.type.h1, { color: theme.colors.textPrimary }]}>{program?.adherencePct ?? 0}%</Text>
            <Text style={[theme.type.caption, { color: theme.colors.textSecondary, marginTop: 2 }]}>{t('adherence')}</Text>
          </View>
        </View>

        <View style={[styles.menuCard, theme.shadows.card, { backgroundColor: theme.colors.bgCard, borderRadius: theme.radius.lg }]}>
          <Pressable onPress={toggleDarkMode} style={[styles.menuRow, { borderBottomColor: theme.colors.divider, borderBottomWidth: 1 }]}>
            <Icon name="moon" size={20} color={theme.colors.primary} />
            {/* Fixed label + on/off track — the old flipping label ("Chế độ
                sáng" while dark) read like light mode was the thing enabled. */}
            <Text style={[theme.type.bodyStrong, { color: theme.colors.textPrimary, flex: 1 }]}>
              {t('darkMode')}
            </Text>
            <View style={[styles.toggleTrack, { backgroundColor: darkMode ? theme.colors.primary : theme.colors.borderInput }]}>
              <View style={[styles.toggleThumb, { left: darkMode ? 21 : 3 }]} />
            </View>
          </Pressable>
          {MENU.map((item, i) => (
            <Pressable
              key={item.route}
              onPress={() => router.push(item.route as never)}
              style={[styles.menuRow, i < MENU.length - 1 ? { borderBottomWidth: 1, borderBottomColor: theme.colors.divider } : null]}
            >
              <Icon name={item.icon} size={20} color={theme.colors.textSecondary} />
              <Text style={[theme.type.bodyStrong, { color: theme.colors.textPrimary, flex: 1 }]}>{t(item.labelKey)}</Text>
              <Icon name="chevron-right" size={16} color={theme.colors.textMuted} />
            </Pressable>
          ))}
        </View>

        <Pressable
          onPress={() => router.push({ pathname: '/profile/legal/[doc]', params: { doc: 'privacy' } })}
          style={[styles.linkCard, theme.shadows.card, { backgroundColor: theme.colors.bgCard, borderRadius: theme.radius.lg }]}
        >
          <Icon name="lock" size={20} color={theme.colors.textSecondary} />
          <Text style={[theme.type.bodyStrong, { color: theme.colors.textPrimary, flex: 1 }]}>{t('privacy')}</Text>
          <Icon name="chevron-right" size={16} color={theme.colors.textMuted} />
        </Pressable>

        <Pressable onPress={handleSignOut} style={[styles.signOutBtn, { backgroundColor: theme.colors.errorTint, borderRadius: theme.radius.md }]}>
          <Icon name="log-out" size={18} color={theme.colors.error} />
          <Text style={[theme.type.bodyStrong, { color: theme.colors.error }]}>{t('signOut')}</Text>
        </Pressable>
        <Pressable onPress={() => router.push('/profile/delete-account')} style={styles.deleteBtn}>
          <Text style={[theme.type.bodyStrong, { color: theme.colors.textMuted }]}>{t('deleteAccount')}</Text>
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
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
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
  linkCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    marginBottom: 12,
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
