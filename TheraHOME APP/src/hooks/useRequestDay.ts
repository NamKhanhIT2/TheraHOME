import { useState } from 'react';
import { router } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useSession } from '@/hooks/useSession';
import type { DayRow } from '@/hooks/usePrograms';

/**
 * Mirrors `app.jsx`'s `requestDay` / `confirmPain` / `cancelPain` trio:
 * opening a day that is `current` shows the pain-scale modal first (logging
 * via the real `complete_day` RPC — see `usePrograms.ts` — which also flips
 * that day's status to `done` and unlocks the next one); anything else
 * (`done`/`locked`) opens the day detail directly.
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

    const { data, error } = await supabase
      .from('pain_logs')
      .select('id')
      .eq('user_program_id', userProgramId)
      .eq('program_day_id', day.programDayId)
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    // Always show the check-in before entering today's workout. When a
    // previous value exists, confirmation updates it instead of creating a
    // duplicate pain log for the same program day.
    setPending({ day, userProgramId, productId, existingLogId: data?.id });
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
      queryClient.setQueryData<number[]>(['pain_logs', userProgramId], (current = []) =>
        existingLogId ? [...current.slice(0, -1), value] : [...current, value],
      );
      queryClient.invalidateQueries({ queryKey: ['pain_logs', userProgramId] });
      queryClient.invalidateQueries({ queryKey: ['pain_log', userProgramId, day.programDayId] });
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
