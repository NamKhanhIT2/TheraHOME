-- In-app-only notifications for official TheraHOME posts. This deliberately
-- writes only to the inbox table and never calls an Expo push function.
create or replace function public.notify_official_post_inbox()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.notifications (user_id, type, title, body)
  select profile.id,
         'blog',
         case
           when nullif(btrim(new.tag), '') is null then 'Bài viết mới từ TheraHOME'
           else 'TheraHOME · ' || btrim(new.tag)
         end,
         left(coalesce(new.text, ''), 240)
  from public.profiles profile
  where profile.deleted_at is null;

  return new;
end;
$$;

drop trigger if exists notify_official_post_inbox on public.community_posts;
create trigger notify_official_post_inbox
after insert on public.community_posts
for each row
when (new.is_official = true)
execute function public.notify_official_post_inbox();

-- Chat delivery/read state plus an optional private image attachment.
alter table public.chat_messages
  add column if not exists attachment_path text,
  add column if not exists read_at timestamptz;

-- RLS controls which rows may be marked read; this guard additionally makes
-- every other message field immutable during that update.
create or replace function public.protect_chat_message_read_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.id is distinct from old.id
    or new.thread_id is distinct from old.thread_id
    or new.sender_type is distinct from old.sender_type
    or new.sender_id is distinct from old.sender_id
    or new.body is distinct from old.body
    or new.created_at is distinct from old.created_at
    or new.attachment_path is distinct from old.attachment_path
    or new.read_at is null
    or old.read_at is not null
  then
    raise exception using errcode = '42501', message = 'only_first_read_receipt_update_allowed';
  end if;
  return new;
end;
$$;

drop trigger if exists protect_chat_message_read_update on public.chat_messages;
create trigger protect_chat_message_read_update
before update on public.chat_messages
for each row execute function public.protect_chat_message_read_update();

alter table public.chat_messages enable row level security;

drop policy if exists "users mark specialist messages read" on public.chat_messages;
create policy "users mark specialist messages read"
on public.chat_messages
for update
to authenticated
using (
  sender_type = 'specialist'
  and exists (
    select 1 from public.chat_threads thread
    where thread.id = chat_messages.thread_id
      and thread.user_id = auth.uid()
  )
)
with check (
  sender_type = 'specialist'
  and exists (
    select 1 from public.chat_threads thread
    where thread.id = chat_messages.thread_id
      and thread.user_id = auth.uid()
  )
);

drop policy if exists "staff mark user messages read" on public.chat_messages;
create policy "staff mark user messages read"
on public.chat_messages
for update
to authenticated
using (
  sender_type = 'user'
  and (
    'admin' = any(public.current_web_roles())
    or 'cskh' = any(public.current_web_roles())
  )
)
with check (
  sender_type = 'user'
  and (
    'admin' = any(public.current_web_roles())
    or 'cskh' = any(public.current_web_roles())
  )
);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'chat-attachments',
  'chat-attachments',
  false,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "users upload own chat images" on storage.objects;
create policy "users upload own chat images"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'chat-attachments'
  and split_part(name, '/', 1) = auth.uid()::text
);

drop policy if exists "users read own chat images" on storage.objects;
create policy "users read own chat images"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'chat-attachments'
  and split_part(name, '/', 1) = auth.uid()::text
);

drop policy if exists "staff read chat images" on storage.objects;
create policy "staff read chat images"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'chat-attachments'
  and (
    'admin' = any(public.current_web_roles())
    or 'cskh' = any(public.current_web_roles())
  )
);

drop policy if exists "staff upload chat images" on storage.objects;
create policy "staff upload chat images"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'chat-attachments'
  and (
    'admin' = any(public.current_web_roles())
    or 'cskh' = any(public.current_web_roles())
  )
);
