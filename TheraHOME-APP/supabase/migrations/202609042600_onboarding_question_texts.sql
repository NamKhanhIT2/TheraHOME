-- Wording-only overrides for the onboarding questionnaire.
--
-- The app stores each answer as the OPTION TEXT in whatever language the
-- user picked, and `localizeSavedAnswer` translates an existing profile by
-- finding that string's POSITION in one language's option list and reading
-- the same position in another. So option ORDER and COUNT are load-bearing
-- keys: adding, removing or reordering an option would silently re-map
-- every existing profile's saved answer to a different one.
--
-- Therefore admin may only rewrite the WORDS: title, subtitle and the text
-- of each option, with the option COUNT fixed. `question_key` is fixed too
-- (it drives the personalization). The app additionally refuses any
-- override whose option count differs from the bundled question, so even a
-- direct SQL edit cannot corrupt the mapping.
create table if not exists public.onboarding_question_texts (
  question_key text not null,
  language text not null check (language in ('vi', 'en', 'ms')),
  title text not null,
  subtitle text,
  options text[] not null check (cardinality(options) between 2 and 8),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id),
  primary key (question_key, language)
);

alter table public.onboarding_question_texts enable row level security;

-- Onboarding runs BEFORE the contact-claim gate, and parts of it are shown
-- pre-auth, so anon must be able to read the wording.
create policy "anyone reads onboarding_question_texts" on public.onboarding_question_texts
  for select to authenticated, anon using (true);

create policy "web staff writes onboarding_question_texts" on public.onboarding_question_texts
  for all to authenticated
  using ('admin' = any(public.current_web_roles()) or 'cskh' = any(public.current_web_roles()))
  with check ('admin' = any(public.current_web_roles()) or 'cskh' = any(public.current_web_roles()));
