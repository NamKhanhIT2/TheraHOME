-- The Agent console's figures move out of the source tree and into the database.
--
-- They were written straight into src/lib/agentConsole.ts as a dated snapshot.
-- That worked, but it put this business's revenue, ad spend and order counts
-- into git history, where deleting the file later does not remove them. The
-- owner asked for them to be read at runtime instead (2026-10-09).
--
-- These tables are not an alternative to reading Meta and Pancake directly —
-- they are the first half of it. The console reads from here; what WRITES here
-- is a separate question, answered today by a human run through the MCP
-- connectors and later by a scheduled job with real credentials. The web code
-- does not change when that swap happens. It is also the right shape
-- regardless: a dashboard should not call Meta's API on every page load.
--
-- Access mirrors agent_approvals: admin writes, admin-or-cskh reads. These are
-- company financials, so no policy here admits anyone else.

create table if not exists public.agent_metrics_days (
  date date primary key,
  spend_vnd bigint not null,
  web_orders integer not null,
  messenger_orders integer not null,
  captured_at timestamptz not null default now()
);

-- One row per span the picker offers. The totals cannot be derived by adding
-- the daily rows up — revenue, cancellations and the product mix are their own
-- per-window reads from Pancake — which is why they are stored rather than
-- computed. `by_product` is jsonb because it is three label/count pairs whose
-- membership changes when a product is added, not a fixed set of columns.
create table if not exists public.agent_metrics_windows (
  id text primary key,
  label text not null,
  from_date date not null,
  to_date date not null,
  sort_order integer not null,
  orders_created integer not null,
  orders_valid integer not null,
  delivered integer not null,
  canceled integer not null,
  returned integer not null,
  revenue_vnd bigint not null,
  avg_order_value_vnd bigint not null,
  cancel_return_pct numeric(5, 2) not null,
  combo_rate_pct numeric(5, 2) not null,
  spend_vnd bigint not null,
  web_orders integer not null,
  web_revenue_vnd bigint not null,
  messenger_orders integer not null,
  messenger_revenue_vnd bigint not null,
  by_product jsonb not null default '[]'::jsonb,
  untagged_orders integer not null,
  zalo_orders integer not null,
  zalo_revenue_vnd bigint not null,
  captured_at timestamptz not null default now()
);

create table if not exists public.agent_metrics_campaigns (
  window_id text not null references public.agent_metrics_windows(id) on delete cascade,
  campaign_id text not null,
  name text not null,
  spend_vnd bigint not null,
  -- Orders Pancake tagged to this campaign's utm_campaign. Not every order
  -- carries one, so this is always below the window's order count and every
  -- CPA derived from it is the harsher of the two the console shows.
  orders integer not null,
  revenue_vnd bigint not null,
  primary key (window_id, campaign_id)
);

alter table public.agent_metrics_days enable row level security;
alter table public.agent_metrics_windows enable row level security;
alter table public.agent_metrics_campaigns enable row level security;

do $$
declare t text;
begin
  foreach t in array array['agent_metrics_days', 'agent_metrics_windows', 'agent_metrics_campaigns'] loop
    execute format('drop policy if exists "web admin writes %1$s" on public.%1$I', t);
    execute format(
      'create policy "web admin writes %1$s" on public.%1$I for all to authenticated
         using (''admin'' = any (current_web_roles()))
         with check (''admin'' = any (current_web_roles()))', t);
    execute format('drop policy if exists "web admin cskh reads %1$s" on public.%1$I', t);
    execute format(
      'create policy "web admin cskh reads %1$s" on public.%1$I for select to authenticated
         using (''admin'' = any (current_web_roles()) or ''cskh'' = any (current_web_roles()))', t);
  end loop;
end $$;
