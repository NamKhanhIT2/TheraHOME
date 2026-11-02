// "Tập cùng chuyên viên" — the way in to app/train/[dayId].tsx.
//
// Sits directly beside FormReviewCard, and the pair is deliberate: one asks
// a human and answers in hours, the other answers while you are still
// moving. Same question, two prices, and a customer should be able to see
// both and choose.
//
// It hides itself rather than disappointing anyone: no native module in
// this binary, no published reference for this day, or the feature switched
// off centrally, and there is simply no card.
//
// It is FREE as of 2026-10-27 (owner). It used to open the plan gate for
// anyone without a subscription; the lock is gone here AND in the two
// policies that actually enforced it — `exercise_references` and the
// `exercise-reference` storage bucket — because removing only this one
// would have handed people a screen with no clip to copy.
import React, { useEffect, useRef } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { homeGlassColors, useTheme } from '@/theme';
import { Icon } from '@/components/icons/Icon';
import { useI18n } from '@/lib/i18n';
import { useAppConfig } from '@/hooks/useAppConfig';
import { useDaysWithReference } from '@/hooks/useExerciseReference';
import { isPoseSupported } from '@/lib/pose';
import { MOTION_TRACKING_ENABLED } from '@/lib/features';
import { useEdgeGlowTransition } from '@/store/useEdgeGlowTransition';

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
  // The remote kill switch. Checked here rather than inside the training
  // screen so a flipped switch removes the entrance, not just the room.
  const { get } = useAppConfig();
  const days = useDaysWithReference(userId).data;
  const igniteGlow = useEdgeGlowTransition((state) => state.ignite);
  const launchingRef = useRef(false);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(
    () => () => {
      timersRef.current.forEach(clearTimeout);
      timersRef.current = [];
    },
    [],
  );

  function openLiveTraining() {
    if (launchingRef.current) return;
    launchingRef.current = true;
    igniteGlow();
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    // Give the light enough time to reach the corners before the native push
    // begins. The root-level glow stays mounted above both screens.
    timersRef.current.push(
      setTimeout(() => {
        router.push({
          pathname: '/train/[dayId]',
          params: {
            dayId: String(dayNumber),
            productId: productId ?? '',
            edgeGlow: '1',
          },
        });
      }, 300),
      setTimeout(() => {
        launchingRef.current = false;
      }, 1_200),
    );
  }

  if (!MOTION_TRACKING_ENABLED || !isPoseSupported()) return null;
  if (get('motion_tracking_enabled').trim().toLowerCase() === 'off') return null;
  if (!programDayId || !days?.has(programDayId)) return null;

  return (
    <Pressable
      onPress={openLiveTraining}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: homeGlassColors.surface,
          borderColor: homeGlassColors.hairline,
          borderRadius: theme.radius.lg,
          opacity: pressed ? 0.88 : 1,
          transform: [{ scale: pressed ? 0.988 : 1 }],
        },
      ]}
    >
      <View style={[styles.badge, { backgroundColor: homeGlassColors.surfaceRaised }]}>
        <Icon name="activity" size={19} color={homeGlassColors.tick} />
      </View>
      <View style={styles.text}>
        <Text style={[theme.type.bodyStrong, { color: homeGlassColors.text }]}>{t('dayLiveFormTitle')}</Text>
        <Text style={[theme.type.caption, { color: homeGlassColors.textMuted }]}>
          {t('dayLiveFormBody')}
        </Text>
      </View>
      <Icon name="chevron-right" size={18} color={homeGlassColors.textFaint} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderWidth: 1 },
  badge: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  text: { flex: 1, gap: 2 },
});
