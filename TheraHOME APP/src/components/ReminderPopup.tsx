import React, { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '@/theme';
import { useUpdateProfile } from '@/hooks/useProfile';
import { useActivatedPrograms } from '@/hooks/usePrograms';
import { registerForPushNotifications, scheduleDailyReminder, scheduleEveningReminder } from '@/lib/pushNotifications';
import { useI18n } from '@/lib/i18n';
import { useAppStore } from '@/store/useAppStore';
import { Icon } from '@/components/icons/Icon';

const DEFAULT_MORNING_TIME = '07:00';
const DEFAULT_EVENING_TIME = '20:30';
const TIME_OPTIONS = Array.from({ length: 48 }, (_, index) => {
  const hour = Math.floor(index / 2);
  const minute = index % 2 === 0 ? '00' : '30';
  return `${String(hour).padStart(2, '0')}:${minute}`;
});

function ToggleRow({
  icon,
  label,
  time,
  value,
  onChange,
  onPressTime,
}: {
  icon: string;
  label: string;
  time: string;
  value: boolean;
  onChange: (v: boolean) => void;
  onPressTime: () => void;
}) {
  const theme = useTheme();
  return (
    <View style={styles.row}>
      <View style={[styles.rowIcon, { backgroundColor: theme.colors.primaryTint10 }]}>
        <Icon name={icon} size={18} color={theme.colors.primary} />
      </View>
      <Text style={[theme.type.bodyStrong, { color: theme.colors.textPrimary, flex: 1 }]}>{label}</Text>
      <Pressable
        onPress={onPressTime}
        disabled={!value}
        style={[styles.timePill, { backgroundColor: theme.colors.bgCardAlt, opacity: value ? 1 : 0.4 }]}
      >
        <Text style={[theme.type.caption, { color: theme.colors.primaryDark, fontFamily: theme.fontFamily.semiBold }]}>{time}</Text>
      </Pressable>
      <Pressable onPress={() => onChange(!value)} style={[styles.toggleTrack, { backgroundColor: value ? theme.colors.primary : theme.colors.borderInput }]}>
        <View style={[styles.toggleThumb, { left: value ? 21 : 3 }]} />
      </Pressable>
    </View>
  );
}

export interface ReminderPopupProps {
  userId: string;
  onDone: () => void;
}

/** Post-login popup replacing the old plain allow/deny NotificationPermissionModal
 * — lets the user pick morning/evening reminder times (defaults 07:00/20:30,
 * each independently editable via a small time-select sheet, not just
 * on/off) before the OS permission prompt fires, then persists both to the
 * profile and schedules the two local reminders independently. Always
 * closes forward (no separate "deny" path) since neither toggle nor the
 * permission result should block onboarding. */
export function ReminderPopup({ userId, onDone }: ReminderPopupProps) {
  const theme = useTheme();
  const { t, language } = useI18n();
  const updateProfile = useUpdateProfile(userId);
  const programsQuery = useActivatedPrograms(userId);
  const currentDay = programsQuery.data?.[0]?.currentDay;
  const setHasSeenReminderPrompt = useAppStore((s) => s.setHasSeenReminderPrompt);
  const [morningOn, setMorningOn] = useState(true);
  const [eveningOn, setEveningOn] = useState(true);
  const [morningTime, setMorningTime] = useState(DEFAULT_MORNING_TIME);
  const [eveningTime, setEveningTime] = useState(DEFAULT_EVENING_TIME);
  const [pickingTimeFor, setPickingTimeFor] = useState<'morning' | 'evening' | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function confirm() {
    if (submitting) return;
    setSubmitting(true);
    try {
      const granted = await registerForPushNotifications(userId);
      if (granted) {
        await Promise.all([
          scheduleDailyReminder(morningOn, morningTime, language, currentDay),
          scheduleEveningReminder(eveningOn, eveningTime, language),
        ]);
      }
      await updateProfile.mutateAsync({
        daily_reminder_enabled: morningOn,
        daily_reminder_time: morningTime,
        evening_reminder_enabled: eveningOn,
        evening_reminder_time: eveningTime,
      });
    } catch {
      // Best-effort — the popup still closes so onboarding isn't blocked;
      // the user can retry in Profile > Notifications.
    } finally {
      setSubmitting(false);
      setHasSeenReminderPrompt(true);
      onDone();
    }
  }

  return (
    <Modal visible transparent animationType="fade">
      <View style={styles.backdrop}>
        <View style={[styles.card, theme.shadows.card, { backgroundColor: theme.colors.bgCard, borderRadius: theme.radius.lg }]}>
          <Text style={[theme.type.h2, { color: theme.colors.textPrimary, textAlign: 'center' }]}>{t('reminderPopupTitle')}</Text>
          <View style={styles.rows}>
            <ToggleRow icon="sun" label={t('morning')} time={morningTime} value={morningOn} onChange={setMorningOn} onPressTime={() => setPickingTimeFor('morning')} />
            <ToggleRow icon="moon" label={t('evening')} time={eveningTime} value={eveningOn} onChange={setEveningOn} onPressTime={() => setPickingTimeFor('evening')} />
          </View>
          <Text style={[theme.type.caption, { color: theme.colors.textSecondary, textAlign: 'center', marginTop: 14 }]}>
            {t('reminderPopupHint')}
          </Text>
          <Pressable
            onPress={() => void confirm()}
            disabled={submitting}
            style={[styles.confirmBtn, { backgroundColor: theme.colors.primary, opacity: submitting ? 0.6 : 1 }]}
          >
            <Text style={[theme.type.button, { color: '#fff' }]}>{t('turnOnNotifications')}</Text>
          </Pressable>
        </View>
      </View>

      <Modal visible={!!pickingTimeFor} transparent animationType="fade" onRequestClose={() => setPickingTimeFor(null)}>
        <Pressable style={styles.backdrop} onPress={() => setPickingTimeFor(null)}>
          <View style={[styles.timeSheet, theme.shadows.card, { backgroundColor: theme.colors.bgCard, borderRadius: theme.radius.lg }]}>
            <ScrollView showsVerticalScrollIndicator contentContainerStyle={styles.timeOptions}>
              {TIME_OPTIONS.map((time) => {
                const current = pickingTimeFor === 'morning' ? morningTime : eveningTime;
                return (
                  <Pressable
                    key={time}
                    onPress={() => {
                      if (pickingTimeFor === 'morning') setMorningTime(time);
                      else if (pickingTimeFor === 'evening') setEveningTime(time);
                      setPickingTimeFor(null);
                    }}
                    style={[styles.timeOption, { backgroundColor: time === current ? theme.colors.bgCardAlt : 'transparent' }]}
                  >
                    <Text style={[theme.type.body, { color: theme.colors.textPrimary }]}>{time}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        </Pressable>
      </Modal>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(20,24,34,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 28,
  },
  card: {
    width: '100%',
    padding: 22,
  },
  rows: {
    gap: 10,
    marginTop: 18,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  rowIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timePill: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
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
  confirmBtn: {
    marginTop: 20,
    borderRadius: 999,
    paddingVertical: 14,
    alignItems: 'center',
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
