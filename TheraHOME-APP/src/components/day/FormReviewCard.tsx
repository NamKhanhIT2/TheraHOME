// "Tôi tập thế này đúng chưa?"
//
// A fifteen-second clip of the customer doing today's exercise, sent to a
// specialist who writes back. It sits on the day screen rather than in the
// chat because the question belongs to a specific exercise — asked from
// inside a conversation it would arrive with no idea what it is of, which is
// most of the work of answering it.
//
// The clip itself travels as an ordinary chat attachment (see
// hooks/useFormReview), so everything after "send" is the support
// conversation that already works: the push, the unread badge, the reply.
// This card is only the asking, and the waiting.
import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useTheme } from '@/theme';
import { Icon } from '@/components/icons/Icon';
import { useChatThread } from '@/hooks/useChat';
import {
  useFormReviewAllowance,
  useFormReviewForDay,
  useSubmitFormReview,
} from '@/hooks/useFormReview';
import { usePlanGate } from '@/hooks/usePlanGate';
import { useI18n, type TranslationKey } from '@/lib/i18n';

/** Long enough to show a full movement, short enough that nobody films a
 * monologue and short enough to upload on a phone network. Both platforms
 * enforce it in their own camera UI, so it cannot be exceeded. */
// 15 seconds at quality 0.5, not 20 at 0.7 — about 5 MB a clip instead of
// ~12 MB. The monthly budget is denominated in megabytes now
// (form_review_mb_allowance()), so the encode settings decide how many
// clips 200 MB buys: ~40 at these numbers, ~16 at the old ones. Fifteen
// seconds is long enough to see one neck-and-shoulder movement, which is
// what a specialist is grading — this is not a film.
const MAX_SECONDS = 15;

/** The server raises these as Postgres exceptions; the customer should read
 * the reason, not the error code.
 *
 * Returns a translation KEY, not a sentence: this is module scope and has no
 * hook, and the card is read in Vietnamese, English and Malay. Anything
 * unrecognised falls through to a generic line rather than showing raw SQL. */
function explain(message: string): TranslationKey {
  if (message.includes('review_already_pending')) return 'formReviewErrPending';
  if (message.includes('monthly_allowance_reached')) return 'formReviewErrQuota';
  if (message.includes('clip_too_large')) return 'formReviewErrTooLarge';
  if (message.includes('plan_required')) return 'formReviewErrNeedsPlan';
  if (message.includes('attachment_required')) return 'formReviewErrNoFile';
  return 'formReviewErrGeneric';
}

