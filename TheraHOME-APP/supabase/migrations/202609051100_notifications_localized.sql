-- Notifications spoke Vietnamese to everyone. Owner rule 2026-09-05: wording
-- follows the recipient's APP LANGUAGE (profiles.language); which official
-- post a user gets follows their MARKET (profiles.country). This migration
-- localizes every DB-generated notification at insert time. Social titles
-- (reactions/comments/replies) are ALSO re-rendered by the app from the
-- structured columns (actor_name, second_actor_name, group_actor_ids) so
-- they follow the user's current language even for old rows.

-- One place for the fixed copy, so the three languages sit side by side.
create or replace function public.notification_copy(p_language text, p_key text, p_n integer default null)
returns table(title text, body text)
language sql immutable set search_path to ''
as $$
  select
    case p_key
      when 'next_day' then case p_language when 'en' then 'Time for today''s workout' when 'ms' then 'Masa untuk senaman hari ini' else 'Đến giờ tập hôm nay' end
      when 'streak' then case p_language when 'en' then p_n || '-day streak! 🔥' when 'ms' then 'Rentetan ' || p_n || ' hari! 🔥' else 'Chuỗi ' || p_n || ' ngày liên tiếp! 🔥' end
      when 'moderation_approved' then case p_language when 'en' then 'Your post was approved' when 'ms' then 'Siaran anda telah diluluskan' else 'Bài viết đã được duyệt' end
      when 'moderation_rejected' then case p_language when 'en' then 'Your post was not approved' when 'ms' then 'Siaran anda tidak diluluskan' else 'Bài viết chưa được duyệt' end
      when 'specialist' then case p_language when 'en' then 'TheraHOME Specialist' when 'ms' then 'Pakar TheraHOME' else 'Chuyên gia TheraHOME' end
      when 'attachment' then case p_language when 'en' then 'Sent an attachment' when 'ms' then 'Menghantar lampiran' else 'Đã gửi một tệp đính kèm' end
      when 'image' then case p_language when 'en' then 'Sent a photo' when 'ms' then 'Menghantar gambar' else 'Đã gửi một ảnh' end
      when 'new_official_post' then case p_language when 'en' then 'New post from TheraHOME' when 'ms' then 'Siaran baharu daripada TheraHOME' else 'Bài viết mới từ TheraHOME' end
      else p_key end,
    case p_key
      when 'next_day' then case p_language when 'en' then 'Day ' || p_n || ' is waiting for you' when 'ms' then 'Hari ' || p_n || ' menanti anda' else 'Ngày ' || p_n || ' đang chờ bạn' end
      when 'streak' then case p_language when 'en' then 'You have kept your roadmap going for ' || p_n || ' days. Share it with the community?' when 'ms' then 'Anda telah mengekalkan pelan selama ' || p_n || ' hari. Kongsi dengan komuniti?' else 'Bạn đã duy trì lộ trình ' || p_n || ' ngày. Chia sẻ thành tích với cộng đồng?' end
      when 'moderation_approved' then case p_language when 'en' then 'Your post has been approved and is now visible to the community.' when 'ms' then 'Siaran anda telah diluluskan dan kini dipaparkan kepada komuniti.' else 'Bài viết của bạn đã được duyệt và hiển thị với cộng đồng.' end
      when 'moderation_rejected' then case p_language when 'en' then 'Your post is not suitable for the community. You can edit it and post again.' when 'ms' then 'Siaran anda tidak sesuai untuk komuniti. Anda boleh mengeditnya dan menyiarkan semula.' else 'Bài viết của bạn chưa phù hợp để hiển thị với cộng đồng. Bạn có thể chỉnh sửa và đăng lại.' end
      else null end;
$$;

create or replace function public.profile_language(p_user_id uuid)
returns text language sql stable security definer set search_path to ''
as $$ select coalesce((select language from public.profiles where id = p_user_id), 'vi'); $$;

