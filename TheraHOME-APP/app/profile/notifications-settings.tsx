import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Linking, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useTheme } from '@/theme';
import { useSession } from '@/hooks/useSession';
import { useProfile, useUpdateProfile } from '@/hooks/useProfile';
import { useActivatedPrograms } from '@/hooks/usePrograms';
import { useAccessibleProgress } from '@/hooks/useAccessibleProgress';
import { registerForPushNotifications, scheduleDailyReminder, scheduleEveningReminder } from '@/lib/pushNotifications';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { BackBar } from '@/components/ui/BackBar';
import { Icon } from '@/components/icons/Icon';
import { useI18n } from '@/lib/i18n';
import { useAppStore } from '@/store/useAppStore';

const TIME_OPTIONS = Array.from({ length: 48 }, (_, index) => {
  const hour = Math.floor(index / 2);
  const minute = index % 2 === 0 ? '00' : '30';
  return `${String(hour).padStart(2, '0')}:${minute}`;
});

function ToggleRow({
  icon,
  title,
  sub,
  value,
  onChange,
  isLast,
}: {
  icon: string;
  title: string;
  sub?: string;
  value: boolean;
  onChange: (v: boolean) => void;
  isLast?: boolean;
}) {
  const theme = useTheme();
  return (
    <View style={[styles.row, !isLast ? { borderBottomWidth: 1, borderBottomColor: theme.colors.divider } : null]}>
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

function TimeRow({ icon, title, sub, value, onChange, isLast }: { icon: string; title: string; sub?: string; value: string; onChange: (v: string) => void; isLast?: boolean }) {
  const theme = useTheme();
  const [open, setOpen] = useState(false);
  return (
    <View style={[styles.row, !isLast ? { borderBottomWidth: 1, borderBottomColor: theme.colors.divider } : null]}>
      <Icon name={icon} size={20} color={theme.colors.primary} />
      <View style={{ flex: 1 }}>
        <Text style={[theme.type.bodyStrong, { color: theme.colors.textPrimary }]}>{title}</Text>
        {sub ? <Text style={[theme.type.caption, { color: theme.colors.textSecondary, marginTop: 2 }]}>{sub}</Text> : null}
      </View>
      <Pressable
        onPress={() => setOpen(true)}
        style={[styles.timePill, { backgroundColor: theme.colors.primaryTint10, borderRadius: theme.radius.md }]}
      >
        <Text style={[theme.type.bodyStrong, { color: theme.colors.primaryDark, fontFamily: theme.fontFamily.bold }]}>{value}</Text>
      </Pressable>
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <View style={[styles.timeSheet, theme.shadows.card, { backgroundColor: theme.colors.bgCard, borderRadius: theme.radius.lg }]}>
            <ScrollView showsVerticalScrollIndicator contentContainerStyle={styles.timeOptions}>
              {TIME_OPTIONS.map((t) => (
                <Pressable
                  key={t}
                  onPress={() => {
                    onChange(t);
                    setOpen(false);
                  }}
                  style={[styles.timeOption, { backgroundColor: t === value ? theme.colors.bgCardAlt : 'transparent' }]}
                >
                  <Text style={[theme.type.body, { color: theme.colors.textPrimary }]}>{t}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

export default function NotificationsSettingsScreen() {
  const theme = useTheme();
  const { t } = useI18n();
  const language = useAppStore((state) => state.language);
  const { session } = useSession();
  const userId = session?.user.id;
  const profileQuery = useProfile(userId);
  const updateProfile = useUpdateProfile(userId);
  // Accessible day (IAP-locked phases excluded) of the SELECTED program,
  // matching app/_layout.tsx's reminder scheduling — never advertises a
  // locked day, and with several programs follows the one the user views.
  const programs = useActivatedPrograms(userId).data;
  const selectedProductId = useAppStore((s) => s.selectedProductId);
  const reminderProgram = programs?.find((p) => p.productId === selectedProductId) ?? programs?.[0];
  const accessibleProgress = useAccessibleProgress(userId, reminderProgram);
  const currentDay = accessibleProgress.day > 0 ? accessibleProgress.day : reminderProgram?.currentDay;

  const [remind, setRemindState] = useState(false);
  const [remindTime, setRemindTimeState] = useState('08:00');
  const [remindEvening, setRemindEveningState] = useState(false);
  const [remindEveningTime, setRemindEveningTimeState] = useState('20:30');

  useEffect(() => {
    if (!profileQuery.data) return;
    setRemindState(profileQuery.data.dailyReminderEnabled);
    setRemindTimeState(profileQuery.data.dailyReminderTime);
    setRemindEveningState(profileQuery.data.eveningReminderEnabled);
    setRemindEveningTimeState(profileQuery.data.eveningReminderTime);
  }, [profileQuery.data?.dailyReminderEnabled, profileQuery.data?.dailyReminderTime, profileQuery.data?.eveningReminderEnabled, profileQuery.data?.eveningReminderTime]);

  async function setRemind(v: boolean) {
    if (v) {
      if (!userId) return;
      const granted = await registerForPushNotifications(userId);
      if (!granted) {
        Alert.alert(t('permissionRequired'), t('permissionSettingsMessage'), [
          { text: t('cancel'), style: 'cancel' },
          { text: t('openSettings'), onPress: () => void Linking.openSettings() },
        ]);
        return;
      }
    }
    setRemindState(v);
    updateProfile.mutate(
      { daily_reminder_enabled: v },
      { onError: () => setRemindState(!v) },
    );
    await scheduleDailyReminder(v, remindTime, language, currentDay).catch(() => Alert.alert(t('notificationError')));
  }

  function setRemindTime(v: string) {
    const previous = remindTime;
    setRemindTimeState(v);
    updateProfile.mutate({ daily_reminder_time: v }, { onError: () => setRemindTimeState(previous) });
    if (remind) void scheduleDailyReminder(true, v, language, currentDay).catch(() => Alert.alert(t('notificationError')));
  }

  async function setRemindEvening(v: boolean) {
    if (v) {
      if (!userId) return;
      const granted = await registerForPushNotifications(userId);
      if (!granted) {
        Alert.alert(t('permissionRequired'), t('permissionSettingsMessage'), [
          { text: t('cancel'), style: 'cancel' },
          { text: t('openSettings'), onPress: () => void Linking.openSettings() },
        ]);
        return;
      }
    }
    setRemindEveningState(v);
    updateProfile.mutate(
      { evening_reminder_enabled: v },
      { onError: () => setRemindEveningState(!v) },
    );
    await scheduleEveningReminder(v, remindEveningTime, language).catch(() => Alert.alert(t('notificationError')));
  }

  function setRemindEveningTime(v: string) {
    const previous = remindEveningTime;
    setRemindEveningTimeState(v);
    updateProfile.mutate({ evening_reminder_time: v }, { onError: () => setRemindEveningTimeState(previous) });
    if (remindEvening) void scheduleEveningReminder(true, v, language).catch(() => Alert.alert(t('notificationError')));
  }

  if (profileQuery.isPending) {
    return (
      <ScreenContainer>
        <BackBar onBack={() => router.back()} title={t('notifications')} />
        <View style={styles.loadingBox}>
          <ActivityIndicator color={theme.colors.primary} />
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <BackBar onBack={() => router.back()} title={t('notifications')} />
      <ScrollView contentContainerStyle={styles.body}>
        <Text
          style={[
            theme.type.captionSm,
            { color: theme.colors.primaryDark, textTransform: 'uppercase', letterSpacing: 0.4, marginVertical: 8, marginTop: 10 },
          ]}
        >
          {t('notifications')}
        </Text>
        <View style={[styles.card, theme.shadows.card, { backgroundColor: theme.colors.bgCard, borderRadius: theme.radius.lg }]}>
          <ToggleRow icon="sun" title={t('morning')} sub={t('reminderSubtitle')} value={remind} onChange={setRemind} isLast={!remind} />
          {remind ? <TimeRow icon="clock" title={t('reminderTime')} value={remindTime} onChange={setRemindTime} isLast={false} /> : null}
          <ToggleRow icon="moon" title={t('evening')} sub={t('reminderSubtitle')} value={remindEvening} onChange={(v) => void setRemindEvening(v)} isLast={!remindEvening} />
          {remindEvening ? <TimeRow icon="clock" title={t('reminderTime')} value={remindEveningTime} onChange={setRemindEveningTime} isLast /> : null}
        </View>

        <Text
          style={[
            theme.type.captionSm,
            { color: theme.colors.primaryDark, textTransform: 'uppercase', letterSpacing: 0.4, marginVertical: 8, marginTop: 22 },
          ]}
        >
          {t('notifCommunitySection')}
        </Text>
        <View style={[styles.card, theme.shadows.card, { backgroundColor: theme.colors.bgCard, borderRadius: theme.radius.lg }]}>
          <ToggleRow
            icon="bell"
            title={t('notifCommunitySection')}
            sub={t('notifCommunityAllSub')}
            value={profileQuery.data?.notifyCommunity ?? true}
            onChange={(v) => updateProfile.mutate({ notify_community: v }, { onError: () => Alert.alert(t('sendFailTitle'), t('tryAgainBody')) })}
          />
          <ToggleRow
            icon="message-circle"
            title={t('notifComments')}
            sub={t('notifCommentsSub')}
            value={profileQuery.data?.notifyComments ?? true}
            onChange={(v) => updateProfile.mutate({ notify_comments: v }, { onError: () => Alert.alert(t('sendFailTitle'), t('tryAgainBody')) })}
          />
          <ToggleRow
            icon="message-circle"
            title={t('notifReplies')}
            sub={t('notifRepliesSub')}
            value={profileQuery.data?.notifyReplies ?? true}
            onChange={(v) => updateProfile.mutate({ notify_replies: v }, { onError: () => Alert.alert(t('sendFailTitle'), t('tryAgainBody')) })}
          />
          <ToggleRow
            icon="heart"
            title={t('notifReactions')}
            sub={t('notifReactionsSub')}
            value={profileQuery.data?.notifyReactions ?? true}
            onChange={(v) => updateProfile.mutate({ notify_reactions: v }, { onError: () => Alert.alert(t('sendFailTitle'), t('tryAgainBody')) })}
            isLast
          />
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  loadingBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
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
  timePill: {
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(20,24,34,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  timeSheet: {
    width: '100%',
    maxWidth: 260,
    maxHeight: 360,
    overflow: 'hidden',
  },
  timeOptions: {
    paddingVertical: 8,
  },
  timeOption: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
});
