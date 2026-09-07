-- profiles.language still only allowed 'vi' and 'en' — the Malaysia market was
-- added to legal_documents, onboarding_question_texts and
-- system_notification_templates but this table was missed.
--
-- Two things were broken by it, both silently. Picking "Bahasa Melayu" in
-- Account settings wrote language='ms', hit this constraint, and the screen
-- rolled the choice back with a generic error — nobody could ever save Malay.
-- And admin-manage-account, which since 2026-09-06 derives language from the
-- market an Admin picks, would fail outright when creating a Malaysia account.
--
-- The app never looked broken because the language also lives in the device
-- store and is derived from profiles.country, so only *persisting* the choice
-- failed.
alter table public.profiles drop constraint if exists profiles_language_check;
alter table public.profiles add constraint profiles_language_check
  check (language = any (array['vi'::text, 'en'::text, 'ms'::text]));
