-- App Review accounts' community posts publish immediately.
--
-- Owner's call (2026-09-11): Apple's reviewer must be able to post and see the
-- result without a human moderator in the loop. Moderation status is decided
-- ENTIRELY here on the server — this BEFORE INSERT trigger overwrites whatever
-- the client sends, the app inserts no status at all, and visibility is the RLS
-- policy "public read posts" (status = 'approved' or own post). So this is a
-- DB-only change: the already-submitted iOS build 21 (and every older build)
-- picks it up with no rebuild, and the app's data-driven "Đang chờ duyệt"
-- banner (community/index.tsx reads community_posts.status) simply never shows
-- for these posts.
--
-- Deliberately NOT touched: the post-submit alert in app/community/create.tsx
-- is hard-coded client copy ("sẽ hiển thị sau khi được TheraHOME duyệt") and
-- will still show for review accounts — accepted as cosmetic to avoid a rebuild.
--
-- Keyed on the row's author (RLS already forces author_id = auth.uid() for app
-- inserts) and read under SECURITY DEFINER, so profiles RLS is irrelevant.
-- Content-safety and rate-limit triggers still run; only the status decision
-- changes. notify_post_moderation fires only on UPDATE pending->approved, so an
-- insert-time approve sends the reviewer no self-notification.

create or replace function public.set_post_moderation_status()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
begin
  if new.is_official
     or 'admin' = any (current_web_roles())
     or 'cskh'  = any (current_web_roles())
     or exists (
       select 1 from public.profiles p
       where p.id = new.author_id and p.account_type = 'review'
     ) then
    new.status := 'approved';
  else
    new.status := 'pending';
  end if;
  return new;
end $function$;
