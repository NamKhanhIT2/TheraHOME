-- App Review has to be able to SEE the thing it is reviewing.
--
-- Apple rejected build 45 under Guideline 2.1(b) on 2026-10-17: "In-app
-- purchase products associated with the app version submitted for review,
-- such as Premium Plus, Premium, and Premium Lifetime, could not be found
-- in the submitted binary."
--
-- They could not be found because WE HID THEM. `active_plan_code()` has
-- returned the top tier for `account_type = 'review'` since the tiers
-- shipped, which is one honest reading of the owner's rule that a review
-- account bypasses every gate. But a review account that already HOLDS
-- Premium Trọn Đời is a review account that:
--
--   * sees no upgrade card on Home — `UpgradeCard` hides itself from
--     anyone who already pays, which is right for a customer and fatal for
--     a reviewer, because that card is the only entrance to the paywall
--     outside Hồ sơ;
--   * finds the top plan marked "đang dùng" on the plans screen with its
--     buy button disabled.
--
-- So the reviewer opened the app, found no way to buy anything, and
-- reported exactly that.
--
-- THE FIX IS TO SEPARATE TWO THINGS THAT WERE NEVER THE SAME:
--
--   "which plan did this person BUY"   → active_plan_code(), and from now
--                                        on nothing else. It is what the
--                                        STORE shows, so it must tell the
--                                        truth: a review account has
--                                        bought nothing, so it sees the
--                                        upgrade card and three buyable
--                                        plans, exactly like a customer on
--                                        their first day.
--
--   "may this person USE paid features" → has_paid_access(), new below,
--                                        which is the purchased plan OR a
--                                        review account.
--
-- The owner's rule is unchanged in substance: App Review still reaches
-- every feature without buying anything. What changes is that it is no
-- longer told it owns a subscription it never bought — which was both the
-- cause of the rejection and, read plainly, not true.

create or replace function public.has_paid_access()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.active_plan_code() is not null
    or exists (
      select 1 from public.profiles
       where id = (select auth.uid()) and account_type = 'review'
    )
$$;

revoke all on function public.has_paid_access() from public, anon, authenticated;
grant execute on function public.has_paid_access() to authenticated;

-- The purchased plan, and nothing else. (Everything that gated a FEATURE on
-- this function already had its own explicit review branch — the call,
-- chat, form-review and xu allowances all test `account_type = 'review'`
-- themselves — so they are unaffected. The two that did not are fixed
-- below.)
create or replace function public.active_plan_code()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select s.plan_code
    from public.user_subscriptions s
    left join public.subscription_plans p on p.code = s.plan_code
   where s.user_id = (select auth.uid())
     and s.revoked_at is null
     and s.status = 'active'
     and (s.current_period_end is null or s.current_period_end > now())
   -- LEFT join on purpose. A plan retired or renamed in WEB Admin must not
   -- silently revoke a subscription somebody paid for, so a row whose
   -- plan_code no longer matches still counts — it just sorts last.
   order by coalesce(p.sort_order, 0) desc, s.purchased_at desc
   limit 1
$$;

-- "Nhắc tập theo thói quen của riêng bạn" — a paid benefit, which a review
-- account must still be able to see working.
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
  where public.has_paid_access()
    and (
      select count(*) from public.user_program_days d2
      join public.user_programs up2 on up2.id = d2.user_program_id
     where up2.user_id = (select auth.uid()) and d2.status = 'done' and d2.completed_at is not null
    ) >= 4
$$;

-- "Tập cùng chuyên viên": the reference track, and the clip behind it.
drop policy if exists "read published exercise references with a plan" on public.exercise_references;
create policy "read published exercise references with a plan"
on public.exercise_references
for select
to authenticated
using (
  (published and public.has_paid_access())
  or 'admin' = any (public.current_web_roles())
  or 'cskh' = any (public.current_web_roles())
);

drop policy if exists "read exercise clips with a plan" on storage.objects;
create policy "read exercise clips with a plan"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'exercise-reference'
  and (
    public.has_paid_access()
    or 'admin' = any (public.current_web_roles())
    or 'cskh' = any (public.current_web_roles())
  )
);