-- 1. Official post inbox: only the targeted MARKETS, and each market's own
--    variant (VN base as fallback). Used to fan out the Vietnamese base to
--    every profile regardless of target_markets.
create or replace function public.notify_official_post_inbox()
returns trigger language plpgsql security definer set search_path to ''
as $$
begin
  if not new.is_official or not new.notify_enabled then
    return new;
  end if;
  insert into public.notifications (user_id, type, title, body, related_post_id, destination, actor_name, actor_is_official)
  select profile.id,
         'blog',
         coalesce(
           nullif(btrim(case m.market when 'US' then coalesce(new.title_us, new.title) when 'MALAY' then coalesce(new.title_malay, new.title) else new.title end), ''),
           (select c.title from public.notification_copy(coalesce(profile.language, 'vi'), 'new_official_post') c)),
         left(coalesce(case m.market when 'US' then coalesce(new.text_us, new.text) when 'MALAY' then coalesce(new.text_malay, new.text) else new.text end, ''), 240),
         new.id, 'community_post', 'TheraHOME', true
  from public.profiles profile
  cross join lateral (
    select coalesce(profile.country, case profile.language when 'en' then 'US' when 'ms' then 'MALAY' else 'VN' end) as market
  ) m
  where profile.deleted_at is null
    and profile.locked = false
    and (new.target_markets is null or cardinality(new.target_markets) = 0 or m.market = any(new.target_markets));
  return new;
end;
$$;

-- 2. Chat inbox: specialist label + attachment placeholder in the CUSTOMER's
--    language; staff-facing rows stay Vietnamese (staff are Vietnamese).
create or replace function public.notify_chat_message_inbox()
returns trigger language plpgsql security definer set search_path to ''
as $$
declare
  v_user_id uuid;
  v_lang text;
  v_specialist text;
  v_preview_user text;
  v_preview_staff text;
begin
  select thread.user_id into v_user_id from public.chat_threads thread where thread.id = new.thread_id;
  if v_user_id is null or new.sender_type = 'ai' then
    return new;
  end if;
  v_lang := public.profile_language(v_user_id);
  select c.title into v_specialist from public.notification_copy(v_lang, 'specialist') c;
  v_preview_user := coalesce(nullif(btrim(new.body), ''), (select c.title from public.notification_copy(v_lang, 'attachment') c));
  v_preview_staff := coalesce(nullif(btrim(new.body), ''), 'Đã gửi một tệp đính kèm');

  if new.sender_type = 'specialist' then
    insert into public.notifications (user_id, type, title, body, related_chat_thread_id, destination, actor_name, actor_is_official)
    values (v_user_id, 'chat', v_specialist, left(v_preview_user, 240), new.thread_id, 'chat', v_specialist, true);
  elsif new.sender_type = 'user' then
    insert into public.notifications (user_id, type, title, body, related_chat_thread_id, destination, actor_id, actor_name, actor_avatar_url)
    select staff.claimed_by_user_id, 'chat', 'Tin nhắn hỗ trợ mới', left(v_preview_staff, 240), new.thread_id, 'chat',
           profile.id, coalesce(profile.full_name, profile.email, 'Người dùng TheraHOME'), profile.avatar_url
    from public.web_access_contacts staff
    join public.profiles profile on profile.id = v_user_id
    where staff.disabled = false
      and staff.claimed_by_user_id is not null
      and ('admin' = any(staff.roles) or 'cskh' = any(staff.roles));
  end if;
  return new;
end;
$$;

-- 3. Comment / reply: the "sent a photo" placeholder in each recipient's
--    language (the title is re-rendered by the app from actor_name).
create or replace function public.notify_post_comment_event()
returns trigger language plpgsql security definer set search_path to ''
as $$
declare
  v_post_author_id uuid;
  v_parent_author_id uuid;
  v_preview text;
  v_formatted record;
