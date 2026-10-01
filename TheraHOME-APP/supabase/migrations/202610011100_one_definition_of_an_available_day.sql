-- "Available to this customer" was written out inside adherence_pct_for.
-- Admin now needs the same set to show the fraction behind the percentage
-- ("71% · 10/14 ngày tới lượt"), and two copies of this rule would drift the
-- first time the unlock rules change. So: one function, three callers.
create or replace function public.available_day_ids_for(p_user_program_id uuid)
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  with prog as (
    select up.id, up.user_id, up.product_id,
           (now()::date - up.activated_at::date) + 1 as days_unlocked,
           (select pr.total_days from products pr where pr.id = up.product_id) as total_days
    from user_programs up
    where up.id = p_user_program_id
  )
  select pd.id
  from program_days pd
  cross join prog
  where pd.product_id = prog.product_id
    and coalesce(pd.day_type, 'train') <> 'rest'
    and case
      when exists (
        select 1 from phase_promos pp
        where pp.phase_id = pd.phase_id
          and (pp.apple_product_id is not null or pp.google_product_id is not null)
      ) then exists (
        select 1 from phase_purchases bp
        where bp.user_id = prog.user_id
          and bp.phase_id = pd.phase_id
          and bp.revoked_at is null
          and (now() >= bp.purchased_at + interval '49 hours'
               or pd.day_number <= (select min(x.day_number) from program_days x where x.phase_id = pd.phase_id) + 1)
      )
      else pd.day_number <= least(prog.days_unlocked, coalesce(prog.total_days, prog.days_unlocked))
    end;
$$;

create or replace function public.adherence_pct_for(p_user_program_id uuid)
returns numeric
language sql
stable
security definer
set search_path = public
as $$
  select case
    when (select count(*) from public.available_day_ids_for(p_user_program_id)) = 0 then 0
    else least(
      round(
        (select count(*) from user_program_days upd
          where upd.user_program_id = p_user_program_id
            and upd.status = 'done'
            and upd.program_day_id in (select public.available_day_ids_for(p_user_program_id)))::numeric
        / (select count(*) from public.available_day_ids_for(p_user_program_id)) * 100
      ), 100)
  end;
$$;

-- The parts behind the percentage, for every program in one round trip.
-- Staff only: this is the whole customer base, and the Admin client holds no
-- service key — it calls this as the signed-in admin/cskh.
create or replace function public.admin_adherence_parts()
returns table (user_program_id uuid, days_done integer, days_done_due integer, days_due integer)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not ('admin' = any(current_web_roles()) or 'cskh' = any(current_web_roles())) then
    raise exception 'not_authorized';
  end if;

  return query
  select up.id,
         (select count(*)::int from user_program_days d
           where d.user_program_id = up.id and d.status = 'done'),
         (select count(*)::int from user_program_days d
           where d.user_program_id = up.id and d.status = 'done'
             and d.program_day_id in (select public.available_day_ids_for(up.id))),
         (select count(*)::int from public.available_day_ids_for(up.id))
  from user_programs up;
end;
$$;

revoke all on function public.admin_adherence_parts() from public;
grant execute on function public.admin_adherence_parts() to authenticated;