export function FormReviewCard({ userId, userProgramId, programDayId, dayNumber, dayLabel }: {
  userId: string | undefined;
  userProgramId: string | undefined;
  programDayId: string | undefined;
  dayNumber: number | undefined;
  dayLabel?: string | null;
}) {
  const theme = useTheme();
  const threadQuery = useChatThread('human', userId);
  const { allowanceMb, remainingMb, remainingClips, isLoading } = useFormReviewAllowance(userId);
  const askForPlan = usePlanGate();
  const { t } = useI18n();
  const reviewForThisDay = useFormReviewForDay(userId, programDayId);
  const submit = useSubmitFormReview();
  const [busy, setBusy] = useState(false);

  const openChat = useCallback(() => router.push('/chat/human'), []);

  const record = useCallback(async () => {
    if (!userId || !threadQuery.data) return;
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert(
        t('formReviewCameraTitle'),
        t('formReviewCameraBody'),
      );
      return;
    }
    // The system camera has its own review step — "dùng video" or "quay
    // lại" — so nothing is sent that the customer has not already looked at,
    // and this needs no confirmation dialog of its own.
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['videos'],
      videoMaxDuration: MAX_SECONDS,
      quality: 0.5,
    });
    if (result.canceled || !result.assets?.length) return;
    const asset = result.assets[0];

    setBusy(true);
    try {
      await submit.mutateAsync({
        threadId: threadQuery.data,
        userId,
        videoUri: asset.uri,
        mimeType: asset.mimeType ?? 'video/mp4',
        userProgramId,
        programDayId,
        dayNumber,
        dayLabel,
      });
      Alert.alert(
        t('formReviewSentTitle'),
        t('formReviewSentBody'),
        [{ text: t('later') }, { text: t('formReviewOpenChat'), onPress: openChat }],
      );
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      console.warn('form review submit failed:', message);
      Alert.alert(t('formReviewFailedTitle'), t(explain(message)));
    } finally {
      setBusy(false);
    }
  }, [userId, threadQuery.data, submit, userProgramId, programDayId, dayNumber, dayLabel, openChat, t]);

  if (!userId || isLoading) return null;

  // ------------------------------------------------------- already asked
  if (reviewForThisDay) {
    const answered = reviewForThisDay.status === 'reviewed';
    return (
      <Pressable
        onPress={openChat}
        style={[styles.card, {
          backgroundColor: answered ? theme.colors.successTint : theme.colors.bgCardAlt,
          borderColor: answered ? theme.colors.success : theme.colors.borderLight,
        }]}
      >
        <Icon name={answered ? 'check' : 'clock'} size={19}
          color={answered ? theme.colors.success : theme.colors.textSecondary} />
        <View style={styles.text}>
          <Text style={[theme.type.bodyStrong, { color: answered ? theme.colors.success : theme.colors.textPrimary }]}>
            {answered ? t('formReviewReviewed') : t('formReviewWaiting')}
          </Text>
          <Text style={[theme.type.captionSm, { color: theme.colors.textSecondary }]}>
            {answered ? t('formReviewTapToRead') : t('formReviewUsuallyHours')}
          </Text>
        </View>
        <Icon name="chevron-right" size={18} color={theme.colors.textMuted} />
      </Pressable>
    );
  }

  // ------------------------------------------------- no plan: show, explain
  // A customer with no subscription has an allowance of 0, which is NOT the
  // same as having used theirs up — saying "hết dung lượng tháng này" to
  // somebody who never had any is nonsense, and it was on screen until now.
  //
  // The card stays visible and tappable on purpose: seeing what a plan buys
  // is how anybody decides to buy one, and the tap explains itself instead
  // of doing nothing.
  if (allowanceMb <= 0) {
    return (
      <Pressable
        onPress={() => askForPlan('featureFormReview')}
        style={({ pressed }) => [styles.card, {
          backgroundColor: theme.colors.bgCardAlt,
          borderColor: theme.colors.borderLight,
          opacity: pressed ? 0.85 : 1,
        }]}
      >
        <Icon name="crown" size={19} color={theme.colors.primary} />
        <View style={styles.text}>
          <Text style={[theme.type.bodyStrong, { color: theme.colors.textPrimary }]}>
            {t('formReviewTitle')}
          </Text>
          <Text style={[theme.type.captionSm, { color: theme.colors.textSecondary }]}>
            {t('planLockedHint')}
          </Text>
        </View>
        <Icon name="chevron-right" size={18} color={theme.colors.textMuted} />
      </Pressable>
    );
  }

  // ----------------------------------------------- blocked, and say why
  // A disabled button with no reason reads as a broken button. One reason
  // left now: the month's video budget, for somebody who DOES have a plan.
  if (remainingMb <= 0) {
    return (
      <View style={[styles.card, { backgroundColor: theme.colors.bgCardAlt, borderColor: theme.colors.borderLight }]}>
        <Icon name="video-off" size={19} color={theme.colors.textMuted} />
        <View style={styles.text}>
          <Text style={[theme.type.bodyStrong, { color: theme.colors.textPrimary }]}>
            {t('formReviewTitle')}
          </Text>
          <Text style={[theme.type.captionSm, { color: theme.colors.textSecondary }]}>
            {t('formReviewExhausted')}
          </Text>
        </View>
      </View>
    );
  }

  // ------------------------------------------------------------- ask
  return (
    <Pressable
      onPress={busy ? undefined : record}
      disabled={busy || !threadQuery.data}
      style={({ pressed }) => [styles.card, {
        backgroundColor: theme.colors.primaryTint05,
        borderColor: theme.colors.primaryTint10,
        opacity: busy || !threadQuery.data ? 0.6 : pressed ? 0.9 : 1,
      }]}
    >
      {busy ? (
        <ActivityIndicator size="small" color={theme.colors.primary} />
      ) : (
        <Icon name="video" size={19} color={theme.colors.primary} />
      )}
      <View style={styles.text}>
        <Text style={[theme.type.bodyStrong, { color: theme.colors.primaryDark }]}>
          {busy ? t('formReviewSending') : t('formReviewAsk')}
        </Text>
        <Text style={[theme.type.captionSm, { color: theme.colors.textSecondary }]}>
          {busy
            ? t('formReviewKeepOpen')
            : t('formReviewRecordHint', { seconds: MAX_SECONDS, clips: remainingClips })}
        </Text>
      </View>
      {busy ? null : <Icon name="chevron-right" size={18} color={theme.colors.primary} />}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    padding: 14, borderRadius: 14, borderWidth: 1,
  },
  text: { flex: 1, gap: 2 },
});
