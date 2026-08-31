// Phase 3: real per-day water tracking, replacing the Phase 1 mock store's
// `water`/`setWater`. See CLAUDE.md.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

function todayDateString(): string {
  return new Date().toISOString().slice(0, 10);
}

export function useWaterLog(userId: string | undefined) {
  const today = todayDateString();
  return useQuery({
    queryKey: ['water_logs', userId, today],
    queryFn: async (): Promise<number> => {
      const { data, error } = await supabase
        .from('water_logs')
        .select('cups_logged')
        .eq('user_id', userId!)
        .eq('log_date', today)
        .maybeSingle();
      if (error) throw error;
      return data?.cups_logged ?? 0;
    },
    enabled: !!userId,
  });
}

export function useSetWaterLog(userId: string | undefined) {
  const queryClient = useQueryClient();
  const today = todayDateString();
  const queryKey = ['water_logs', userId, today] as const;

  return useMutation({
    mutationFn: async (cups: number) => {
      const { error } = await supabase
        .from('water_logs')
        .upsert({ user_id: userId!, log_date: today, cups_logged: cups }, { onConflict: 'user_id,log_date' });
      if (error) throw error;
      return cups;
    },
    onMutate: async (cups) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<number>(queryKey);
      queryClient.setQueryData(queryKey, cups);
      return { previous };
    },
    onError: (_err, _cups, context) => {
      if (context?.previous !== undefined) queryClient.setQueryData(queryKey, context.previous);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });
}