begin
  select author_id into v_post_author_id from public.community_posts where id = new.post_id;

  if v_post_author_id is not null and v_post_author_id <> new.author_id then
    v_preview := public.truncate_with_ellipsis(coalesce(nullif(new.text, ''), (select c.title from public.notification_copy(public.profile_language(v_post_author_id), 'image') c)), 100);
    select * into v_formatted from public.format_community_notification('post_comment', new.author_name, null, 1, v_preview);
    insert into public.notifications (
      user_id, type, title, body, push_title, push_body, related_post_id, related_comment_id,
      related_parent_comment_id, destination, actor_id, actor_name, actor_avatar_url
    ) values (
      v_post_author_id, 'post_comment', v_formatted.title, v_formatted.body, v_formatted.push_title, v_formatted.push_body,
      new.post_id, new.id, new.parent_comment_id, 'community_post', new.author_id, new.author_name, new.author_avatar_url
    );
  end if;

  if new.parent_comment_id is not null then
    select author_id into v_parent_author_id from public.post_comments where id = new.parent_comment_id;
    if v_parent_author_id is not null and v_parent_author_id <> new.author_id and v_parent_author_id <> v_post_author_id then
      v_preview := public.truncate_with_ellipsis(coalesce(nullif(new.text, ''), (select c.title from public.notification_copy(public.profile_language(v_parent_author_id), 'image') c)), 100);
      select * into v_formatted from public.format_community_notification('comment_reply', new.author_name, null, 1, v_preview);
      insert into public.notifications (
        user_id, type, title, body, push_title, push_body, related_post_id, related_comment_id,
        related_parent_comment_id, destination, actor_id, actor_name, actor_avatar_url
      ) values (
        v_parent_author_id, 'comment_reply', v_formatted.title, v_formatted.body, v_formatted.push_title, v_formatted.push_body,
        new.post_id, new.id, new.parent_comment_id, 'community_post', new.author_id, new.author_name, new.author_avatar_url
      );
    end if;
  end if;
  return new;
end;
$$;

-- 4. Moderation result in the author's language.
create or replace function public.notify_post_moderation()
returns trigger language plpgsql security definer set search_path to 'public'
as $$
declare
  v_lang text;
  v_copy record;
begin
  if old.status = 'pending' and new.status in ('approved','rejected') and not new.is_official then
    v_lang := public.profile_language(new.author_id);
    if new.status = 'approved' then
      select * into v_copy from public.notification_copy(v_lang, 'moderation_approved');
      insert into notifications (user_id, type, title, body, destination, related_post_id, push_title, push_body)
      values (new.author_id, 'post_moderation', v_copy.title, v_copy.body, 'community_post', new.id, v_copy.title, v_copy.body);
    else
      select * into v_copy from public.notification_copy(v_lang, 'moderation_rejected');
      insert into notifications (user_id, type, title, body, destination, push_title, push_body)
      values (new.author_id, 'post_moderation', v_copy.title, v_copy.body, 'community', v_copy.title, v_copy.body);
    end if;
  end if;
  return new;
end $$;

-- 5. Next-day + streak rows written by complete_day / mark_day_watched.
create or replace function public.complete_day(p_user_program_id uuid, p_program_day_id uuid, p_pain_score integer)
returns void language plpgsql security definer set search_path to 'public'
as $$
declare
  v_program user_programs%rowtype;
  v_day_number integer;
  v_next_user_program_day_id uuid;
  v_next_program_day_id uuid;
  v_next_day_number integer;
  v_next_phase_locked boolean := false;
  v_done_count integer;
  v_total_days integer;
  v_new_streak integer;
  v_lang text;
  v_copy record;
begin
  select * into v_program from user_programs where id = p_user_program_id and user_id = auth.uid();
  if not found then
    raise exception 'not_authorized';
  end if;
  v_lang := public.profile_language(auth.uid());

  insert into pain_logs (user_id, user_program_id, program_day_id, score)
  values (auth.uid(), p_user_program_id, p_program_day_id, p_pain_score);

  update user_program_days set status = 'done', completed_at = now()
  where user_program_id = p_user_program_id and program_day_id = p_program_day_id;

  select day_number into v_day_number from program_days where id = p_program_day_id;

  select upd.id, pd.id, pd.day_number
  into v_next_user_program_day_id, v_next_program_day_id, v_next_day_number
  from user_program_days upd
  join program_days pd on pd.id = upd.program_day_id
  where upd.user_program_id = p_user_program_id and pd.day_number = v_day_number + 1;

  if v_next_user_program_day_id is not null then
    update user_program_days set status = 'current' where id = v_next_user_program_day_id;

    select exists (
      select 1 from program_days pd join phase_promos pp on pp.phase_id = pd.phase_id
      where pd.id = v_next_program_day_id and (pp.apple_product_id is not null or pp.google_product_id is not null)
    ) and not exists (
      select 1 from program_days pd join phase_purchases ph on ph.phase_id = pd.phase_id
      where pd.id = v_next_program_day_id and ph.user_id = auth.uid() and ph.revoked_at is null
    ) into v_next_phase_locked;

    if not v_next_phase_locked then
      select * into v_copy from public.notification_copy(v_lang, 'next_day', v_next_day_number);
      insert into notifications (user_id, type, title, body, related_day_id, related_product_id)
      values (auth.uid(), 'schedule', v_copy.title, v_copy.body, v_next_program_day_id, v_program.product_id);
    end if;
  end if;

  select count(*) filter (where status = 'done'), count(*) into v_done_count, v_total_days
  from user_program_days where user_program_id = p_user_program_id;

  select total_days into v_total_days from products where id = v_program.product_id;

  update user_programs
  set current_day = least(v_day_number + 1, v_total_days),
      adherence_pct = round(v_done_count::numeric / greatest(v_day_number, 1) * 100),
      streak = streak + 1
  where id = p_user_program_id
  returning streak into v_new_streak;

  if v_new_streak = any(array[7, 14, 21, 28]) then
    select * into v_copy from public.notification_copy(v_lang, 'streak', v_new_streak);
    insert into notifications (user_id, type, title, body) values (auth.uid(), 'streak_milestone', v_copy.title, v_copy.body);
  end if;
