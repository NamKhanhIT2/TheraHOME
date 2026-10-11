-- Add the customer's avatar to the chat list source. The mobile staff list
-- has always shown real photos; the web one drew a letter because this column
-- was simply not selected.
--
-- avatar_url goes LAST on purpose: CREATE OR REPLACE VIEW can only append
-- columns, never insert one in the middle ("cannot change name of view
-- column" — hit while writing this), so tidy grouping would have meant
-- dropping and recreating the view and re-granting it.
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
  coalesce(unread.count, 0)::int as unread_count,
  p.avatar_url
from public.chat_threads t
left join public.profiles p on p.id = t.user_id
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
  and last.created_at is not null;

grant select on public.chat_thread_overview to authenticated;
