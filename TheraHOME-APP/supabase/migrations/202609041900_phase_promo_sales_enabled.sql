-- "Tạm ngưng bán" switch (per explicit request 2026-09-04): the app ships
-- to the App Store under the FREE apps agreement first, so the phase-3 IAP
-- must not be visible anywhere yet — but clearing apple_product_id would
-- have made phase 3 free for everyone instead. sales_enabled=false keeps
-- the phase LOCKED (days hidden, "Ngày N/14" caps, no unlock notification)
-- while hiding every selling surface: the greyed phase header, both promo
-- cards, and with them the only paths into the paywall. Flip back to true
-- from WEB Admin's Upsell editor once the Paid Apps Agreement is active —
-- no new build needed.
alter table public.phase_promos
  add column if not exists sales_enabled boolean not null default true;

update public.phase_promos set sales_enabled = false;
