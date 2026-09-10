-- Make in-app "Delete account" a COMPLETE personal-data erasure, and make the
-- deletion actually stick (the account can no longer sign back in).
--
-- Background: almost every user-owned table is `on delete cascade` from
-- auth.users, i.e. the schema was designed for "delete the auth row and let
-- the cascades clean up". But delete_account deliberately does NOT delete the
-- auth.users row, because orders.activated_by_user_id references it with
-- NO ACTION and orders must be retained for accounting/legal. As a result the
-- cascades never fire, and the previous body only purged 4 tables
-- (water_logs, notifications, push_tokens, user_programs). That left real
-- personal data behind: private support/AI chat, quiz (health survey)
-- answers, likes/saves, hidden/blocked lists, challenge participation, etc.
-- It also left auth.users intact with no block, so a "deleted" user could
-- sign back in (signInWithPassword / Google / Apple all succeed) and land in
-- a scrubbed, empty shell.
--
-- This migration:
--   1. Purges every remaining table that holds this user's personal data.
--   2. Keeps orders + phase_purchases (financial records) and the public
--      posts/comments (content kept, identity scrubbed) exactly as before.
--   3. Bans the auth.users row so no provider (email/Google/Apple) can sign
--      the account back in. The ban is reversible: support can clear
--      banned_until + profiles.deleted_at to restore an account deleted by
--      mistake (matches the "this cannot be undone" copy for the user, while
--      still leaving a manual recovery path for support).

create or replace function public.delete_account()
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_uid uuid := (select auth.uid());
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;

  -- Community engagement this user performed on others' content. Deleting the
  -- likes/saves fires the counter triggers, correctly decrementing the totals.
  delete from post_likes where user_id = v_uid;
  delete from post_saves where user_id = v_uid;
  delete from comment_likes where user_id = v_uid;
  delete from chat_message_reactions where user_id = v_uid;
  delete from hidden_community_posts where user_id = v_uid;
  delete from hidden_community_comments where user_id = v_uid;
  delete from blocked_community_users where blocker_id = v_uid or blocked_id = v_uid;
  delete from challenge_participants where user_id = v_uid;

  -- Private support/AI chat: chat_messages (and the chat notifications) cascade
  -- from chat_threads.
  delete from chat_threads where user_id = v_uid;

  -- Health / survey answers, hydration, per-user access links.
  delete from user_quiz_attempts where user_id = v_uid;
  delete from water_logs where user_id = v_uid;
  delete from user_access_contacts where user_id = v_uid;

  delete from notifications where user_id = v_uid;
  delete from push_tokens where user_id = v_uid;
  -- cascades to user_program_days and pain_logs (both FK ... on delete cascade)
  delete from user_programs where user_id = v_uid;

  -- Public community content stays visible (other members may be mid-thread),
  -- but the identity is scrubbed. author_id -> null so it is no longer linkable
  -- to the (now banned) auth row.
  update community_posts
  set author_id = null, author_name = 'Người dùng đã xoá', author_avatar_url = null
  where author_id = v_uid;

  -- post_comments.author_id is NOT NULL and FK'd to auth.users (which we keep),
  -- so only the denormalized display fields are scrubbed.
  update post_comments
  set author_name = 'Người dùng đã xoá', author_avatar_url = null
  where author_id = v_uid;

  -- Retained on purpose (see Privacy Policy §7 – legal/accounting): orders and
  -- phase_purchases. content_reports (moderation trail) is likewise left; the
  -- reporter is now an unlinkable, scrubbed profile.

  -- Soft-delete + scrub the profile PII.
  update profiles
  set full_name = null,
      email = null,
      phone = null,
      avatar_url = null,
      treatment_area = null,
      goal = null,
      intake_answers = '{}'::jsonb,
      deleted_at = now()
  where id = v_uid;

  -- Make the deletion effective: block every future sign-in for this auth row
  -- (email + OAuth alike). Reversible by support if an account must be restored.
  update auth.users
  -- Concrete far-future timestamp (not 'infinity', which GoTrue's Go time
  -- decoder can reject) — the same shape Supabase's own "ban user" uses.
  set banned_until = timestamptz '9999-12-31 23:59:59+00'
  where id = v_uid;
end;
$function$;
