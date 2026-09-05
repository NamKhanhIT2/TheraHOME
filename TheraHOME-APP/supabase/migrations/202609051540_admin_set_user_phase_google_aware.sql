-- Audit 2026-09-05: the RPC only looked at apple_product_id when deciding
-- whether moving a user into a phase must also grant it. WEB computes
-- "requiresPayment" from apple OR google, so a Google-only phase would be
-- moved into and immediately re-locked by the paywall on Android.
-- (Body mirrors the applied migration `admin_set_user_phase_google_aware`.)
create or replace function public.admin_set_user_phase(p_user_program_id uuid, p_phase_id uuid)
returns void language plpgsql security definer set search_path to 'public'
as $function$
declare
  v_program user_programs%rowtype;
  v_phase program_phases%rowtype;
  v_paid boolean;
begin
  if not (current_web_roles() && array['admin', 'cskh']) then
    raise exception using errcode = '42501', message = 'not_authorized';
  end if;
  select * into v_program from user_programs where id = p_user_program_id;
  if not found then
    raise exception using errcode = 'P0002', message = 'user_program_not_found';
  end if;
  select * into v_phase from program_phases where id = p_phase_id;
  if not found or v_phase.product_id <> v_program.product_id then
    raise exception using errcode = '22023', message = 'invalid_phase';
  end if;
  update user_programs set current_day = v_phase.day_start where id = p_user_program_id;
  update user_program_days upd
  set status = case
        when pd.day_number < v_phase.day_start then 'done'
        when pd.day_number = v_phase.day_start then 'current'
        else 'locked'
      end,
      completed_at = case
        when pd.day_number < v_phase.day_start then coalesce(upd.completed_at, now())
        else null
      end
  from program_days pd
  where upd.program_day_id = pd.id and upd.user_program_id = p_user_program_id;
  select (apple_product_id is not null or google_product_id is not null) into v_paid
  from phase_promos where phase_id = p_phase_id;
  if coalesce(v_paid, false) and not exists (
    select 1 from phase_purchases
    where user_id = v_program.user_id and phase_id = p_phase_id and revoked_at is null
  ) then
    insert into phase_purchases (user_id, phase_id, platform, purchased_at)
    values (v_program.user_id, p_phase_id, 'admin_granted', now());
  end if;
end;
$function$;
