-- These five tables are edited only from tabs that live in the Admin nav
-- (Nội dung ứng dụng: Cấu hình chung / FAQ / Onboarding / Pháp lý, and AI
-- Prompts). RLS nonetheless let any `cskh` role write them straight through
-- PostgREST, so customer care could rewrite the AI assistant's system prompt,
-- the public Terms/Privacy text, the support hotline and the onboarding
-- wording. Writes now require `admin`; reads are untouched.
--
-- Safe for the owner account: current_web_roles() falls back to
-- profiles.account_type, and 'admin' there resolves to {admin,cskh}.
-- `system_notification_templates` deliberately stays staff-wide — its tab IS
-- in the CSKH nav.
drop policy if exists "web staff write app_config" on public.app_config;
create policy "web admin write app_config" on public.app_config
  for all to authenticated
  using ('admin' = any(public.current_web_roles()))
  with check ('admin' = any(public.current_web_roles()));

drop policy if exists "web staff write faq_items" on public.faq_items;
create policy "web admin write faq_items" on public.faq_items
  for all to authenticated
  using ('admin' = any(public.current_web_roles()))
  with check ('admin' = any(public.current_web_roles()));

drop policy if exists "web staff writes legal_documents" on public.legal_documents;
create policy "web admin writes legal_documents" on public.legal_documents
  for all to authenticated
  using ('admin' = any(public.current_web_roles()))
  with check ('admin' = any(public.current_web_roles()));

drop policy if exists "web staff writes onboarding_question_texts" on public.onboarding_question_texts;
create policy "web admin writes onboarding_question_texts" on public.onboarding_question_texts
  for all to authenticated
  using ('admin' = any(public.current_web_roles()))
  with check ('admin' = any(public.current_web_roles()));

drop policy if exists "web staff update ai prompt" on public.ai_prompts;
create policy "web admin update ai prompt" on public.ai_prompts
  for update to authenticated
  using ('admin' = any(public.current_web_roles()))
  with check ('admin' = any(public.current_web_roles()));
