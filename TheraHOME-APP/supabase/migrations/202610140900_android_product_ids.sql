-- The Android half of the paywall. app/subscription.tsx renders a plan as
-- buyable only when the store returned a product for it, and
-- useSubscriptionPlans picks the id per platform:
--
--   storeProductId: Platform.OS === 'android' ? google : apple
--
-- so with google_product_id null the Android app asked Play for nothing and
-- the Buy button stayed disabled however complete the Play Console listing
-- was. Same ids as Apple's, which keeps reconciliation between the two
-- payout reports a matter of reading one column.
update public.subscription_plans set google_product_id = 'neckplus_premium_monthly'        where code = 'premium';
update public.subscription_plans set google_product_id = 'neckplus_premium_plus_quarterly' where code = 'premium_plus';
update public.subscription_plans set google_product_id = 'neckplus_premium_lifetime'       where code = 'premium_lifetime';
