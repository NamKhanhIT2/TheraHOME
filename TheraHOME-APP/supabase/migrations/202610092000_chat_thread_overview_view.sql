-- One row per human chat thread: who it is with, its last message, and how
-- many of the customer's messages are still unread.
--
-- Why: the CSKH chat list used to be built by pulling EVERY row of
-- chat_messages into the browser on every realtime event — any message or
-- reaction, in any thread — and deriving the previews client side. That is
-- O(all history) per event, forever, to render ~15 rows of preview text.
--
-- security_invoker so the caller's own RLS still decides what they see: staff
-- (current_web_roles) read every thread, a customer reads only their own.
create or replace view public.chat_thread_overview
with (security_invoker = true) as
select
  t.id,
  t.user_id,
  t.created_at,
  p.full_name,
  p.email,
  p.language,
  p.country,
  last.created_at      as last_message_at,
  last.body            as last_body,
  last.sender_type     as last_sender_type,
  last.attachment_path as last_attachment_path,
  last.deleted_at      as last_deleted_at,
  coalesce(unread.count, 0)::int as unread_count
from public.chat_threads t
left join public.profiles p on p.id = t.user_id
-- chat_messages_thread_created_idx makes both of these an index lookup.
left join lateral (
  select m.created_at, m.body, m.sender_type, m.attachment_path, m.deleted_at
  from public.chat_messages m
  where m.thread_id = t.id
  order by m.created_at desc
  limit 1
) last on true
left join lateral (
  select count(*) as count
  from public.chat_messages m
  where m.thread_id = t.id and m.sender_type = 'user' and m.read_at is null
) unread on true
where t.kind = 'human'
  -- A thread is created the moment a customer OPENS the chat screen; one with
  -- no messages is not a conversation and has never been listed.
  and last.created_at is not null;

grant select on public.chat_thread_overview to authenticated;
