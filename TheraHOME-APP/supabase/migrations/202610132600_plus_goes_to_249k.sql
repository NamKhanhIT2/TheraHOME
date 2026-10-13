-- Owner 2026-10-13: Premium Plus goes from 199.000đ to 249.000đ.
--
-- price_amount_vnd is what every revenue figure in subscription_ops_overview
-- multiplies, so it has to move or "tiền đã thu" stops matching what Apple
-- will actually pay out.
--
-- The LABEL is only a fallback. app/subscription.tsx renders
-- `product?.displayPrice ?? plan.priceLabel`, so once the store has fetched
-- the product the STORE's own price is what the customer sees — which means
-- the change that actually charges 249k is the one made in App Store Connect,
-- and this file only keeps our own books straight. price_label_en and
-- price_label_ms are deliberately untouched: the new USD/MYR figures come
-- from whichever Apple price tier is picked, and inventing them here would
-- put a wrong number on screen for anyone whose store lookup fails.
update public.subscription_plans
   set price_amount_vnd = 249000,
       price_label_vi = '249.000đ'
 where code = 'premium_plus';
