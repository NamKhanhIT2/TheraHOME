-- Mirror of the `profile_country_market` migration applied via MCP on
-- 2026-09-03 (the repo copy could not be written at the time). Persists the
-- onboarding country choice so per-market content (store, program video
-- links, product names, official posts) can key off the SAVED country
-- instead of being inferred from the UI language.
alter table public.profiles
  add column if not exists country text
  check (country is null or country in ('VN', 'US', 'MALAY'));

-- Backfill existing confirmed users from their language — the best signal
-- available before the country column existed.
update public.profiles
set country = case language when 'en' then 'US' when 'ms' then 'MALAY' else 'VN' end
where country is null and country_confirmed = true;
