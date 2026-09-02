import { useState } from 'react';
import { router } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useSession } from '@/hooks/useSession';
import type { DayRow } from '@/hooks/usePrograms';

/**
 * Discomfort check-in gate for opening roadmap days (restored 2026-09-01;
 * rules tightened 2026-09-02 per explicit request):
 *  - Locked/future days ('locked'/'upcoming') cannot be opened at all.
 *  - ANY openable day (today or past, watched or not) that has no
 *    discomfort log yet shows `PainScaleModal` first; confirming inserts
 *    that day's pain_logs row and then opens the day.
 *  - A day that already has a log opens straight away — the check is
 *    against the DB, so answering from Home's "Bắt đầu" and tapping the
 *    same day on the Roadmap (or vice versa) never asks twice.
 * Pure logging under the calendar-unlock mechanic — completion is still
 * only mark_day_watched. A failed lookup/insert opens the day anyway.
 */
export function useRequestDay() {
  const { session } = useSession();
  const queryClient = useQueryClient();
  const [submitting, setSubmitting] = useState(false);
  const [pending, setPending] = useState<{
    day: DayRow;
    userProgramId: string;
    productId: string;
  } | null>(null);

  function openDay(dayId: number, productId: string) {
    router.push({ pathname: '/day/[dayId]', params: { dayId: String(dayId), productId } });
  }

  async function requestDay(day: DayRow, userProgramId: string, productId: string) {
    if (day.status === 'locked' || day.status === 'upcoming') return;
    if (!userProgramId) {
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
      if (data) {
        openDay(day.id, productId);
        return;
      }
      setPending({ day, userProgramId, productId });
    } catch {
      // A failed lookup must never block the workout itself.
      openDay(day.id, productId);
    }
  }

  async function confirmPain(value: number) {
    if (!pending) return;
    const { day, userProgramId, productId } = pending;
    const userId = session?.user.id;
    if (!userId) return;
    setSubmitting(true);
    try {
      const { error } = await supabase.from('pain_logs').insert({
        user_id: userId,
        user_program_id: userProgramId,
        program_day_id: day.programDayId,
        score: value,
      });
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
