// Wording overrides for the onboarding questionnaire, published from WEB
// Admin (`onboarding_question_texts`; added 2026-09-04).
//
// SAFETY RULE — read before changing anything here. Answers are persisted as
// the option TEXT, and `localizeSavedAnswer` in app/profile/edit.tsx maps a
// saved answer across languages by its POSITION in the option list. So an
// override may only replace WORDS; it must never change how many options a
// question has. Any row whose option count differs from the bundled question
// is ignored outright, which keeps a bad admin edit (or a hand-written SQL
// row) from silently re-mapping existing profiles to a different answer.
import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { onboardingQuestions } from '@/lib/mockData';
import type { Question } from '@/lib/mockData';
import type { AppLanguage } from '@/store/useAppStore';

interface OverrideRow {
  question_key: string;
  language: string;
  title: string;
  subtitle: string | null;
  options: string[];
}

export interface OnboardingContent {
  /** Bundled questions with admin wording applied where it is safe. */
  getQuestions: (language: AppLanguage) => Question[];
}

export function useOnboardingContent(): OnboardingContent {
  const query = useQuery({
    queryKey: ['onboarding_question_texts'],
    queryFn: async (): Promise<OverrideRow[]> => {
      const { data, error } = await supabase
        .from('onboarding_question_texts')
        .select('question_key, language, title, subtitle, options');
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 10 * 60_000,
  });

  const rows = query.data;

  return useMemo(
    () => ({
      getQuestions: (language: AppLanguage): Question[] => {
        const bundled = onboardingQuestions(language);
        if (!rows?.length) return bundled;
        return bundled.map((question) => {
          const override = rows.find((r) => r.question_key === question.key && r.language === language);
          // The count check is the guard that protects saved answers.
          if (!override || override.options.length !== question.options.length) return question;
          return {
            ...question,
            title: override.title?.trim() || question.title,
            subtitle: override.subtitle?.trim() || question.subtitle,
            options: question.options.map((option, index) => override.options[index]?.trim() || option),
          };
        });
      },
    }),
    [rows],
  );
}
