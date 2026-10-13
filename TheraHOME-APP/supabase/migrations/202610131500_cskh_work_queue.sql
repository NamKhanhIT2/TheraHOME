-- A work queue CSKH actually sees, for the three things that need a human
-- (owner 2026-10-13: "mỗi khi có người đăng ký gói, gửi video bài tập,
-- chat... máy CSKH phải nhận được thông báo về").
--
-- All three already happen; none of them reliably reaches a person.
--
--   chat        a push reaches a staff PHONE, and the web console raises a
--               browser notification only while the Chat tab is the open
--               one. Staffing the console from the Kích hoạt tab means
--               hearing nothing.
--   form review travels as a chat attachment, so it inherits exactly the
--               same half-coverage.
--   subscription nothing at all. Somebody can buy Trọn Đời and no one finds
--               out until a query is run by hand.
--
-- The missing piece is a durable record of "something is waiting", separate
-- from the customer's own notification inbox. `notifications` is the
-- CUSTOMER's inbox — its type CHECK and the app's renderer are built around
-- that — so staff work does not belong in it.
--
-- The alert is per THING, not per event: a customer who sends six messages
-- is one open alert with event_count 6, not six rows to dismiss. That is
-- what the partial unique index on (kind, dedupe_key) WHERE handled_at IS
-- NULL enforces, and it is why a reply can close the alert without knowing
-- how many messages arrived.

create table if not exists public.staff_alerts (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('chat', 'form_review', 'subscription', 'subscription_refund')),
  -- What the alert is ABOUT, so repeat events fold into one row: the thread
  -- for chat, the review id, the subscription id.
  dedupe_key text not null,
  customer_id uuid references auth.users(id) on delete cascade,
  title text not null,
  body text,
  thread_id uuid references public.chat_threads(id) on delete cascade,
  form_review_id uuid references public.form_reviews(id) on delete cascade,
  subscription_id uuid references public.user_subscriptions(id) on delete cascade,
  event_count integer not null default 1,
  created_at timestamptz not null default now(),
  last_event_at timestamptz not null default now(),
  handled_at timestamptz,
  handled_by uuid references auth.users(id) on delete set null
);

comment on table public.staff_alerts is
  'The CSKH work queue: one open row per thing waiting on a human. Written '
  'only by triggers (SECURITY DEFINER); staff read it and close rows.';

create unique index if not exists staff_alerts_open_unique
  on public.staff_alerts (kind, dedupe_key) where handled_at is null;

create index if not exists staff_alerts_open_idx
  on public.staff_alerts (last_event_at desc) where handled_at is null;

alter table public.staff_alerts enable row level security;

create policy "web staff read staff_alerts" on public.staff_alerts
  for select to authenticated
  using ('admin' = any (public.current_web_roles()) or 'cskh' = any (public.current_web_roles()));

create policy "web staff close staff_alerts" on public.staff_alerts
  for update to authenticated
  using ('admin' = any (public.current_web_roles()) or 'cskh' = any (public.current_web_roles()))
  with check ('admin' = any (public.current_web_roles()) or 'cskh' = any (public.current_web_roles()));

-- No INSERT policy on purpose: every row comes from a trigger below. A
-- client that could insert could also forge a customer_id into the queue.

-- ---------------------------------------------------------------------------
-- The one way a row is created or refreshed
-- ---------------------------------------------------------------------------

create or replace function public.raise_staff_alert(
  p_kind text,
  p_dedupe_key text,
  p_customer uuid,
  p_title text,
  p_body text,
  p_thread uuid default null,
  p_form_review uuid default null,
  p_subscription uuid default null
) returns void
language plpgsql security definer set search_path = public
as $$
begin
  insert into public.staff_alerts (kind, dedupe_key, customer_id, title, body, thread_id, form_review_id, subscription_id)
  values (p_kind, p_dedupe_key, p_customer, p_title, p_body, p_thread, p_form_review, p_subscription)
  on conflict (kind, dedupe_key) where handled_at is null
  -- A second message in the same thread refreshes the open alert rather
  -- than failing or stacking: newest preview, bumped count, bumped time.
  do update set body = excluded.body,
                title = excluded.title,
                event_count = staff_alerts.event_count + 1,
                last_event_at = now();
end;
$$;

