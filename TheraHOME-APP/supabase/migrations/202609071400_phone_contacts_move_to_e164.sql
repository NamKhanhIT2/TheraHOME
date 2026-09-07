-- Activation only ever accepted Vietnamese phone numbers. normalize_phone_vn
-- stripped punctuation, turned a leading 84 into 0, and three functions then
-- required '^0[0-9]{9,10}$' — so +44 and +60 numbers were rejected outright,
-- while a UK domestic number like 07911123456 slipped through and landed in the
-- same flat namespace as Vietnamese ones. normalized_value is globally unique,
-- so two customers in different countries could block each other with an error
-- message that would make no sense to either.
--
-- Everything is E.164 from here: +84…, +44…, +60…. A bare domestic number with
-- a leading 0 still needs a country to resolve, and the default stays '84' so
-- the Vietnamese orders already on file normalise exactly as they did before,
-- only now written +84. Callers that know better (the app and Admin, which
-- carry a dialling-code picker) send the full international form.
--
-- Note the market codes cannot supply the country: 'US' in this project covers
-- "UK · Anh / EU / Mỹ", which spans +44, +1 and the EU codes. The dialling code
-- has to come from the person entering the number.
create or replace function public.normalize_phone_e164(p_phone text, p_default_cc text default '84')
returns text
language sql
immutable
set search_path to 'public'
as $function$
  with raw as (
    select btrim(coalesce(p_phone, '')) as v
  ), parts as (
    select
      (select v like '+%' or regexp_replace(v, '[^0-9]', '', 'g') like '00%' from raw) as is_intl,
      (select regexp_replace(v, '[^0-9]', '', 'g') from raw) as digits
  )
  select case
    when digits = '' then ''
    when is_intl and digits like '00%' then '+' || substring(digits from 3)
    when is_intl then '+' || digits
    when digits like '0%' then '+' || p_default_cc || substring(digits from 2)
    when digits like p_default_cc || '%' then '+' || digits
    else '+' || p_default_cc || digits
  end
  from parts;
$function$;

-- Kept so the six existing callers keep compiling; it now yields E.164 too, so
-- stored values and freshly normalised ones agree. New code should call
-- normalize_phone_e164 directly and pass the country the user actually chose.
create or replace function public.normalize_phone_vn(p_phone text)
returns text
language sql
immutable
set search_path to 'public'
as $function$
  select public.normalize_phone_e164(p_phone, '84');
$function$;

-- Only three functions validate the shape; swap the Vietnam-only pattern for
-- E.164 in place, so nothing else in those bodies can drift while editing.
do $$
declare
  fn record;
begin
  for fn in
    select p.oid
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in ('activate_product_by_contact', 'claim_user_access_contact', 'normalize_product_activation_contact')
      and pg_get_functiondef(p.oid) like '%^0[0-9]{9,10}$%'
  loop
    execute replace(pg_get_functiondef(fn.oid), '^0[0-9]{9,10}$', '^\+[1-9][0-9]{6,14}$');
  end loop;
end $$;

update public.user_access_contacts
   set normalized_value = public.normalize_phone_e164(normalized_value, '84')
 where contact_type = 'phone' and normalized_value not like '+%';

update public.product_activation_contacts
   set normalized_value = public.normalize_phone_e164(normalized_value, '84')
 where contact_type = 'phone' and normalized_value not like '+%';
