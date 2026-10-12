// "Tôi tập thế này đúng chưa?"
//
// The customer records a short clip of themselves doing one day's exercise
// and a specialist writes back. The question is the one nobody doing rehab
// at home can answer alone, and the one no amount of software answers — it
// needs a person who knows what the movement should look like.
//
// ALMOST NOTHING NEW TRAVELS HERE. The clip is an ordinary attachment in the
// customer's existing support thread, so the upload, the signed URL, the
// push, the unread badge, the reply and the whole staff conversation screen
// are the ones that already work. What this file adds is the two things a
// chat message cannot carry: WHICH exercise the clip is of, and whether
// anyone has dealt with it yet.
//
// The allowance lives on the server (`form_review_monthly_allowance`) and is
// read from there rather than hardcoded, so what the customer is told and
// what the server enforces cannot drift apart. It is also the lever a paid
// tier will pull.
import { useCallback } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { sendChatMessageRequest } from '@/hooks/useChat';
import { useRealtimeSync } from '@/hooks/useRealtimeSync';

export type FormReviewStatus = 'pending' | 'reviewed' | 'cancelled';

export interface FormReview {
  id: string;
  status: FormReviewStatus;
  dayNumber: number | null;
  dayLabel: string | null;
  programDayId: string | null;
  threadId: string;
  messageId: string;
  createdAt: string;
  reviewedAt: string | null;
}

function toFormReview(row: {
  id: string; status: string; day_number: number | null; day_label: string | null;
  program_day_id: string | null; thread_id: string; message_id: string;
  created_at: string; reviewed_at: string | null;
}): FormReview {
  return {
    id: row.id,
    status: row.status as FormReviewStatus,
    dayNumber: row.day_number,
    dayLabel: row.day_label,
    programDayId: row.program_day_id,
    threadId: row.thread_id,
    messageId: row.message_id,
    createdAt: row.created_at,
    reviewedAt: row.reviewed_at,
  };
}

const SELECT = 'id, status, day_number, day_label, program_day_id, thread_id, message_id, created_at, reviewed_at';

/** Everything this customer has ever sent, newest first. Small by
 * construction — the allowance sees to that — so there is no pagination. */
export function useMyFormReviews(userId: string | undefined) {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ['form_reviews', userId],
    queryFn: async (): Promise<FormReview[]> => {
      const { data, error } = await supabase
        .from('form_reviews')
        .select(SELECT)
        .eq('user_id', userId!)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []).map(toFormReview);
    },
    enabled: !!userId,
  });
  // A specialist marking a clip reviewed has to reach the customer's screen
  // without them pulling to refresh — the whole point of the feature is the
  // answer coming back.
  useRealtimeSync({
    enabled: !!userId,
    channelName: `form_reviews_${userId}`,
    bind: (channel) =>
      channel.on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'form_reviews', filter: `user_id=eq.${userId}` },
        () => queryClient.invalidateQueries({ queryKey: ['form_reviews', userId] }),
      ),
    onSync: () => queryClient.invalidateQueries({ queryKey: ['form_reviews', userId] }),
  });
  return query;
}

/** How many are left this month, read from the server's own number. */
export function useFormReviewAllowance(userId: string | undefined) {
  const reviews = useMyFormReviews(userId);
  const allowanceQuery = useQuery({
    queryKey: ['form_review_allowance'],
    queryFn: async (): Promise<number> => {
      const { data, error } = await supabase.rpc('form_review_monthly_allowance');
      if (error) throw error;
      return typeof data === 'number' ? data : 0;
    },
    staleTime: 1000 * 60 * 60,
  });

  const allowance = allowanceQuery.data ?? 0;
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);
  const rows = reviews.data ?? [];
  const usedThisMonth = rows.filter(
    (r) => r.status !== 'cancelled' && new Date(r.createdAt) >= startOfMonth,
  ).length;
  const pending = rows.find((r) => r.status === 'pending') ?? null;

  return {
    allowance,
    usedThisMonth,
    remaining: Math.max(0, allowance - usedThisMonth),
    /** At most one may be waiting at a time — a queue one person can flood is
     * a queue that starves everyone else. */
    pending,
    isLoading: reviews.isPending || allowanceQuery.isPending,
  };
}

/** The review attached to one specific day, if any. Drives the card on the
 * day screen: ask, waiting, or answered. */
