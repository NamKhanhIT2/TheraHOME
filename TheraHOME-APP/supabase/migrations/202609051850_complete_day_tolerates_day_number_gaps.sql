-- Deleting a day mid-roadmap in Admin leaves a hole in `day_number` (new days
-- resume at max+1), and this function looked for the next day with
-- `day_number = current + 1`. One hole silently stopped the whole chain: no
-- day was promoted to 'current' and the "next day" notification never fired
-- again. Take the smallest day_number ABOVE the current one instead, and
-- advance `current_day` to that real number rather than a guessed +1.
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
  v_lang text;
  v_copy record;
begin
  select * into v_program from user_programs where id = p_user_program_id and user_id = auth.uid();
  if not found then raise exception 'not_authorized'; end if;
  v_lang := public.profile_language(auth.uid());
  insert into pain_logs (user_id, user_program_id, program_day_id, score)
  values (auth.uid(), p_user_program_id, p_program_day_id, p_pain_score);
  update user_program_days set status = 'done', completed_at = now()
  where user_program_id = p_user_program_id and program_day_id = p_program_day_id;
  select day_number into v_day_number from program_days where id = p_program_day_id;

  select upd.id, pd.id, pd.day_number
    into v_next_user_program_day_id, v_next_program_day_id, v_next_day_number
  from user_program_days upd
  join program_days pd on pd.id = upd.program_day_id
  where upd.user_program_id = p_user_program_id
    and pd.day_number > v_day_number
  order by pd.day_number
  limit 1;

  if v_next_user_program_day_id is not null then
    update user_program_days set status = 'current' where id = v_next_user_program_day_id;
    select exists (
      select 1 from program_days pd
      join phase_promos pp on pp.phase_id = pd.phase_id
      where pd.id = v_next_program_day_id
        and (pp.apple_product_id is not null or pp.google_product_id is not null)
    ) and not exists (
      select 1 from program_days pd
      join phase_purchases ph on ph.phase_id = pd.phase_id
      where pd.id = v_next_program_day_id
        and ph.user_id = auth.uid()
        and ph.revoked_at is null
    ) into v_next_phase_locked;
    if not v_next_phase_locked then
      select * into v_copy from public.notification_copy(v_lang, 'next_day', v_next_day_number);
      insert into notifications (user_id, type, title, body, related_day_id, related_product_id)
      values (auth.uid(), 'schedule', v_copy.title, v_copy.body, v_next_program_day_id, v_program.product_id);
    end if;
  end if;

  select count(*) filter (where status = 'done'), count(*)
    into v_done_count, v_total_days
  from user_program_days where user_program_id = p_user_program_id;
  select total_days into v_total_days from products where id = v_program.product_id;
  update user_programs
  set current_day = least(coalesce(v_next_day_number, v_day_number + 1), v_total_days),
      adherence_pct = round(v_done_count::numeric / greatest(v_day_number, 1) * 100),
      streak = streak + 1
  where id = p_user_program_id
  returning streak into v_new_streak;

  if v_new_streak = any(array[7, 14, 21, 28]) then
    select * into v_copy from public.notification_copy(v_lang, 'streak', v_new_streak);
    insert into notifications (user_id, type, title, body)
    values (auth.uid(), 'streak_milestone', v_copy.title, v_copy.body);
  end if;
end;
$function$;