end;
$$;

create or replace function public.mark_day_watched(p_user_program_id uuid, p_program_day_id uuid)
returns boolean language plpgsql security definer set search_path to 'public'
as $$
declare
  v_program user_programs%rowtype;
  v_day program_days%rowtype;
  v_elapsed integer;
  v_newly boolean := false;
  v_total_days integer;
  v_unlocked integer;
  v_done integer;
  v_streak integer;
  v_prev_streak integer;
  v_is_review boolean;
  v_copy record;
begin
  select * into v_program from user_programs where id = p_user_program_id and user_id = auth.uid();
  if not found then
    raise exception 'not_authorized';
  end if;

  select * into v_day from program_days where id = p_program_day_id;
  if not found or v_day.product_id <> v_program.product_id then
    raise exception 'day_not_in_program';
  end if;

  select account_type = 'review' into v_is_review from profiles where id = auth.uid();

  -- Calendar gate, +1 day of slack so client-local midnight vs. server UTC
  -- never wrongly rejects "today". App Review accounts are exempt.
  v_elapsed := (now()::date - v_program.activated_at::date);
  if v_day.day_number > v_elapsed + 2 and not coalesce(v_is_review, false) then
    raise exception 'day_not_unlocked';
  end if;

  update user_program_days
     set status = 'done', completed_at = coalesce(completed_at, now())
   where user_program_id = p_user_program_id
     and program_day_id = p_program_day_id
     and status <> 'done';
  v_newly := found;

  if not exists (
    select 1 from user_program_days where user_program_id = p_user_program_id and program_day_id = p_program_day_id
  ) then
    insert into user_program_days (user_program_id, program_day_id, status, completed_at)
    values (p_user_program_id, p_program_day_id, 'done', now());
    v_newly := true;
  end if;

  if not v_newly then
    return false;
  end if;

  select total_days into v_total_days from products where id = v_program.product_id;
  v_unlocked := least(greatest(v_elapsed + 1, 1), coalesce(v_total_days, 1));

  select count(*) into v_done
  from user_program_days upd join program_days pd on pd.id = upd.program_day_id
  where upd.user_program_id = p_user_program_id and upd.status = 'done';

  -- Streak = the terminal consecutive run of watched days (rest days count
  -- as satisfied so they don't break a run).
  with ok_days as (
    select pd.day_number
    from user_program_days upd join program_days pd on pd.id = upd.program_day_id
    where upd.user_program_id = p_user_program_id and (upd.status = 'done' or pd.day_type = 'rest')
  )
  select count(*) into v_streak
  from ok_days a
  where not exists (
    select 1 from generate_series(a.day_number, (select max(day_number) from ok_days)) g
    where g not in (select day_number from ok_days)
  );

  v_prev_streak := v_program.streak;
  update user_programs
     set adherence_pct = least(round(v_done::numeric / greatest(v_unlocked, 1) * 100), 100),
         streak = coalesce(v_streak, 0)
   where id = p_user_program_id;

  if coalesce(v_streak, 0) > coalesce(v_prev_streak, 0) and v_streak = any(array[7, 14, 21, 28]) then
    select * into v_copy from public.notification_copy(public.profile_language(auth.uid()), 'streak', v_streak);
    insert into notifications (user_id, type, title, body) values (auth.uid(), 'streak_milestone', v_copy.title, v_copy.body);
  end if;

  return true;
end;
$$;
