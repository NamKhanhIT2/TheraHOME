-- `orders` has RLS on with no policies (reachable only through SECURITY
-- DEFINER RPCs), so WEB's "does this product have orders?" guard before
-- deleting a roadmap always counted 0 and could never fire. Deleting a
-- product with real orders then failed on the foreign key instead, with a
-- generic error. This gives the guard a way to see the real number.
create or replace function public.product_order_count(p_product_id text)
returns integer
language sql
stable
security definer
set search_path to ''
as $$
  select case
    when 'admin' = any(public.current_web_roles()) or 'cskh' = any(public.current_web_roles())
      then (select count(*)::int from public.orders o where o.product_id = p_product_id)
    else 0
  end;
$$;

revoke execute on function public.product_order_count(text) from public, anon;
grant execute on function public.product_order_count(text) to authenticated;
