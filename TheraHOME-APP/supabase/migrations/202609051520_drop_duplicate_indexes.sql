-- Performance advisor 2026-09-05: two pairs of identical indexes. In each
-- pair one is the UNIQUE constraint's own index (kept — FKs depend on it);
-- the other is a stray standalone index from an earlier migration.
drop index if exists public.user_program_days_program_day_key;
drop index if exists public.user_programs_user_product_key;
