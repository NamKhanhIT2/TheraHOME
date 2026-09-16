-- Challenges had ONE title and ONE description and no language dimension at
-- all, while every other admin-authored surface (posts, phases, FAQ, store
-- items, app_config) carries per-market copy. The community challenge banner
-- therefore rendered whatever the admin typed — Vietnamese — to English and
-- Malay readers, with no fallback logic possible because no variant existed
-- (audit 2026-09-16).
--
-- Additive and nullable on purpose: the columns are invisible to the builds
-- already in the stores (iOS 21 is under review and selects neither), and a
-- challenge with the new columns empty behaves exactly as it does today.
alter table public.challenges
  add column if not exists title_en text,
  add column if not exists title_ms text,
  add column if not exists description_en text,
  add column if not exists description_ms text;

comment on column public.challenges.title_en is
  'English title. NULL falls back to the Vietnamese `title`, same rule as community_posts.title_us.';
comment on column public.challenges.title_ms is
  'Malay title. NULL falls back to the Vietnamese `title`.';
comment on column public.challenges.description_en is
  'English description. NULL falls back to the Vietnamese `description`.';
comment on column public.challenges.description_ms is
  'Malay description. NULL falls back to the Vietnamese `description`.';
