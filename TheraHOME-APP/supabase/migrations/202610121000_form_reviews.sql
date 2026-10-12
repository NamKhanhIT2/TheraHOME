-- "Tôi tập thế này đúng chưa?"
--
-- The one question a person doing rehab at home cannot answer for themselves,
-- and the one no amount of software can answer for them. This is the feature
-- that puts a real pair of eyes on it: the customer records a short clip of
-- themselves doing a day's exercise, a specialist watches it and writes back.
--
-- WHAT THIS TABLE IS NOT. It is not a messaging system — the clip travels as
-- an ordinary chat attachment in the customer's existing support thread, so
-- delivery, push, unread counts, replies and signed URLs all already work and
-- none of it is re-implemented here. What was missing is only the two things
-- a chat cannot carry: WHICH exercise the clip is of, and whether anyone has
-- dealt with it yet. That is all this row holds.
--
-- The allowance is deliberately a server-side number rather than a client
-- check. It is the lever the subscription will pull later, and a limit the
-- client can edit is not a limit.

create table if not exists public.form_reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  thread_id uuid not null references public.chat_threads(id) on delete cascade,
  -- The customer's video message. Cascade: a deleted clip leaves no orphan
  -- request for staff to open and find nothing behind.
  message_id uuid not null references public.chat_messages(id) on delete cascade,
  user_program_id uuid references public.user_programs(id) on delete set null,
  program_day_id uuid references public.program_days(id) on delete set null,
  -- Denormalised so "Ngày 5" survives the program day being edited away, and
  -- so the staff queue needs no join to say what it is looking at.
  day_number integer,
  day_label text,
  status text not null default 'pending' check (status in ('pending', 'reviewed', 'cancelled')),
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  reply_message_id uuid references public.chat_messages(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists form_reviews_user_idx on public.form_reviews (user_id, created_at desc);
create index if not exists form_reviews_pending_idx on public.form_reviews (status, created_at) where status = 'pending';
create index if not exists form_reviews_thread_idx on public.form_reviews (thread_id, status);
-- One request per clip. Tapping "gửi" twice is a double submit, not two
-- questions, and staff should never see the same video queued twice.
create unique index if not exists form_reviews_one_per_message on public.form_reviews (message_id);

alter table public.form_reviews enable row level security;

-- Readable by the person who asked and by staff. There is no INSERT or UPDATE
-- policy at all: every transition goes through the two functions below, which
-- is what makes the allowance and the "staff only" rule real rather than
-- advisory.
drop policy if exists "read own or staff form_reviews" on public.form_reviews;
create policy "read own or staff form_reviews" on public.form_reviews
  for select to authenticated
  using (
    user_id = (select auth.uid())
    or 'admin' = any (public.current_web_roles())
    or 'cskh' = any (public.current_web_roles())
  );

/**
 * How many clips one person may send in a calendar month.
 *
 * A function rather than a constant in the client, because the client is the
 * one thing that cannot be trusted to enforce it — and because this is the
 * number the paid tier will raise. Both sides read it, so the count the
 * customer is shown and the count the server enforces cannot drift apart.
 */
create or replace function public.form_review_monthly_allowance()
returns integer language sql immutable as $$ select 4 $$;

/** At most one clip may be waiting at a time. Not a billing limit — an
 * operational one: a queue where one person can file ten videos is a queue
 * that starves everyone else. */
create or replace function public.form_review_max_pending()
returns integer language sql immutable as $$ select 1 $$;

create or replace function public.request_form_review(
  p_thread_id uuid,
  p_message_id uuid,
  p_user_program_id uuid default null,
  p_program_day_id uuid default null,
  p_day_number integer default null,
  p_day_label text default null
)
returns public.form_reviews
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_message public.chat_messages;
  v_pending integer;
  v_this_month integer;
  v_row public.form_reviews;
begin
  if v_user is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;

  select * into v_message from public.chat_messages where id = p_message_id;
  if v_message.id is null then
    raise exception 'message_not_found' using errcode = 'P0002';
  end if;
  -- The clip must be the caller's own and in the thread they claim. Checked
  -- against the row rather than trusted from the request, so no client can
  -- queue somebody else's video for review.
  if v_message.sender_id is distinct from v_user or v_message.thread_id is distinct from p_thread_id then
    raise exception 'not_your_message' using errcode = '42501';
  end if;
  if v_message.attachment_path is null then
    raise exception 'attachment_required' using errcode = '22023';
  end if;

  select count(*) into v_pending
    from public.form_reviews
   where user_id = v_user and status = 'pending';
  if v_pending >= public.form_review_max_pending() then
    raise exception 'review_already_pending' using errcode = '22023';
  end if;

  select count(*) into v_this_month
    from public.form_reviews
   where user_id = v_user
     and status <> 'cancelled'
     and created_at >= date_trunc('month', now());
  if v_this_month >= public.form_review_monthly_allowance() then
    raise exception 'monthly_allowance_reached' using errcode = '22023';
  end if;

  insert into public.form_reviews (
    user_id, thread_id, message_id, user_program_id, program_day_id, day_number, day_label
  ) values (
    v_user, p_thread_id, p_message_id, p_user_program_id, p_program_day_id, p_day_number, p_day_label
  )
  returning * into v_row;

  return v_row;
end;
$$;

/** Staff marking a clip as dealt with. `p_reply_message_id` is optional and
 * only for the record — the actual reply is an ordinary chat message the
 * customer has already received. */
create or replace function public.complete_form_review(
  p_review_id uuid,
  p_reply_message_id uuid default null
)
returns public.form_reviews
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_row public.form_reviews;
begin
  if v_user is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  if not ('admin' = any (public.current_web_roles()) or 'cskh' = any (public.current_web_roles())) then
    raise exception 'staff_required' using errcode = '42501';
  end if;

  update public.form_reviews
     set status = 'reviewed',
         reviewed_by = v_user,
         reviewed_at = now(),
         reply_message_id = coalesce(p_reply_message_id, reply_message_id)
   where id = p_review_id and status = 'pending'
  returning * into v_row;

  if v_row.id is null then
    raise exception 'review_not_pending' using errcode = 'P0002';
  end if;
  return v_row;
end;
$$;

revoke all on function public.request_form_review(uuid, uuid, uuid, uuid, integer, text) from public, anon;
grant execute on function public.request_form_review(uuid, uuid, uuid, uuid, integer, text) to authenticated;
revoke all on function public.complete_form_review(uuid, uuid) from public, anon;
grant execute on function public.complete_form_review(uuid, uuid) to authenticated;
grant execute on function public.form_review_monthly_allowance() to authenticated;
grant execute on function public.form_review_max_pending() to authenticated;

-- Realtime, or the specialist's answer never reaches the screen the customer
-- is looking at. A row added to the table but not to the publication is the
-- silent half of this: the subscription connects, reports healthy, and
-- delivers nothing. (Learned the hard way on `calls`.)
alter publication supabase_realtime add table public.form_reviews;
