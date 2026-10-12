// Tells the specialist what they are looking at, and lets them close it off.
//
// Without this the clip is just a video in a conversation: no indication of
// which exercise it is of, and nothing anywhere that says whether it has
// been dealt with. Both matter. The first is most of the work of answering
// it; the second is what stops one sitting unanswered for a week because
// everyone assumed somebody else had replied.
//
// Deliberately in the thread rather than in a queue screen of its own. The
// work happens here — the specialist watches the clip and types the answer
// in this conversation — so the button that says "done" belongs here too,
// where it cannot be ticked by someone who has not actually replied.
import React from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '@/theme';
import { Icon } from '@/components/icons/Icon';
import { useCompleteFormReview, usePendingFormReviewForThread } from '@/hooks/useFormReview';

export function FormReviewBanner({ threadId, enabled }: {
  threadId: string | undefined;
  enabled: boolean;
}) {
  const theme = useTheme();
  const pending = usePendingFormReviewForThread(threadId, enabled);
  const complete = useCompleteFormReview();

  if (!pending) return null;

  const waitedHours = Math.floor((Date.now() - new Date(pending.createdAt).getTime()) / 3_600_000);

  return (
    <View style={[styles.wrap, { backgroundColor: theme.colors.primaryTint05, borderBottomColor: theme.colors.primaryTint10 }]}>
      <Icon name="video" size={19} color={theme.colors.primary} />
      <View style={styles.text}>
        <Text style={[theme.type.bodyStrong, { color: theme.colors.primaryDark }]}>
          Khách gửi video bài tập{pending.dayNumber ? ` · Ngày ${pending.dayNumber}` : ''}
        </Text>
        <Text style={[theme.type.captionSm, { color: theme.colors.textSecondary }]}>
          {pending.dayLabel ? `${pending.dayLabel} · ` : ''}
          {waitedHours < 1 ? 'vừa gửi' : `đã chờ ${waitedHours} giờ`}
        </Text>
      </View>
      <Pressable
        accessibilityRole="button"
        disabled={complete.isPending}
        onPress={() => {
          // Confirmed, because ticking it is what takes the clip off the
          // queue — and a mis-tap there is invisible until the customer
          // complains that nobody answered.
          Alert.alert(
            'Đã chấm xong?',
            'Đánh dấu là đã nhận xét video này. Hãy chắc chắn bạn đã trả lời khách trong khung chat.',
            [
              { text: 'Chưa', style: 'cancel' },
              {
                text: 'Đã chấm',
                onPress: () => {
                  complete.mutate({ reviewId: pending.id }, {
                    onError: (error: unknown) => {
                      const message = error instanceof Error ? error.message : String(error);
                      console.warn('complete_form_review failed:', message);
                      Alert.alert('Không đánh dấu được', 'Thử lại giúp em nhé.');
                    },
                  });
                },
              },
            ],
          );
        }}
        style={({ pressed }) => [styles.done, {
          backgroundColor: theme.colors.primary,
          opacity: complete.isPending ? 0.6 : pressed ? 0.85 : 1,
        }]}
      >
        {complete.isPending
          ? <ActivityIndicator size="small" color="#fff" />
          : <Text style={[theme.type.captionSm, styles.doneText]}>Đã chấm</Text>}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1,
  },
  text: { flex: 1, gap: 1 },
  done: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999 },
  doneText: { color: '#fff', fontWeight: '700' },
});
