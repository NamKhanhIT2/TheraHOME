-- complete_day used to insert the "Ngày N+1 đang chờ bạn" notification
-- unconditionally — so finishing day 14 announced day 15 even while phase 3
-- sat behind an unpurchased IAP (per explicit request 2026-09-04: with
-- phase 3 locked, day notifications must stop at day 14). The current app
-- no longer calls complete_day (mark_day_watched owns completion), but old
-- installed builds still do, so the gate belongs server-side too.
--
-- Locked = the next day's phase has an IAP requirement on ANY platform
-- (apple_product_id or google_product_id in phase_promos) and the user has
-- no unrevoked purchase for it. The server can't know the caller's
-- platform, so this errs on the quiet side — no notification rather than a
-- notification for a possibly-locked day.
create or replace function public.complete_day(p_user_program_id uuid, p_program_day_id uuid, p_pain_score integer)
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_program user_programs%rowtype;
  v_day_number integer;
  v_next_user_program_day_id uuid;
  v_next_program_day_id uuid;
  v_next_day_number integer;
  v_next_phase_locked boolean := false;
  v_done_count integer;
  v_total_days integer;
  v_new_streak integer;
begin
  select * into v_program from user_programs where id = p_user_program_id and user_id = auth.uid();
  if not found then
    raise exception 'not_authorized';
  end if;

  insert into pain_logs (user_id, user_program_id, program_day_id, score)
  values (auth.uid(), p_user_program_id, p_program_day_id, p_pain_score);

  update user_program_days set status = 'done', completed_at = now()
  where user_program_id = p_user_program_id and program_day_id = p_program_day_id;

  select day_number into v_day_number from program_days where id = p_program_day_id;

  select upd.id, pd.id, pd.day_number
  into v_next_user_program_day_id, v_next_program_day_id, v_next_day_number
  from user_program_days upd
  join program_days pd on pd.id = upd.program_day_id
  where upd.user_program_id = p_user_program_id and pd.day_number = v_day_number + 1;

  if v_next_user_program_day_id is not null then
    update user_program_days set status = 'current' where id = v_next_user_program_day_id;

    select exists (
      select 1
      from program_days pd
      join phase_promos pp on pp.phase_id = pd.phase_id
      where pd.id = v_next_program_day_id
        and (pp.apple_product_id is not null or pp.google_product_id is not null)
    ) and not exists (
      select 1
      from program_days pd
      join phase_purchases ph on ph.phase_id = pd.phase_id
      where pd.id = v_next_program_day_id
        and ph.user_id = auth.uid()
        and ph.revoked_at is null
    ) into v_next_phase_locked;

    if not v_next_phase_locked then
      insert into notifications (user_id, type, title, body, related_day_id, related_product_id)
      values (
        auth.uid(),
        'schedule',
        'Đến giờ tập hôm nay',
        'Ngày ' || v_next_day_number || ' đang chờ bạn',
        v_next_program_day_id,
        v_program.product_id
      );
    end if;
  end if;

  select count(*) filter (where status = 'done'), count(*) into v_done_count, v_total_days
  from user_program_days where user_program_id = p_user_program_id;

  select total_days into v_total_days from products where id = v_program.product_id;

  update user_programs
  set current_day = least(v_day_number + 1, v_total_days),
      adherence_pct = round(v_done_count::numeric / greatest(v_day_number, 1) * 100),
      streak = streak + 1
  where id = p_user_program_id
  returning streak into v_new_streak;

  if v_new_streak = any(array[7, 14, 21, 28]) then
    insert into notifications (user_id, type, title, body)
    values (
      auth.uid(),
      'streak_milestone',
      'Chuỗi ' || v_new_streak || ' ngày liên tiếp! 🔥',
      'Bạn đã duy trì lộ trình ' || v_new_streak || ' ngày. Chia sẻ thành tích với cộng đồng?'
    );
  end if;
end;
$function$;
