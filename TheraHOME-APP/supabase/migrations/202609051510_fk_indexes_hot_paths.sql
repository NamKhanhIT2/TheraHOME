-- Performance advisor 2026-09-05: unindexed foreign keys. Only the columns
-- that are actually filtered/joined at runtime (feed, inbox, cascades,
-- insights, moderation). Audit-trail columns (*_updated_by / *_created_by)
-- are never filtered and are left alone on purpose.
create index if not exists notifications_related_post_id_idx on public.notifications (related_post_id);
create index if not exists notifications_actor_id_idx on public.notifications (actor_id);
create index if not exists notifications_related_parent_comment_id_idx on public.notifications (related_parent_comment_id);
create index if not exists notifications_upsell_campaign_id_idx on public.notifications (upsell_campaign_id);
create index if not exists phase_purchases_phase_id_idx on public.phase_purchases (phase_id);
create index if not exists user_quiz_attempts_phase_id_idx on public.user_quiz_attempts (phase_id);
create index if not exists user_quiz_attempts_user_program_id_idx on public.user_quiz_attempts (user_program_id);
create index if not exists challenge_participants_user_id_idx on public.challenge_participants (user_id);
create index if not exists chat_messages_reply_to_message_id_idx on public.chat_messages (reply_to_message_id);
create index if not exists chat_message_reactions_user_id_idx on public.chat_message_reactions (user_id);
create index if not exists content_reports_reporter_id_idx on public.content_reports (reporter_id);
create index if not exists hidden_community_posts_post_id_idx on public.hidden_community_posts (post_id);
create index if not exists hidden_community_comments_comment_id_idx on public.hidden_community_comments (comment_id);
create index if not exists blocked_community_users_blocked_id_idx on public.blocked_community_users (blocked_id);
create index if not exists product_activation_contacts_claimed_by_user_id_idx on public.product_activation_contacts (claimed_by_user_id);
