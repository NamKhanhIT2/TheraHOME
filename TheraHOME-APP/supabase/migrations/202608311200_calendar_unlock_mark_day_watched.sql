-- Roadmap mechanic change: days unlock by calendar time since
-- user_programs.activated_at (one per day, client-side derivation), not by
-- pressing "hoàn thành buổi tập". Watching a day's video is what records
-- completion now. This RPC replaces complete_day in the app (complete_day
-- itself is left in place, unused): it marks one day watched WITHOUT
-- advancing current_day or requiring a pain score, and keeps
-- streak/adherence in the same spirit as before.
create or replace function public.mark_day_watched(p_user_program_id uuid, p_program_day_id uuid)
returns boolean
language plpgsql security definer set search_path = public
as $$
declare
  v_program user_programs%rowtype;
  v_day program_days%rowtype;
  v_elapsed integer;
  v_newly boolean := false;
  v_total_days integer;
  v_unlocked integer;
  v_done integer;
  v_streak integer;
  v_prev_streak integer;
begin
  select * into v_program from user_programs where id = p_user_program_id and user_id = auth.uid();
  if not found then
    raise exception 'not_authorized';
  end if;

  select * into v_day from program_days where id = p_program_day_id;
  if not found or v_day.product_id <> v_program.product_id then
    raise exception 'day_not_in_program';
  end if;

  -- Calendar gate, +1 day of slack so client-local midnight vs. server UTC
  -- never wrongly rejects "today".
  v_elapsed := (now()::date - v_program.activated_at::date);
  if v_day.day_number > v_elapsed + 2 then
    raise exception 'day_not_unlocked';
  end if;

  update user_program_days
     set status = 'done', completed_at = coalesce(completed_at, now())
   where user_program_id = p_user_program_id
     and program_day_id = p_program_day_id
     and status <> 'done';
  v_newly := found;

  if not exists (
    select 1 from user_program_days
    where user_program_id = p_user_program_id and program_day_id = p_program_day_id
  ) then
    insert into user_program_days (user_program_id, program_day_id, status, completed_at)
    values (p_user_program_id, p_program_day_id, 'done', now());
    v_newly := true;
  end if;

  if not v_newly then
    return false;
  end if;

  select total_days into v_total_days from products where id = v_program.product_id;
  v_unlocked := least(greatest(v_elapsed + 1, 1), coalesce(v_total_days, 1));

  select count(*) into v_done
  from user_program_days upd
  join program_days pd on pd.id = upd.program_day_id
  where upd.user_program_id = p_user_program_id and upd.status = 'done';

  -- Streak = the terminal consecutive run of watched days (rest days count
  -- as satisfied so they don't break a run).
  with ok_days as (
    select pd.day_number
    from user_program_days upd
    join program_days pd on pd.id = upd.program_day_id
    where upd.user_program_id = p_user_program_id
      and (upd.status = 'done' or pd.day_type = 'rest')
  )
  select count(*) into v_streak
  from ok_days a
  where not exists (
    select 1 from generate_series(a.day_number, (select max(day_number) from ok_days)) g
    where g not in (select day_number from ok_days)
  );

  v_prev_streak := v_program.streak;
  update user_programs
     set adherence_pct = round(v_done::numeric / greatest(v_unlocked, 1) * 100),
         streak = coalesce(v_streak, 0)
   where id = p_user_program_id;

  if coalesce(v_streak, 0) > coalesce(v_prev_streak, 0) and v_streak = any(array[7, 14, 21, 28]) then
    insert into notifications (user_id, type, title, body)
    values (
      auth.uid(),
      'streak_milestone',
      'Chuỗi ' || v_streak || ' ngày liên tiếp! 🔥',
      'Bạn đã duy trì lộ trình ' || v_streak || ' ngày. Chia sẻ thành tích với cộng đồng?'
    );
  end if;

  return true;
end;
$$;

revoke execute on function public.mark_day_watched(uuid, uuid) from public, anon;
grant execute on function public.mark_day_watched(uuid, uuid) to authenticated;