revoke execute on function public.raise_staff_alert(text, text, uuid, text, text, uuid, uuid, uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Chat
-- ---------------------------------------------------------------------------

create or replace function public.staff_alert_on_chat_message()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  v_kind text;
  v_customer uuid;
  v_name text;
  v_preview text;
begin
  select t.kind, t.user_id into v_kind, v_customer
    from public.chat_threads t where t.id = new.thread_id;

  -- Only the human support line. An AI thread has no human waiting on it,
  -- and alerting on one would bury the queue under every chatbot message.
  if v_kind is distinct from 'human' then return new; end if;

  if new.sender_type = 'specialist' then
    -- Somebody answered. That is what closes the alert — not reading it,
    -- which is why this lives here and not in a "mark read" path.
    update public.staff_alerts
       set handled_at = now(), handled_by = new.sender_id
     where kind = 'chat' and dedupe_key = new.thread_id::text and handled_at is null;
    return new;
  end if;

  if new.sender_type <> 'user' then return new; end if;

  select coalesce(nullif(p.full_name, ''), 'Khách hàng') into v_name
    from public.profiles p where p.id = v_customer;

  v_preview := coalesce(nullif(new.body, ''), case when new.attachment_path is not null then 'Đã gửi một tệp đính kèm' else '' end);

  perform public.raise_staff_alert(
    'chat', new.thread_id::text, v_customer,
    coalesce(v_name, 'Khách hàng') || ' nhắn tin',
    left(v_preview, 140),
    new.thread_id, null, null
  );
  return new;
end;
$$;

drop trigger if exists staff_alert_chat_message on public.chat_messages;
create trigger staff_alert_chat_message
  after insert on public.chat_messages
  for each row execute function public.staff_alert_on_chat_message();

-- ---------------------------------------------------------------------------
-- Form review
-- ---------------------------------------------------------------------------
--
-- A clip raises its OWN alert beside the chat one. They are different jobs:
-- the chat alert is answered by typing, this one by watching a video and
-- grading it, and `complete_form_review` is what closes it. Folding them
-- together would let a one-line reply mark a clip as graded.

create or replace function public.staff_alert_on_form_review()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  v_name text;
begin
  if tg_op = 'INSERT' then
    select coalesce(nullif(p.full_name, ''), 'Khách hàng') into v_name
      from public.profiles p where p.id = new.user_id;
    perform public.raise_staff_alert(
      'form_review', new.id::text, new.user_id,
      coalesce(v_name, 'Khách hàng') || ' gửi video chấm dáng tập',
      coalesce(new.day_label, case when new.day_number is not null then 'Ngày ' || new.day_number else 'Bài tập' end),
      new.thread_id, new.id, null
    );
    return new;
  end if;

  if new.status <> 'pending' and old.status = 'pending' then
    update public.staff_alerts
       set handled_at = now(), handled_by = new.reviewed_by
     where kind = 'form_review' and dedupe_key = new.id::text and handled_at is null;
  end if;
  return new;
end;
$$;

drop trigger if exists staff_alert_form_review on public.form_reviews;
create trigger staff_alert_form_review
  after insert or update of status on public.form_reviews
  for each row execute function public.staff_alert_on_form_review();

-- ---------------------------------------------------------------------------
-- Subscriptions
-- ---------------------------------------------------------------------------
--
-- INSERT is a new buyer. The UPDATE arm catches the two changes worth
-- waking somebody for: a refund (the money is going back and access must
-- stop) and a change of tier. An ordinary renewal updates the row too and
-- deliberately raises nothing — a queue that fills with renewals is a queue
-- nobody reads.

create or replace function public.staff_alert_on_subscription()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  v_name text;
  v_plan text;
  v_price bigint;
begin
  select coalesce(nullif(p.full_name, ''), 'Khách hàng') into v_name
    from public.profiles p where p.id = new.user_id;
  select coalesce(nullif(sp.name_vi, ''), new.plan_code), sp.price_amount_vnd into v_plan, v_price
    from public.subscription_plans sp where sp.code = new.plan_code;

  if tg_op = 'UPDATE' and new.revoked_at is not null and old.revoked_at is null then
    perform public.raise_staff_alert(
      'subscription_refund', new.id::text, new.user_id,
      coalesce(v_name, 'Khách hàng') || ' được hoàn tiền ' || coalesce(v_plan, new.plan_code),
      'Quyền lợi đã bị thu hồi tự động. Kiểm tra xem khách có cần hỗ trợ gì không.',
      null, null, new.id
    );
    return new;
  end if;

  if tg_op = 'UPDATE' and new.plan_code = old.plan_code then
    return new;
  end if;

  -- "199.000đ · manual" would read as money that arrived. Nothing arrived
  -- when an admin grants a plan by hand, and this line is the first thing
  -- anyone sees.
  perform public.raise_staff_alert(
    'subscription', new.id::text, new.user_id,
    coalesce(v_name, 'Khách hàng')
      || case when new.platform = 'manual' then ' được cấp ' else ' đăng ký ' end
      || coalesce(v_plan, new.plan_code),
    case when new.platform = 'manual'
         then 'Admin cấp thủ công, không thu tiền qua store'
         else coalesce(replace(to_char(v_price, 'FM999,999,999'), ',', '.') || 'đ · ', '')
              || coalesce(new.platform, '?')
    end,
    null, null, new.id
  );
  return new;
end;
$$;

drop trigger if exists staff_alert_subscription on public.user_subscriptions;
create trigger staff_alert_subscription
  after insert or update on public.user_subscriptions
  for each row execute function public.staff_alert_on_subscription();

-- ---------------------------------------------------------------------------
-- Closing one by hand
-- ---------------------------------------------------------------------------

create or replace function public.handle_staff_alert(p_id uuid)
returns public.staff_alerts
language plpgsql security definer set search_path = public
as $$
declare
  v_row public.staff_alerts;
begin
  if not ('admin' = any (public.current_web_roles()) or 'cskh' = any (public.current_web_roles())) then
    raise exception 'staff_required' using errcode = '42501';
  end if;
  update public.staff_alerts
     set handled_at = now(), handled_by = (select auth.uid())
   where id = p_id and handled_at is null
  returning * into v_row;
  return v_row;
end;
$$;

revoke execute on function public.handle_staff_alert(uuid) from public, anon;
grant execute on function public.handle_staff_alert(uuid) to authenticated;

-- Realtime: the console hears an insert the moment it lands. Without this
-- line the table works perfectly and the browser is told nothing — the
-- publication trap documented in CLAUDE.md.
alter publication supabase_realtime add table public.staff_alerts;
