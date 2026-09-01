-- Per-language overrides for phase promo/paywall content (2026-09-01).
-- phase_promos' text/url fields were single-language (VN) — UK/ML users saw
-- Vietnamese upsell cards and paywalls. `translations` holds partial
-- per-language overrides keyed by app language then column name, e.g.
--   { "en": { "unlock_title": "...", "unlock_benefits": ["..."] },
--     "ms": { "cross_sell_description": "..." } }
-- A missing/empty field falls back to the base VN column (mobile merges in
-- usePhasePromo; the WEB Admin's Upsell editor edits it via VN/EN/MS tabs).
-- Images and apple_product_id stay shared across languages.

alter table public.phase_promos
  add column if not exists translations jsonb not null default '{}'::jsonb;
