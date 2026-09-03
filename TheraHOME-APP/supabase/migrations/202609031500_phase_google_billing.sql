-- Google Play Billing for phase unlocks (Android v1 — mirrors the Apple
-- IAP shape). A phase is payment-locked PER PLATFORM: apple_product_id
-- gates iOS, google_product_id gates Android — a phase with only one set
-- is simply not gated on the other platform, so admins can roll billing
-- out platform by platform without dead paywalls.
alter table public.phase_promos
  add column if not exists google_product_id text;

-- Android purchase evidence. The purchaseToken is the verification
-- credential (Play's orderId can be absent, so the token is the stable
-- key); uniqueness binds a token to whichever user redeemed it first,
-- mirroring apple_transaction_id's role.
alter table public.phase_purchases
  add column if not exists google_purchase_token text,
  add column if not exists google_order_id text;

create unique index if not exists phase_purchases_google_purchase_token_key
  on public.phase_purchases (google_purchase_token)
  where google_purchase_token is not null;

-- The table had no platform check at all — pin down the three values in
-- use ('ios' from verify-apple-purchase, 'admin_granted' from
-- admin_set_user_phase, 'android' from the new verify-google-purchase).
alter table public.phase_purchases
  add constraint phase_purchases_platform_check
  check (platform in ('ios', 'android', 'admin_granted'));
