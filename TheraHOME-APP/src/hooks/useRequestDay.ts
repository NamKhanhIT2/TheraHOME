import { useState } from 'react';
import { router } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useSession } from '@/hooks/useSession';
import type { DayRow } from '@/hooks/usePrograms';

/**
 * Discomfort check-in before opening TODAY's day — restored 2026-09-01 per
 * explicit request (it was removed with the calendar-unlock mechanic, which
 * left the progress chart with no new-entry point). Opening a `current` day
 * shows `PainScaleModal` first; confirming writes/updates that day's
 * pain_logs row and then opens the day. Unlike the old complete_day era
 * this is PURE LOGGING — it never completes or unlocks anything (watching
 * the video does, via mark_day_watched). All copy uses "khó chịu"/
 * discomfort wording (App Store compliance), not medical terms.
 */
export function useRequestDay() {
  const { session } = useSession();
  const queryClient = useQueryClient();
  const [submitting, setSubmitting] = useState(false);
  const [pending, setPending] = useState<{
    day: DayRow;
    userProgramId: string;
    productId: string;
    existingLogId?: string;
  } | null>(null);

  function openDay(dayId: number, productId: string) {
    router.push({ pathname: '/day/[dayId]', params: { dayId: String(dayId), productId } });
  }

  async function requestDay(day: DayRow, userProgramId: string, productId: string) {
    if (day.status !== 'current' || !userProgramId) {
      openDay(day.id, productId);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('pain_logs')
        .select('id')
        .eq('user_program_id', userProgramId)
        .eq('program_day_id', day.programDayId)
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      // Always show the check-in before entering today's workout. When a
      // previous value exists, confirmation updates it instead of creating
      // a duplicate log for the same program day.
      setPending({ day, userProgramId, productId, existingLogId: data?.id });
    } catch {
      // A failed lookup must never block the workout itself.
      openDay(day.id, productId);
    }
  }

  async function confirmPain(value: number) {
    if (!pending) return;
    const { day, userProgramId, productId, existingLogId } = pending;
    const userId = session?.user.id;
    if (!userId) return;
    setSubmitting(true);
    try {
      const payload = {
        user_id: userId,
        user_program_id: userProgramId,
        program_day_id: day.programDayId,
        score: value,
      };
      const { error } = existingLogId
        ? await supabase.from('pain_logs').update({ score: value }).eq('id', existingLogId)
        : await supabase.from('pain_logs').insert(payload);
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ['pain_logs', userProgramId] });
      openDay(day.id, productId);
    } catch {
      // Logging failed (offline etc.) — still open the day rather than
      // trapping the user in the modal.
      openDay(day.id, productId);
    } finally {
      setSubmitting(false);
      setPending(null);
    }
  }

  function cancelPain() {
    setPending(null);
  }

  return {
    pendingDay: pending?.day.id ?? null,
    requestDay,
    confirmPain,
    cancelPain,
    isSubmitting: submitting,
  };
}
