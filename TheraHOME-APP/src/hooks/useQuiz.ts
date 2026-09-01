import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAppStore } from '@/store/useAppStore';
import type { Json } from '@/types/database';

interface QuizContentEntry {
  question: string;
  options: string[];
  /** Legacy field from the right/wrong-quiz era — still stored by admin
   * for old app builds, but surveys ignore it entirely. */
  correctIndex: number;
}

export interface QuizQuestionRow {
  id: string;
  sortOrder: number;
  question: string;
  options: string[];
}

/** Questions for one phase's quiz, localized to the current UI language
 * (falls back to `vi` — mirrors `translate()`'s own fallback shape). Admin
 * authors `content` as `{ vi: {...}, en: {...}, ms: {...} }` per question. */
export function usePhaseQuiz(phaseId: string | undefined) {
  const language = useAppStore((state) => state.language);
  return useQuery({
    queryKey: ['quiz_questions', phaseId, language],
    queryFn: async (): Promise<QuizQuestionRow[]> => {
      const { data, error } = await supabase
        .from('quiz_questions')
        .select('id, sort_order, content')
        .eq('phase_id', phaseId!)
        .order('sort_order');
      if (error) throw error;
      return data.map((row) => {
        const content = row.content as unknown as Record<string, QuizContentEntry>;
        const localized = content[language] ?? content.vi;
        return {
          id: row.id,
          sortOrder: row.sort_order,
          question: localized.question,
          options: localized.options,
        };
      });
    },
    enabled: !!phaseId,
  });
}

export interface QuizAttempt {
  score: number;
  totalQuestions: number;
  completedAt: string;
}

/** This user's latest attempt for a phase's quiz, if any — used both to
 * skip re-taking a finished quiz and to gate the post-quiz promo screen. */
export function useQuizAttempt(userId: string | undefined, phaseId: string | undefined) {
  return useQuery({
    queryKey: ['quiz_attempt', userId, phaseId],
    queryFn: async (): Promise<QuizAttempt | null> => {
      const { data, error } = await supabase
        .from('user_quiz_attempts')
        .select('score, total_questions, completed_at')
        .eq('user_id', userId!)
        .eq('phase_id', phaseId!)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      return { score: data.score, totalQuestions: data.total_questions, completedAt: data.completed_at };
    },
    enabled: !!userId && !!phaseId,
  });
}

/** Batch version of "does this phase's quiz still need taking" for a list of
 * phase ids at once — used by roadmap.tsx to decide which phase should
 * default-expanded (a phase with a still-untaken quiz stays open; once
 * resolved it collapses like any other finished phase). A phase resolves to
 * `true` when it has no quiz at all, or the user already has an attempt. */
export function useQuizResolvedMap(userId: string | undefined, phaseIds: string[]) {
  return useQuery({
    queryKey: ['quiz_resolved_map', userId, phaseIds],
    queryFn: async (): Promise<Map<string, boolean>> => {
      const [{ data: questions, error: qErr }, { data: attempts, error: aErr }] = await Promise.all([
        supabase.from('quiz_questions').select('phase_id').in('phase_id', phaseIds),
        supabase.from('user_quiz_attempts').select('phase_id').eq('user_id', userId!).in('phase_id', phaseIds),
      ]);
      if (qErr) throw qErr;
      if (aErr) throw aErr;
      const hasQuiz = new Set((questions ?? []).map((q) => q.phase_id));
      const attempted = new Set((attempts ?? []).map((a) => a.phase_id));
      const map = new Map<string, boolean>();
      for (const id of phaseIds) map.set(id, !hasQuiz.has(id) || attempted.has(id));
      return map;
    },
    enabled: !!userId && phaseIds.length > 0,
  });
}

/** One recorded survey response: the question and chosen option as the
 * user saw them (their language at the time), keyed by question id. */
export interface QuizAnswerSnapshot {
  question: string;
  answer: string;
  optionIndex: number;
}

export function useSubmitQuizAttempt() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (vars: {
      userId: string;
      userProgramId: string;
      phaseId: string;
      totalQuestions: number;
      answers: Record<string, QuizAnswerSnapshot>;
    }) => {
      const { error } = await supabase.from('user_quiz_attempts').upsert(
        {
          user_id: vars.userId,
          user_program_id: vars.userProgramId,
          phase_id: vars.phaseId,
          // Surveys have no right answers — score is a legacy column kept
          // for old app builds; what matters now is `answers`.
          score: 0,
          total_questions: vars.totalQuestions,
          answers: vars.answers as unknown as Json,
          completed_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,phase_id' },
      );
      if (error) throw error;
    },
    onSuccess: (_data, vars) => {
      void queryClient.invalidateQueries({ queryKey: ['quiz_attempt', vars.userId, vars.phaseId] });
    },
  });
}
