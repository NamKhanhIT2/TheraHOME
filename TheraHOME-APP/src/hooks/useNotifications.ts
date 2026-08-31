// Phase 6: real notification inbox, replacing the Phase 1 mock array in
// useAppStore. Writers: the `complete_day` RPC (`schedule` for the
// newly-unlocked day, `streak_milestone` at 7/14/21/28-day marks),
// `notify_official_post_inbox` (`blog`, broadcast on official posts), and
// the Community-expansion triggers `notify_post_comment_event`/
// `notify_post_like_event` (`comment`/`reply`/`like`) — see
// community_moderation_and_notifications migration. See CLAUDE.md.
import { useEffect, useRef } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@/lib/supabase';
import { TEST_BLOG_ARTICLE_ID } from '@/lib/officialArticles';

export type NotificationType =
  | 'schedule' | 'inactivity' | 'ad' | 'blog' | 'chat' | 'streak_milestone'
  | 'post_reaction' | 'post_comment' | 'comment_reply' | 'comment_reaction'
  | 'post_moderation';

export interface NotificationRow {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  read: boolean;
  createdAt: string;
  relatedDayNumber: number | null;
  relatedProductId: string | null;
  relatedArticleId: string | null;
  relatedPostId: string | null;
  relatedCommentId: string | null;
  relatedParentCommentId: string | null;
  relatedChatThreadId: string | null;
  destination: string | null;
  actorId: string | null;
  actorName: string | null;
  actorAvatarUrl: string | null;
  actorIsOfficial: boolean;
  /** Reaction emoji key (heart/like/haha/celebrate/support) — the small
   * overlay icon on the actor's avatar for post_reaction/comment_reaction. */
  reactionType: string | null;
  /** Every distinct person folded into a grouped reaction notification —
   * `groupActorIds.length` is the group's total count. */
  groupActorIds: string[];
  /** Second actor's name, only populated (and only shown) when the group
   * has exactly 2 members — 3+ collapses to "và N người khác" instead. */
  secondActorName: string | null;
  /** Post's image, if any — shown as a small thumbnail alongside the row. */
  postImageUrl: string | null;
}

const TEST_PREFIX = 'local-test-blog-';
const NOTIFICATION_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;
const testStorageKey = (userId: string) => `therahome:test-notifications:${userId}`;

function retentionCutoff() {
  return new Date(Date.now() - NOTIFICATION_RETENTION_MS).toISOString();
}

async function readLocalNotifications(userId: string): Promise<NotificationRow[]> {
  const raw = await AsyncStorage.getItem(testStorageKey(userId));
  if (!raw) return [];
  try {
    const stored = JSON.parse(raw) as NotificationRow[];
    const active = stored.filter((row) => row.createdAt >= retentionCutoff());
    if (active.length !== stored.length) await writeLocalNotifications(userId, active);
    return active;
  } catch { return []; }
}

async function writeLocalNotifications(userId: string, rows: NotificationRow[]) {
  await AsyncStorage.setItem(testStorageKey(userId), JSON.stringify(rows));
}

export async function createTestBlogInboxNotification(userId: string, title: string, body: string) {
  const rows = await readLocalNotifications(userId);
  const notification: NotificationRow = {
    id: `${TEST_PREFIX}${Date.now()}`,
    type: 'blog', title, body, read: false,
    createdAt: new Date().toISOString(),
    relatedDayNumber: null, relatedProductId: null,
    relatedArticleId: TEST_BLOG_ARTICLE_ID, relatedPostId: null, relatedCommentId: null, relatedParentCommentId: null, relatedChatThreadId: null, destination: 'community_post',
    actorId: null, actorName: 'TheraHOME', actorAvatarUrl: null, actorIsOfficial: true,
    reactionType: null, groupActorIds: [], secondActorName: null, postImageUrl: null,
  };
  await writeLocalNotifications(userId, [notification, ...rows].slice(0, 10));
}

