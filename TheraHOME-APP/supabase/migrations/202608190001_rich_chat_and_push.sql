-- Rich chat: reply, edit, soft-delete, reactions, pagination indexes.
alter table public.chat_messages
  add column if not exists reply_to_message_id uuid references public.chat_messages(id) on delete set null,
  add column if not exists edited_at timestamptz,
  add column if not exists deleted_at timestamptz;

create index if not exists chat_messages_thread_created_idx
  on public.chat_messages(thread_id, created_at desc);

create table if not exists public.chat_message_reactions (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.chat_messages(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  emoji text not null check (char_length(emoji) between 1 and 16),
  created_at timestamptz not null default now(),
  unique (message_id, user_id)
);

alter table public.chat_message_reactions enable row level security;

drop policy if exists "chat participants read reactions" on public.chat_message_reactions;
create policy "chat participants read reactions"
on public.chat_message_reactions for select to authenticated
using (
  exists (
    select 1
    from public.chat_messages message
    join public.chat_threads thread on thread.id = message.thread_id
    where message.id = chat_message_reactions.message_id
      and (
        thread.user_id = auth.uid()
        or 'admin' = any(public.current_web_roles())
        or 'cskh' = any(public.current_web_roles())
      )
  )
);

drop policy if exists "chat participants add reactions" on public.chat_message_reactions;
create policy "chat participants add reactions"
on public.chat_message_reactions for insert to authenticated
with check (
  user_id = auth.uid()
  and exists (
    select 1
    from public.chat_messages message
    join public.chat_threads thread on thread.id = message.thread_id
    where message.id = chat_message_reactions.message_id
      and (
        thread.user_id = auth.uid()
        or 'admin' = any(public.current_web_roles())
        or 'cskh' = any(public.current_web_roles())
      )
  )
);

drop policy if exists "users remove own reactions" on public.chat_message_reactions;
create policy "users remove own reactions"
on public.chat_message_reactions for delete to authenticated
using (user_id = auth.uid());

drop policy if exists "users edit own chat messages" on public.chat_messages;
create policy "users edit own chat messages"
on public.chat_messages for update to authenticated
using (
  sender_type = 'user'
  and sender_id = auth.uid()
  and exists (
    select 1 from public.chat_threads thread
    where thread.id = chat_messages.thread_id and thread.user_id = auth.uid()
  )
)
with check (sender_type = 'user' and sender_id = auth.uid());

drop policy if exists "staff edit specialist chat messages" on public.chat_messages;
create policy "staff edit specialist chat messages"
on public.chat_messages for update to authenticated
using (
  sender_type = 'specialist'
  and ('admin' = any(public.current_web_roles()) or 'cskh' = any(public.current_web_roles()))
)
with check (
  sender_type = 'specialist'
  and ('admin' = any(public.current_web_roles()) or 'cskh' = any(public.current_web_roles()))
);

-- Replace the read-only guard from the previous migration. Identity,
-- ownership, attachment and reply target remain immutable after insert.
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
    or new.created_at is distinct from old.created_at
    or new.attachment_path is distinct from old.attachment_path
    or new.reply_to_message_id is distinct from old.reply_to_message_id
  then
    raise exception using errcode = '42501', message = 'immutable_chat_message_fields';
  end if;

  if new.body is distinct from old.body and new.edited_at is null then
    raise exception using errcode = '42501', message = 'edited_at_required';
  end if;
  if (
    new.body is distinct from old.body
    or new.deleted_at is distinct from old.deleted_at
    or new.edited_at is distinct from old.edited_at
  ) and (
    (old.sender_type = 'user' and old.sender_id is distinct from auth.uid())
    or (
      old.sender_type = 'specialist'
      and not ('admin' = any(public.current_web_roles()) or 'cskh' = any(public.current_web_roles()))
    )
  ) then
    raise exception using errcode = '42501', message = 'message_owner_update_required';
  end if;
  if old.deleted_at is not null and new.deleted_at is distinct from old.deleted_at then
    raise exception using errcode = '42501', message = 'deleted_message_is_immutable';
  end if;
  if old.read_at is not null and new.read_at is distinct from old.read_at then
    raise exception using errcode = '42501', message = 'read_receipt_is_immutable';
  end if;
  return new;
end;
$$;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'chat_message_reactions'
  ) then
    alter publication supabase_realtime add table public.chat_message_reactions;
  end if;
end $$;
