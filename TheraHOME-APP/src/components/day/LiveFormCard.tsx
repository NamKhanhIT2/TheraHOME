// "Tập cùng chuyên viên" — the way in to app/train/[dayId].tsx.
//
// Sits directly beside FormReviewCard, and the pair is deliberate: one asks
// a human and answers in hours, the other answers while you are still
// moving. Same question, two prices, and a customer should be able to see
// both and choose.
//
// It hides itself rather than disappointing anyone: no native module in
// this binary, no published reference for this day, or the feature switched
// off centrally, and there is simply no card. What it does NOT hide from is
// someone without a plan — that is exactly who it is for.
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useTheme } from '@/theme';
import { Icon } from '@/components/icons/Icon';
import { useI18n } from '@/lib/i18n';
import { usePaidAccess } from '@/hooks/useSubscription';
import { useAppConfig } from '@/hooks/useAppConfig';
import { useDaysWithReference } from '@/hooks/useExerciseReference';
import { usePlanGate } from '@/hooks/usePlanGate';
import { isPoseSupported } from '@/lib/pose';
import { MOTION_TRACKING_ENABLED } from '@/lib/features';

export interface LiveFormCardProps {
  userId: string | undefined;
  productId: string | undefined;
  /** The catalogue day number, for the route. */
  dayNumber: number;
  /** The row id, which is what a reference is attached to. */
  programDayId: string | undefined;
}

export function LiveFormCard({ userId, productId, dayNumber, programDayId }: LiveFormCardProps) {
  const theme = useTheme();
  const { t } = useI18n();
  const askForPlan = usePlanGate();
  const paid = usePaidAccess(userId).data === true;
  // The remote kill switch. Checked here rather than inside the training
  // screen so a flipped switch removes the entrance, not just the room.
  const { get } = useAppConfig();
  const days = useDaysWithReference(userId).data;

  if (!MOTION_TRACKING_ENABLED || !isPoseSupported()) return null;
  if (get('motion_tracking_enabled').trim().toLowerCase() === 'off') return null;
  if (!programDayId || !days?.has(programDayId)) return null;

  // Paid ACCESS, not a purchased plan: App Review buys nothing and must
  // still be able to open this.
  const locked = !paid;

  return (
    <Pressable
      onPress={() => {
        if (locked) {
          askForPlan('featureMotionTracking');
          return;
        }
        router.push({ pathname: '/train/[dayId]', params: { dayId: String(dayNumber), productId: productId ?? '' } });
      }}
      style={[
        styles.card,
        {
          backgroundColor: theme.colors.bgCardAlt,
          borderColor: theme.colors.borderLight,
          borderRadius: theme.radius.lg,
        },
      ]}
    >
      <View style={[styles.badge, { backgroundColor: theme.colors.primaryTint10 }]}>
        <Icon name={locked ? 'crown' : 'activity'} size={19} color={theme.colors.primary} />
      </View>
      <View style={styles.text}>
        <Text style={[theme.type.bodyStrong, { color: theme.colors.textPrimary }]}>{t('dayLiveFormTitle')}</Text>
        <Text style={[theme.type.caption, { color: theme.colors.textSecondary }]}>
          {locked ? t('dayLiveFormLocked') : t('dayLiveFormBody')}
        </Text>
      </View>
      <Icon name="chevron-right" size={18} color={theme.colors.textMuted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderWidth: 1 },
  badge: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  text: { flex: 1, gap: 2 },
});
