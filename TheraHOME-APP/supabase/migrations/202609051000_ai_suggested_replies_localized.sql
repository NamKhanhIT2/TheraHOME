-- Suggestion chips under the AI chat were Vietnamese-only (one `text`),
-- so an English-language user got English UI + Vietnamese chips. Per-field
-- EN/MS with VN fallback, same pattern as faq_items / app_config.
alter table public.ai_suggested_replies
  add column if not exists text_en text,
  add column if not exists text_ms text;
