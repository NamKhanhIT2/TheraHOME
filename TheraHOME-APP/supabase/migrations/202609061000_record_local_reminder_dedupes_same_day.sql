-- The app backfills a "time to work out" inbox row when it opens after the
-- reminder time. The client guard was check-then-act (read an AsyncStorage
-- marker, then insert, then write the marker), so two concurrent calls — the
-- mount call and the AppState 'active' call in _layout.tsx — both read "not
-- yet" and both inserted. Verified in production: duplicate rows 0.00 and
-- 0.01 seconds apart, most recently 2026-09-06.
--
-- The client race is fixed separately; this makes the RPC itself idempotent
-- so a second device, a reinstall (which clears AsyncStorage) or any future
-- caller cannot produce a duplicate either. Same user + same title + same
-- body already recorded today => return the existing row's id.
create or replace function public.record_local_reminder_notification(p_title text, p_body text, p_destination text default null::text)
returns uuid
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_id uuid;
begin
  select n.id into v_id
  from public.notifications n
  where n.user_id = auth.uid()
    and n.type = 'schedule'
    and n.title = p_title
    and n.body = coalesce(p_body, '')
    and n.created_at >= date_trunc('day', now())
  limit 1;
  if v_id is not null then
    return v_id;
  end if;

  insert into public.notifications (user_id, type, title, body, destination)
  values (auth.uid(), 'schedule', p_title, coalesce(p_body, ''), p_destination)
  returning id into v_id;
  return v_id;
end;
$function$;
