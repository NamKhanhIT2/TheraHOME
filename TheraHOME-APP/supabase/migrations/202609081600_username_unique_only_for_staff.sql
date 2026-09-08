-- Owner's call (2026-09-08): a customer's username is a display name and may
-- repeat — customers sign in by email, not by name. But the app also has
-- admin-issued accounts (admin, cskh, review, tester, admin_issued) that sign
-- in BY username, on the web console and the app's TheraHOME-account screen,
-- and those still have to be unique or the username→account lookup is
-- ambiguous.
--
-- So uniqueness is narrowed to the staff accounts rather than dropped. A
-- customer taking a name an admin already uses is fine (they never collide —
-- the lookup only ever considers staff rows, see auth-sign-in), and two
-- customers sharing a name is fine too.

drop index if exists public.profiles_username_unique_idx;

-- `coalesce` because a brand-new row's account_type is the column default
-- ('normal') at the instant the trigger inserts it, and only promoted to a
-- staff type afterwards by admin-manage-account — at which point THIS index is
-- what rejects a promotion onto a name another staff member already holds.
create unique index profiles_staff_username_unique_idx
  on public.profiles (lower(username))
  where username is not null and coalesce(account_type, 'normal') <> 'normal';

-- Self-service signup no longer needs a free name, only a well-formed one, so
-- the trigger drops its duplicate check and keeps the shape check. Staff
-- uniqueness is the partial index above; nothing here enforces it, because at
-- insert time every account still looks 'normal'.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_username text := nullif(btrim(new.raw_user_meta_data->>'username'), '');
begin
  if v_username is not null and not public.username_is_wellformed(v_username) then
    raise exception using errcode = '22023', message = 'username_invalid';
  end if;

  insert into public.profiles (id, email, full_name, avatar_url, username)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'),
    new.raw_user_meta_data->>'avatar_url',
    v_username
  );
  return new;
end;
$function$;

-- is_username_available answered "is this name free?", which no longer has a
-- meaning for a customer name that is allowed to repeat. Drop it rather than
-- leave a function whose answer the app must now ignore.
drop function if exists public.is_username_available(text);