interface RawNotification {
  id: string;
  type: string;
  title: string;
  body: string | null;
  read: boolean;
  created_at: string;
  related_product_id: string | null;
  related_post_id: string | null;
  related_comment_id: string | null;
  related_parent_comment_id: string | null;
  related_chat_thread_id: string | null;
  destination: string | null;
  actor_id: string | null;
  actor_name: string | null;
  actor_avatar_url: string | null;
  actor_is_official: boolean | null;
  reaction_type: string | null;
  group_actor_ids: string[] | null;
  second_actor_name: string | null;
  program_days: { day_number: number } | null;
  community_posts: { image_url: string | null } | null;
}

export function useNotifications(userId: string | undefined) {
  const queryClient = useQueryClient();
  const key = ['notifications', userId] as const;
  const channelId = useRef(`notifications_${Math.random().toString(36).slice(2)}`);

  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(`${channelId.current}_${userId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` },
        () => {
          queryClient.invalidateQueries({ queryKey: key });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, queryClient]);

  return useQuery({
    queryKey: key,
    queryFn: async (): Promise<NotificationRow[]> => {
      const cutoff = retentionCutoff();
      // The UI expiry is guaranteed by the `gte` filter. This delete is a
      // best-effort physical cleanup until a scheduled backend cleanup job
      // is added with the admin service.
      await supabase
        .from('notifications')
        .delete()
        .eq('user_id', userId!)
        .lt('created_at', cutoff);
      const { data, error } = await supabase
        .from('notifications')
        .select('id, type, title, body, read, created_at, destination, actor_id, actor_name, actor_avatar_url, actor_is_official, reaction_type, group_actor_ids, second_actor_name, related_product_id, related_post_id, related_comment_id, related_parent_comment_id, related_chat_thread_id, program_days(day_number), community_posts(image_url)')
        .eq('user_id', userId!)
        .gte('created_at', cutoff)
        .order('created_at', { ascending: false });
      if (error) throw error;
      const remoteRows = (data as unknown as RawNotification[]).map((r) => ({
        id: r.id,
        type: r.type as NotificationType,
        title: r.title,
        body: r.body ?? '',
        read: r.read,
        createdAt: r.created_at,
        relatedDayNumber: r.program_days?.day_number ?? null,
        relatedProductId: r.related_product_id,
        relatedArticleId: null,
        relatedPostId: r.related_post_id,
        relatedCommentId: r.related_comment_id,
        relatedParentCommentId: r.related_parent_comment_id,
        relatedChatThreadId: r.related_chat_thread_id,
        destination: r.destination,
        actorId: r.actor_id,
        actorName: r.actor_name,
        actorAvatarUrl: r.actor_avatar_url,
        actorIsOfficial: r.actor_is_official ?? false,
        reactionType: r.reaction_type,
        groupActorIds: r.group_actor_ids ?? [],
        secondActorName: r.second_actor_name,
        postImageUrl: r.community_posts?.image_url ?? null,
      }));
      const localRows = await readLocalNotifications(userId!);
      return [...localRows, ...remoteRows].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    },
    enabled: !!userId,
  });
}

export function useMarkNotificationRead(userId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      if (id.startsWith(TEST_PREFIX)) {
        const rows = await readLocalNotifications(userId!);
        await writeLocalNotifications(userId!, rows.map((row) => row.id === id ? { ...row, read: true } : row));
        return;
      }
      const { error } = await supabase.from('notifications').update({ read: true }).eq('id', id);
      if (error) throw error;
    },
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ['notifications', userId] });
      const previous = queryClient.getQueryData<NotificationRow[]>(['notifications', userId]);
      queryClient.setQueryData<NotificationRow[]>(['notifications', userId], (rows) => rows?.map((row) => row.id === id ? { ...row, read: true } : row));
      return { previous };
    },
    onError: (_error, _id, context) => {
      if (context?.previous) queryClient.setQueryData(['notifications', userId], context.previous);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications', userId] });
    },
  });
}