export function useFormReviewForDay(userId: string | undefined, programDayId: string | undefined) {
  const { data } = useMyFormReviews(userId);
  return (data ?? []).find((r) => r.programDayId === programDayId && r.status !== 'cancelled') ?? null;
}

export interface SubmitFormReviewInput {
  threadId: string;
  userId: string;
  videoUri: string;
  mimeType?: string | null;
  userProgramId?: string | null;
  programDayId?: string | null;
  dayNumber?: number | null;
  dayLabel?: string | null;
}

/**
 * Uploads the clip, posts it into the support thread, then files the review.
 *
 * In that order, and deliberately not in a transaction, because the three
 * steps fail differently. If the upload or the message fails, nothing has
 * happened and the customer retries. If the REVIEW fails — over the
 * allowance, say — the clip is already in the chat where a specialist can
 * see it and the customer can see they sent it; the worst case is a video in
 * a conversation, which is a perfectly ordinary thing for a chat to contain.
 * The alternative, deleting a clip somebody just recorded because a counter
 * said no, is worse.
 */
export function useSubmitFormReview() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: SubmitFormReviewInput): Promise<FormReview> => {
      const messageId = await sendChatMessageRequest({
        threadId: input.threadId,
        userId: input.userId,
        kind: 'human',
        senderType: 'user',
        input: {
          // The caption is what a specialist sees in the conversation list
          // and in the push, so it says what the clip is before anyone opens
          // it.
          body: input.dayNumber
            ? `Nhờ chuyên viên xem giúp em bài tập Ngày ${input.dayNumber}`
            : 'Nhờ chuyên viên xem giúp em bài tập này',
          attachmentLocalUri: input.videoUri,
          attachmentMimeType: input.mimeType ?? 'video/mp4',
        },
      });

      const { data, error } = await supabase.rpc('request_form_review', {
        p_thread_id: input.threadId,
        p_message_id: messageId,
        p_user_program_id: input.userProgramId ?? undefined,
        p_program_day_id: input.programDayId ?? undefined,
        p_day_number: input.dayNumber ?? undefined,
        p_day_label: input.dayLabel ?? undefined,
      });
      if (error) throw error;
      return toFormReview(data as Parameters<typeof toFormReview>[0]);
    },
    onSuccess: (_review, input) => {
      queryClient.invalidateQueries({ queryKey: ['form_reviews', input.userId] });
      queryClient.invalidateQueries({ queryKey: ['chat_messages', input.threadId] });
    },
  });
}

// ------------------------------------------------------------------ staff

/** Clips still waiting on somebody, oldest first — the order they should be
 * answered in. */
export function usePendingFormReviews(enabled: boolean) {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ['form_reviews_pending'],
    queryFn: async (): Promise<(FormReview & { userId: string })[]> => {
      const { data, error } = await supabase
        .from('form_reviews')
        .select(`${SELECT}, user_id`)
        .eq('status', 'pending')
        .order('created_at', { ascending: true });
      if (error) throw error;
      return (data ?? []).map((row) => ({ ...toFormReview(row), userId: row.user_id }));
    },
    enabled,
  });
  useRealtimeSync({
    enabled,
    channelName: 'form_reviews_pending',
    bind: (channel) =>
      channel.on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'form_reviews' },
        () => queryClient.invalidateQueries({ queryKey: ['form_reviews_pending'] }),
      ),
    onSync: () => queryClient.invalidateQueries({ queryKey: ['form_reviews_pending'] }),
  });
  return query;
}

/** The pending review for one thread, so the specialist answering a
 * conversation can see what they are answering and close it off. */
export function usePendingFormReviewForThread(threadId: string | undefined, enabled: boolean) {
  const { data } = usePendingFormReviews(enabled && !!threadId);
  return (data ?? []).find((r) => r.threadId === threadId) ?? null;
}

export function useCompleteFormReview() {
  const queryClient = useQueryClient();
  const complete = useCallback(async (reviewId: string, replyMessageId?: string) => {
    const { error } = await supabase.rpc('complete_form_review', {
      p_review_id: reviewId,
      p_reply_message_id: replyMessageId,
    });
    if (error) throw error;
  }, []);
  return useMutation({
    mutationFn: ({ reviewId, replyMessageId }: { reviewId: string; replyMessageId?: string }) =>
      complete(reviewId, replyMessageId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['form_reviews_pending'] });
    },
  });
}
