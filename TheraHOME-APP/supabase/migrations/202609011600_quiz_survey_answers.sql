-- Phase quizzes become surveys/assessments (2026-09-01, per explicit
-- request): no right/wrong answers, no score shown. The app now records
-- WHAT the user answered instead — `answers` holds a per-question snapshot
-- `{ [question_id]: { question, answer, optionIndex } }` in the language
-- the user answered in. `score`/`total_questions` stay for old app builds
-- (which still compute a score); new builds write score = 0.

alter table public.user_quiz_attempts
  add column if not exists answers jsonb not null default '{}'::jsonb;
