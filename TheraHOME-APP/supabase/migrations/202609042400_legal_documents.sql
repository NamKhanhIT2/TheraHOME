-- Legal texts (Điều khoản / Quyền riêng tư / Bảo mật / Quy định cộng đồng)
-- lived in TWO code files that had to be kept in sync by hand
-- (TheraHOME-APP/src/lib/legalContent.ts and TheraHOME-WEB/src/lib/
-- appLegalContent.ts), so a counsel-requested wording change meant a code
-- edit plus an App Store release. Now admin can publish an override here.
--
-- Deliberately NOT seeded: an empty table means every surface keeps
-- rendering the built-in text exactly as today. A row only exists once an
-- admin saves one, and deleting it reverts to the bundled version.
create table if not exists public.legal_documents (
  doc_key text not null check (doc_key in ('terms', 'privacy', 'security', 'community')),
  language text not null check (language in ('vi', 'en', 'ms')),
  title text not null,
  body text not null,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id),
  primary key (doc_key, language)
);

alter table public.legal_documents enable row level security;

create policy "anyone reads legal_documents" on public.legal_documents
  for select to authenticated, anon using (true);

create policy "web staff writes legal_documents" on public.legal_documents
  for all to authenticated
  using ('admin' = any(public.current_web_roles()) or 'cskh' = any(public.current_web_roles()))
  with check ('admin' = any(public.current_web_roles()) or 'cskh' = any(public.current_web_roles()));
