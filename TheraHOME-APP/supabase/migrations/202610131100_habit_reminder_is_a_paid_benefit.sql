-- "Nhắc tập theo thói quen của riêng bạn" sits under Premium on the paywall,
-- so the suggestion is gated HERE rather than in the app: one place decides,
-- and a client that forgets to check cannot give it away.
--
-- A customer with no plan keeps the reminder they always had — a time they
-- typed in themselves, probably on day one. Nothing is taken away; what
-- Premium adds is the app knowing their own habitual hour and offering it.
create or replace function public.suggested_reminder_hour()
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select hour from (
    select extract(hour from (d.completed_at at time zone 'Asia/Ho_Chi_Minh'))::integer as hour,
           count(*) as n
      from public.user_program_days d
      join public.user_programs up on up.id = d.user_program_id
     where up.user_id = (select auth.uid())
       and d.status = 'done'
       and d.completed_at is not null
     group by 1
     order by n desc, hour
     limit 1
  ) top
  where public.active_plan_code() is not null
    and (
      select count(*) from public.user_program_days d2
      join public.user_programs up2 on up2.id = d2.user_program_id
     where up2.user_id = (select auth.uid()) and d2.status = 'done' and d2.completed_at is not null
    ) >= 4
$$;
