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

/** Long enough to show a full movement, short enough that nobody films a
 * monologue and short enough to upload on a phone network. Both platforms
 * enforce it in their own camera UI, so it cannot be exceeded. */
const MAX_SECONDS = 20;

/** The server raises these as Postgres exceptions; the customer should read
 * the reason, not the error code. Anything unrecognised falls through to a
 * generic line rather than showing raw SQL. */
function explain(message: string): string {
  if (message.includes('review_already_pending')) {
    return 'Bạn đang có một video chờ chuyên viên xem. Đợi nhận xét rồi gửi tiếp nhé.';
  }
  if (message.includes('monthly_allowance_reached')) {
    return 'Bạn đã dùng hết lượt chấm bài tập của tháng này.';
  }
  if (message.includes('attachment_required')) return 'Video chưa gửi được, bạn thử quay lại nhé.';
  return 'Chưa gửi được video. Kiểm tra kết nối mạng rồi thử lại giúp em.';
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
  const { remaining, pending, isLoading } = useFormReviewAllowance(userId);
  const reviewForThisDay = useFormReviewForDay(userId, programDayId);
  const submit = useSubmitFormReview();
  const [busy, setBusy] = useState(false);

  const openChat = useCallback(() => router.push('/chat/human'), []);

  const record = useCallback(async () => {
    if (!userId || !threadQuery.data) return;
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert(
        'Cần quyền camera',
        'Để quay video bài tập, bạn bật quyền camera cho TheraHOME trong Cài đặt nhé.',
      );
      return;
    }
    // The system camera has its own review step — "dùng video" or "quay
    // lại" — so nothing is sent that the customer has not already looked at,
    // and this needs no confirmation dialog of its own.
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['videos'],
      videoMaxDuration: MAX_SECONDS,
      quality: 0.7,
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
        'Đã gửi cho chuyên viên',
        'Chuyên viên sẽ xem và nhận xét trong phần Chat với chuyên gia.',
        [{ text: 'Để sau' }, { text: 'Mở chat', onPress: openChat }],
      );
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      console.warn('form review submit failed:', message);
      Alert.alert('Chưa gửi được', explain(message));
    } finally {
      setBusy(false);
    }
  }, [userId, threadQuery.data, submit, userProgramId, programDayId, dayNumber, dayLabel, openChat]);

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
            {answered ? 'Chuyên viên đã nhận xét' : 'Đang chờ chuyên viên xem'}
          </Text>
          <Text style={[theme.type.captionSm, { color: theme.colors.textSecondary }]}>
            {answered ? 'Chạm để đọc nhận xét' : 'Thường trong vài giờ làm việc'}
          </Text>
        </View>
        <Icon name="chevron-right" size={18} color={theme.colors.textMuted} />
      </Pressable>
    );
  }

  // ----------------------------------------------- blocked, and say why
  // A disabled button with no reason reads as a broken button.
  const blocked = pending ? 'pending' : remaining <= 0 ? 'allowance' : null;
  if (blocked) {
    return (
      <View style={[styles.card, { backgroundColor: theme.colors.bgCardAlt, borderColor: theme.colors.borderLight }]}>
        <Icon name="video-off" size={19} color={theme.colors.textMuted} />
        <View style={styles.text}>
          <Text style={[theme.type.bodyStrong, { color: theme.colors.textPrimary }]}>
            Chấm bài tập qua video
          </Text>
          <Text style={[theme.type.captionSm, { color: theme.colors.textSecondary }]}>
            {blocked === 'pending'
              ? `Bạn đang có video Ngày ${pending?.dayNumber ?? ''} chờ nhận xét.`
              : 'Hết lượt tháng này. Lượt mới có vào đầu tháng sau.'}
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
          {busy ? 'Đang gửi video…' : 'Nhờ chuyên viên chấm bài tập'}
        </Text>
        <Text style={[theme.type.captionSm, { color: theme.colors.textSecondary }]}>
          {busy
            ? 'Giữ ứng dụng mở tới khi gửi xong'
            : `Quay ${MAX_SECONDS} giây bạn đang tập · còn ${remaining} lượt tháng này`}
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
