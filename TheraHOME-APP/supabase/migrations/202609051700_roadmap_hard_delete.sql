-- Roadmap hard delete (owner decision 2026-09-05): WEB Admin may delete a
-- roadmap product outright, even when accounts already hold it. Everything
-- hanging off a product now follows it out: user_programs (whose pain_logs,
-- user_program_days and user_quiz_attempts already cascade), pain_logs rows
-- pointing at the product's days, and notification back-references are
-- nulled. orders.product_id stays NO ACTION — a product with real orders
-- cannot be deleted; WEB refuses with `has_orders`.
alter table public.user_programs
  drop constraint user_programs_product_id_fkey,
  add constraint user_programs_product_id_fkey
    foreign key (product_id) references public.products(id) on delete cascade;

alter table public.pain_logs
  drop constraint pain_logs_program_day_id_fkey,
  add constraint pain_logs_program_day_id_fkey
    foreign key (program_day_id) references public.program_days(id) on delete cascade;

alter table public.notifications
  drop constraint notifications_related_product_id_fkey,
  add constraint notifications_related_product_id_fkey
    foreign key (related_product_id) references public.products(id) on delete set null;

alter table public.notifications
  drop constraint notifications_related_day_id_fkey,
  add constraint notifications_related_day_id_fkey
    foreign key (related_day_id) references public.program_days(id) on delete set null;

-- Only TheraNECK+ has a real roadmap today. The three drafts cloned from it
-- (no videos of their own) are removed rather than kept as "Nháp"; a
-- "roadmap ready" notification pointing at one of them goes with it.
delete from public.notifications
 where type = 'roadmap_ready'
   and related_product_id in ('neck-pro', 'back-plus', 'back-pro');

delete from public.products
 where id in ('neck-pro', 'back-plus', 'back-pro')
   and roadmap_published = false;
