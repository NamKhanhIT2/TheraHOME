-- Performance advisor 2026-09-05 (auth_rls_initplan): these 8 policies call
-- auth.uid() bare, so Postgres re-evaluates it per row. Wrapping it in
-- (select auth.uid()) makes it an InitPlan evaluated once per query. Pure
-- rewrite — every predicate is byte-for-byte the same otherwise.

drop policy if exists "users read own access contact" on public.user_access_contacts;
create policy "users read own access contact" on public.user_access_contacts
  for select to authenticated using (user_id = (select auth.uid()));

drop policy if exists "own phase_purchases select" on public.phase_purchases;
create policy "own phase_purchases select" on public.phase_purchases
  for select using (user_id = (select auth.uid()));

drop policy if exists "own user_quiz_attempts" on public.user_quiz_attempts;
create policy "own user_quiz_attempts" on public.user_quiz_attempts
  for all using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

drop policy if exists "users remove own reactions" on public.chat_message_reactions;
create policy "users remove own reactions" on public.chat_message_reactions
  for delete to authenticated using (user_id = (select auth.uid()));

drop policy if exists "chat participants read reactions" on public.chat_message_reactions;
create policy "chat participants read reactions" on public.chat_message_reactions
  for select to authenticated using (
    exists (
      select 1 from public.chat_messages message
      join public.chat_threads thread on thread.id = message.thread_id
      where message.id = chat_message_reactions.message_id
        and (thread.user_id = (select auth.uid())
             or 'admin' = any(public.current_web_roles())
             or 'cskh' = any(public.current_web_roles()))
    )
  );

drop policy if exists "chat participants add reactions" on public.chat_message_reactions;
create policy "chat participants add reactions" on public.chat_message_reactions
  for insert to authenticated with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.chat_messages message
      join public.chat_threads thread on thread.id = message.thread_id
      where message.id = chat_message_reactions.message_id
        and (thread.user_id = (select auth.uid())
             or 'admin' = any(public.current_web_roles())
             or 'cskh' = any(public.current_web_roles()))
    )
  );

drop policy if exists "users edit own chat messages" on public.chat_messages;
create policy "users edit own chat messages" on public.chat_messages
  for update to authenticated
  using (
    sender_type = 'user' and sender_id = (select auth.uid())
    and exists (select 1 from public.chat_threads thread where thread.id = chat_messages.thread_id and thread.user_id = (select auth.uid()))
  )
  with check (sender_type = 'user' and sender_id = (select auth.uid()));

drop policy if exists "users mark specialist messages read" on public.chat_messages;
create policy "users mark specialist messages read" on public.chat_messages
  for update to authenticated
  using (
    sender_type = 'specialist'
    and exists (select 1 from public.chat_threads thread where thread.id = chat_messages.thread_id and thread.user_id = (select auth.uid()))
  )
  with check (
    sender_type = 'specialist'
    and exists (select 1 from public.chat_threads thread where thread.id = chat_messages.thread_id and thread.user_id = (select auth.uid()))
  );