export function useMarkAllNotificationsRead(userId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const localRows = await readLocalNotifications(userId!);
      await writeLocalNotifications(userId!, localRows.map((row) => ({ ...row, read: true })));
      const { error } = await supabase
        .from('notifications')
        .update({ read: true })
        .eq('user_id', userId!)
        .eq('read', false);
      if (error) throw error;
    },
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ['notifications', userId] });
      const previous = queryClient.getQueryData<NotificationRow[]>(['notifications', userId]);
      queryClient.setQueryData<NotificationRow[]>(['notifications', userId], (rows) => rows?.map((row) => ({ ...row, read: true })));
      return { previous };
    },
    onError: (_error, _input, context) => {
      if (context?.previous) queryClient.setQueryData(['notifications', userId], context.previous);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications', userId] }),
  });
}

export function useDeleteNotification(userId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      if (id.startsWith(TEST_PREFIX)) {
        const rows = await readLocalNotifications(userId!);
        await writeLocalNotifications(userId!, rows.filter((row) => row.id !== id));
        return;
      }
      const { error } = await supabase.from('notifications').delete().eq('id', id).eq('user_id', userId!);
      if (error) throw error;
    },
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ['notifications', userId] });
      const previous = queryClient.getQueryData<NotificationRow[]>(['notifications', userId]);
      queryClient.setQueryData<NotificationRow[]>(['notifications', userId], (rows) => rows?.filter((row) => row.id !== id));
      return { previous };
    },
    onError: (_error, _id, context) => {
      if (context?.previous) queryClient.setQueryData(['notifications', userId], context.previous);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications', userId] }),
  });
}

// ---------------------------------------------------------------------------
// CSKH "Thông báo" tab (app/(staff)/notifications.tsx) — a simple broadcast
// composer/history. Mirrors TheraHOME WEB's fetchNotificationCampaigns/
// sendNotificationBroadcast (src/lib/db.ts) — real `notifications` rows are
// per-user, so a "campaign" here is a batch inserted with the same
// type/title/body/created_at, grouped back together for display since
// there's no separate broadcast-log table. Restricted to the 3 broadcast
// types WEB itself composes manually (schedule/ad/blog) — the others
// (chat/streak_milestone/post_reaction/...) are system-generated and expect
// related_* fields this simple form doesn't collect.
export type BroadcastNotificationType = 'schedule' | 'ad' | 'blog';

export interface NotificationCampaign {
  key: string;
  type: BroadcastNotificationType;
  title: string;
  body: string;
  createdAt: string;
  reach: number;
}

export function useNotificationCampaigns() {
  return useQuery({
    queryKey: ['notification_campaigns'],
    queryFn: async (): Promise<NotificationCampaign[]> => {
      const { data, error } = await supabase
        .from('notifications')
        .select('type, title, body, created_at')
        .order('created_at', { ascending: false })
        .limit(500);
      if (error) throw error;
      const groups = new Map<string, NotificationCampaign>();
      for (const row of data ?? []) {
        const key = `${row.type}|${row.title}|${row.body}|${row.created_at}`;
        const existing = groups.get(key);
        if (existing) {
          existing.reach += 1;
        } else {
          groups.set(key, { key, type: row.type as BroadcastNotificationType, title: row.title, body: row.body ?? '', createdAt: row.created_at, reach: 1 });
        }
      }
      return Array.from(groups.values());
    },
  });
}

export function useSendNotificationBroadcast() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { type: BroadcastNotificationType; title: string; body: string }): Promise<number> => {
      const { data: profiles, error: profilesError } = await supabase.from('profiles').select('id').is('deleted_at', null);
      if (profilesError) throw profilesError;
      const userIds = (profiles ?? []).map((r) => r.id);
      if (!userIds.length) return 0;
      const createdAt = new Date().toISOString();
      const { error } = await supabase
        .from('notifications')
        .insert(userIds.map((user_id) => ({ user_id, type: input.type, title: input.title, body: input.body, created_at: createdAt })));
      if (error) throw error;
      void supabase.functions.invoke('dispatch-push', {
        body: { mode: 'broadcast', userIds, title: input.title, body: input.body, data: { type: input.type } },
      });
      return userIds.length;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notification_campaigns'] }),
  });
}
