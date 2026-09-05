-- Repo mirror (audit 2026-09-05). The live table has had a `language` column
-- and a (template_key, language) primary key since the multi-language
-- templates work, but no migration file in the repo ever recorded that —
-- 202608210001 still declares `template_key text primary key`. A fresh
-- project built from the repo would break the WEB upsert
-- (`onConflict` on the composite key) and the app's language filter.
-- Idempotent: a no-op on the live project.
alter table public.system_notification_templates
  add column if not exists language text not null default 'vi';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'system_notification_templates_language_check'
      and conrelid = 'public.system_notification_templates'::regclass
  ) then
    alter table public.system_notification_templates
      add constraint system_notification_templates_language_check
      check (language in ('vi', 'en', 'ms'));
  end if;

  if exists (
    select 1 from pg_constraint c
    where c.conname = 'system_notification_templates_pkey'
      and c.conrelid = 'public.system_notification_templates'::regclass
      and pg_get_constraintdef(c.oid) = 'PRIMARY KEY (template_key)'
  ) then
    alter table public.system_notification_templates drop constraint system_notification_templates_pkey;
    alter table public.system_notification_templates add primary key (template_key, language);
  end if;
end $$;
