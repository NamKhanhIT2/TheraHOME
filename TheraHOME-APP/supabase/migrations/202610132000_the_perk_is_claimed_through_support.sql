-- The paywall showed holders a discount code — THERAPLUS10, THERALIFE15 —
-- and the Shopify store has no discount codes at all. Not "those two are
-- missing": zero, checked against the full list through the Admin API. A
-- customer who paid 199.000đ and pasted that code got "invalid".
--
-- Owner's decision (2026-10-13): keep the discount, and let customers ask
-- support for it when they want it. So the benefit line says how to claim it
-- and the stored code goes. app/subscription.tsx renders the code block only
-- when perk_discount_code is set, so clearing it removes the block; the
-- percentage stays on the row because that is still what the discount is.
--
-- Data, not schema: both the feature lines and the code live in
-- subscription_plans, which the app reads at runtime. No rebuild.
--
-- Guarded on the slot still holding the shopping-bag line, so a reorder done
-- in WEB Admin first makes this a no-op rather than a sentence landing in
-- the wrong place.

update public.subscription_plans set features = jsonb_set(
  features, '{6}',
  '{"icon":"shopping-bag","vi":"Giảm 10% thiết bị và phụ kiện TheraHOME · nhắn CSKH để nhận mã","en":"10% off TheraHOME devices and accessories · message support for the code","ms":"Diskaun 10% peranti dan aksesori TheraHOME · hantar mesej kepada sokongan untuk kod"}'::jsonb
), perk_discount_code = null
 where code = 'premium_plus' and features->6->>'icon' = 'shopping-bag';

update public.subscription_plans set features = jsonb_set(
  features, '{5}',
  '{"icon":"shopping-bag","vi":"Giảm 15% thiết bị và phụ kiện TheraHOME · nhắn CSKH để nhận mã","en":"15% off TheraHOME devices and accessories · message support for the code","ms":"Diskaun 15% peranti dan aksesori TheraHOME · hantar mesej kepada sokongan untuk kod"}'::jsonb
), perk_discount_code = null
 where code = 'premium_lifetime' and features->5->>'icon' = 'shopping-bag';
