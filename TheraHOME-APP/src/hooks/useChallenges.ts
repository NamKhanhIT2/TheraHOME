// Phase 3 of the Community expansion: challenges. Completion is
// self-declared once user_programs.streak reaches the challenge's
// target_streak_days — enforced server-side too (see the challenge
// completion RLS policy in the community_challenges migration), not just
// trusted client-side.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

export interface ActiveChallenge {
  id: string;
  title: string;
  description: string | null;
  icon: string;
  targetStreakDays: number;
}

export function useActiveChallenge() {
  return useQuery({
    queryKey: ['active_challenge'],
    queryFn: async (): Promise<ActiveChallenge | null> => {
      const { data, error } = await supabase
        .from('challenges')
        .select('id, title, description, icon, target_streak_days')
        .eq('active', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      return {
        id: data.id,
        title: data.title,
        description: data.description,
        icon: data.icon,
        targetStreakDays: data.target_streak_days,
      };
    },
  });
}

export function useChallengeParticipantCount(challengeId: string | undefined) {
  return useQuery({
    queryKey: ['challenge_participant_count', challengeId],
    queryFn: async (): Promise<number> => {
      const { count, error } = await supabase
        .from('challenge_participants')
        .select('id', { count: 'exact', head: true })
        .eq('challenge_id', challengeId!);
      if (error) throw error;
      return count ?? 0;
    },
    enabled: !!challengeId,
  });
}

export interface MyParticipation {
  joined: boolean;
  completedAt: string | null;
}

export function useMyChallengeParticipation(challengeId: string | undefined, userId: string | undefined) {
  return useQuery({
    queryKey: ['my_challenge_participation', challengeId, userId],
    queryFn: async (): Promise<MyParticipation> => {
      const { data, error } = await supabase
        .from('challenge_participants')
        .select('completed_at')
        .eq('challenge_id', challengeId!)
        .eq('user_id', userId!)
        .maybeSingle();
      if (error) throw error;
      return { joined: !!data, completedAt: data?.completed_at ?? null };
    },
    enabled: !!challengeId && !!userId,
  });
}

export function useJoinChallenge(userId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (challengeId: string) => {
      const { error } = await supabase.from('challenge_participants').insert({ challenge_id: challengeId, user_id: userId! });
      if (error) throw error;
    },
    onSuccess: (_data, challengeId) => {
      queryClient.invalidateQueries({ queryKey: ['my_challenge_participation', challengeId, userId] });
      queryClient.invalidateQueries({ queryKey: ['challenge_participant_count', challengeId] });
    },
  });
}

export function useCompleteChallenge(userId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (challengeId: string) => {
      const { error } = await supabase
        .from('challenge_participants')
        .update({ completed_at: new Date().toISOString() })
        .eq('challenge_id', challengeId)
        .eq('user_id', userId!);
      if (error) throw error;
    },
    onSuccess: (_data, challengeId) => {
      queryClient.invalidateQueries({ queryKey: ['my_challenge_participation', challengeId, userId] });
    },
  });
}
