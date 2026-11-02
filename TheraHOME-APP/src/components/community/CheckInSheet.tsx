import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { homeGlassColors, useTheme } from '@/theme';
import { Icon } from '@/components/icons/Icon';
import { useI18n } from '@/lib/i18n';
import { hapticConfirm } from '@/lib/haptics';
import type { CheckInMood, DailyCheckIn } from '@/hooks/useCommunity';

const MOODS: { key: CheckInMood; emoji: string; label: 'moodEasy' | 'moodNormal' | 'moodHard' }[] = [
  { key: 'easy', emoji: '😊', label: 'moodEasy' },
  { key: 'normal', emoji: '😐', label: 'moodNormal' },
  { key: 'hard', emoji: '😣', label: 'moodHard' },
];

export interface CheckInSheetProps {
  visible: boolean;
  /** Today's check-in if there already is one — the sheet then opens on what
   * they chose this morning and the button updates it instead of repeating
   * it. */
  existing: DailyCheckIn | null;
  /** The furthest day the roadmap says they have finished, for the progress
   * line. Null while it is still loading or nothing is done yet. */
  dayNumber: number | null;
  submitting: boolean;
  error: string | null;
  onClose: () => void;
  onSubmit: (mood: CheckInMood, share: boolean) => void;
}

/**
 * "Điểm danh hôm nay" — the sheet behind the "+" on the community avatar
 * strip (owner's design, 2026-10-26): how today felt, what the roadmap says
 * they have done, and whether to let the community see it.
 *
 * Sharing is a real consequence (a post others can cheer), so it is an
 * explicit switch that stays off unless they turn it on — except when they
 * already shared today, where the sheet opens on what is already true.
 */
export function CheckInSheet({
  visible,
  existing,
  dayNumber,
  submitting,
  error,
  onClose,
  onSubmit,
}: CheckInSheetProps) {
  const theme = useTheme();
  const { t } = useI18n();
  const [mood, setMood] = useState<CheckInMood>('easy');
  const [share, setShare] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setMood(existing?.mood ?? 'easy');
    setShare(existing?.shared ?? false);
  }, [visible, existing]);

  const day = existing?.dayNumber ?? dayNumber;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable
          onPress={() => undefined}
          style={[styles.sheet, { backgroundColor: homeGlassColors.menu, borderColor: homeGlassColors.hairline }]}
        >
          <View style={[styles.grabber, { backgroundColor: homeGlassColors.hairline }]} />

          <View style={styles.titleRow}>
            <Text style={[theme.type.h2, { color: homeGlassColors.text, flex: 1 }]}>{t('checkInTitle')}</Text>
            {existing ? (
              <View style={[styles.donePill, { backgroundColor: homeGlassColors.surfaceRaised }]}>
                <Icon name="check" size={13} color={homeGlassColors.tick} strokeWidth={3} />
                <Text style={[theme.type.captionSm, { color: homeGlassColors.textMuted }]}>{t('checkedInToday')}</Text>
              </View>
            ) : null}
          </View>

          <Text style={[theme.type.caption, styles.sectionLabel, { color: homeGlassColors.textMuted }]}>
            {t('checkInFeeling')}
          </Text>
          <View style={styles.moods}>
            {MOODS.map((item) => {
              const selected = item.key === mood;
              return (
                <Pressable
                  key={item.key}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  onPress={() => { setMood(item.key); hapticConfirm(); }}
                  style={({ pressed }) => [
                    styles.mood,
                    {
                      backgroundColor: selected ? homeGlassColors.purpleSoft : homeGlassColors.surfaceRaised,
                      borderColor: selected ? homeGlassColors.purple : 'transparent',
                    },
                    pressed ? { opacity: 0.7 } : null,
                  ]}
                >
                  <Text style={styles.moodEmoji}>{item.emoji}</Text>
                  <Text
                    numberOfLines={1}
                    style={[theme.type.captionSm, { color: selected ? homeGlassColors.text : homeGlassColors.textMuted }]}
                  >
                    {t(item.label)}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Text style={[theme.type.caption, styles.sectionLabel, { color: homeGlassColors.textMuted }]}>
            {t('checkInProgress')}
          </Text>
          <View style={[styles.progress, { backgroundColor: homeGlassColors.surfaceRaised }]}>
            <Icon name="calendar" size={18} color={homeGlassColors.purple} />
            <Text style={[theme.type.bodyStrong, { color: homeGlassColors.text, flex: 1 }]}>
              {day != null ? t('checkInDoneDay', { day }) : t('checkInNoDay')}
            </Text>
          </View>

          <Pressable
            accessibilityRole="switch"
            accessibilityState={{ checked: share }}
            onPress={() => setShare((on) => !on)}
            style={styles.shareRow}
          >
            <View style={styles.shareText}>
              <Text style={[theme.type.bodyStrong, { color: homeGlassColors.text }]}>{t('checkInShare')}</Text>
              <Text style={[theme.type.captionSm, { color: homeGlassColors.textFaint, marginTop: 2 }]}>
                {t('checkInShareHint')}
              </Text>
            </View>
            <Switch
              value={share}
              onValueChange={setShare}
              trackColor={{ false: homeGlassColors.surfaceRaised, true: homeGlassColors.purpleStrong }}
              thumbColor="#FFFFFF"
            />
          </Pressable>

          {error ? (
            <Text style={[theme.type.caption, { color: homeGlassColors.dotMissed, marginTop: 4 }]}>{error}</Text>
          ) : null}

          <Pressable
            accessibilityRole="button"
            disabled={submitting}
            onPress={() => onSubmit(mood, share)}
            style={({ pressed }) => [
              styles.submit,
              { backgroundColor: homeGlassColors.purpleStrong, opacity: submitting ? 0.6 : pressed ? 0.85 : 1 },
            ]}
          >
            {submitting ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.submitLabel}>{existing ? t('checkInUpdate') : t('checkInAction')}</Text>
            )}
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(8,6,16,0.6)',
  },
  sheet: {
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    borderWidth: 1,
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 34,
  },
  grabber: {
    alignSelf: 'center',
    width: 38,
    height: 4,
    borderRadius: 2,
    marginBottom: 16,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  donePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  sectionLabel: {
    marginTop: 18,
    marginBottom: 8,
  },
  moods: {
    flexDirection: 'row',
    gap: 10,
  },
  mood: {
    flex: 1,
    borderRadius: 16,
    borderWidth: 1.5,
    paddingVertical: 14,
    alignItems: 'center',
    gap: 4,
  },
  moodEmoji: {
    fontSize: 26,
    lineHeight: 32,
  },
  progress: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  shareRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginTop: 18,
    minHeight: 48,
  },
  shareText: {
    flex: 1,
    minWidth: 0,
  },
  submit: {
    minHeight: 52,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 18,
  },
  submitLabel: {
    color: '#FFFFFF',
    fontSize: 16,
    lineHeight: 21,
    fontWeight: '700',
  },
});
