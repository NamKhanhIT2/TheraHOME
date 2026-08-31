-- Admin-editable content for the full-screen phase paywall (mobile
-- app/paywall/[phaseId].tsx). All nullable — mobile falls back to i18n
-- defaults per field when unset. unlock_benefits is a jsonb array of
-- strings. unlock_price_label is only a display fallback for builds where
-- StoreKit can't provide the real localized price; the actual charge is
-- always the App Store product's own price.
alter table public.phase_promos
  add column if not exists unlock_badge text,
  add column if not exists unlock_title text,
  add column if not exists unlock_subtitle text,
  add column if not exists unlock_benefits jsonb,
  add column if not exists unlock_package_name text,
  add column if not exists unlock_package_desc text,
  add column if not exists unlock_price_label text;
