// Phase 5: real chat — realtime threads for both the AI assistant (Claude,
// via the `chat-ai-reply` Edge Function) and the human specialist thread
// (scaffolding only — see CLAUDE.md for what still needs a Customer Care
// client to actually reply). Replaces the Phase 1 mock canned-reply logic
// in app/chat/ai.tsx and app/chat/human.tsx.
import { useEffect, useRef } from 'react';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient, type InfiniteData } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

export type ChatKind = 'ai' | 'human';

/** Finds (or creates) the user's single open thread of this kind. Threads
 * are never closed by the client today, so in practice this reuses the same
 * thread across app sessions. */
export function useChatThread(kind: ChatKind, userId: string | undefined) {
  return useQuery({
    queryKey: ['chat_thread', kind, userId],
    queryFn: async (): Promise<string> => {
      const { data: existing, error: selectError } = await supabase
        .from('chat_threads')
        .select('id')
        .eq('user_id', userId!)
        .eq('kind', kind)
        .neq('status', 'closed')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (selectError) throw selectError;
      if (existing) return existing.id;

      const { data: created, error: insertError } = await supabase
        .from('chat_threads')
        .insert({ user_id: userId!, kind })
        .select('id')
        .single();
      if (insertError) throw insertError;
      return created.id;
    },
    enabled: !!userId,
    staleTime: Infinity,
  });
}

export interface ChatMessageRow {
  id: string;
  senderType: 'user' | 'ai' | 'specialist';
  body: string;
  createdAt: string;
  attachmentPath: string | null;
  imageUrl: string | null;
  attachmentKind: 'image' | 'video' | null;
  readAt: string | null;
  editedAt: string | null;
  deletedAt: string | null;
  replyToMessageId: string | null;
  reactions: { id: string; userId: string; emoji: string }[];
}

const CHAT_PAGE_SIZE = 30;
type ChatMessagesPage = { messages: ChatMessageRow[]; nextOffset: number | null };
type ChatMessagesData = InfiniteData<ChatMessagesPage, number>;

export function useChatMessages(threadId: string | undefined) {
  const queryClient = useQueryClient();
  const key = ['chat_messages', threadId] as const;
  const channelId = useRef(`chat_messages_${Math.random().toString(36).slice(2)}`);

  useEffect(() => {
    if (!threadId) return;
    const channel = supabase
      .channel(`${channelId.current}_${threadId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'chat_messages', filter: `thread_id=eq.${threadId}` },
        () => {
          queryClient.invalidateQueries({ queryKey: key });
        },
      )
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chat_message_reactions' }, () => {
        queryClient.invalidateQueries({ queryKey: key });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [threadId, queryClient]);

  return useInfiniteQuery({
    queryKey: key,
    initialPageParam: 0,
    queryFn: async ({ pageParam }): Promise<ChatMessagesPage> => {
      const { data, error } = await supabase
        .from('chat_messages')
        .select('id, sender_type, body, created_at, attachment_path, read_at, edited_at, deleted_at, reply_to_message_id')
        .eq('thread_id', threadId!)
        .order('created_at', { ascending: false })
        .range(pageParam, pageParam + CHAT_PAGE_SIZE - 1);
      if (error) throw error;
      const ids = data.map((row) => row.id);
      const { data: reactions, error: reactionError } = ids.length
        ? await supabase.from('chat_message_reactions').select('id, message_id, user_id, emoji').in('message_id', ids)
        : { data: [], error: null };
      if (reactionError) throw reactionError;
      const messages = await Promise.all(data.map(async (r) => {
        let imageUrl: string | null = null;
        const attachmentKind = r.attachment_path?.match(/\.(mp4|mov|m4v|webm)(?:$|\?)/i) ? 'video' as const : r.attachment_path ? 'image' as const : null;
        if (r.attachment_path) {
          const { data: signed } = await supabase.storage.from('chat-attachments').createSignedUrl(r.attachment_path, 3600);
          imageUrl = signed?.signedUrl ?? null;
        }
        return {
          id: r.id,
          senderType: r.sender_type as ChatMessageRow['senderType'],
          body: r.body,
          createdAt: r.created_at,
          attachmentPath: r.attachment_path,
          imageUrl,
          attachmentKind,
          readAt: r.read_at,
          editedAt: r.edited_at,
          deletedAt: r.deleted_at,
          replyToMessageId: r.reply_to_message_id,
          reactions: (reactions ?? []).filter((reaction) => reaction.message_id === r.id).map((reaction) => ({
            id: reaction.id,
            userId: reaction.user_id,
            emoji: reaction.emoji,
          })),
        };
      }));
      return { messages, nextOffset: data.length === CHAT_PAGE_SIZE ? pageParam + CHAT_PAGE_SIZE : null };
    },
    getNextPageParam: (lastPage) => lastPage.nextOffset,
    enabled: !!threadId,
  });
}

/** Sends a user message; for `kind: 'ai'` threads, also invokes the
 * `chat-ai-reply` Edge Function and waits for it to insert Claude's reply
 * (which then arrives at the caller through `useChatMessages`'s realtime
 * subscription, same as any other row). */
export interface SendChatMessageInput {
  body: string;
  attachmentPath?: string | null;
  replyToMessageId?: string | null;
}

/** `senderType` defaults to 'user' for the existing AI/patient-side callers;
 * the admin conversations thread passes 'specialist' so CSKH staff replies
 * post as the specialist instead of impersonating the patient. */
export function useSendChatMessage(threadId: string | undefined, userId: string | undefined, kind: ChatKind, senderType: 'user' | 'specialist' = 'user') {
  const queryClient = useQueryClient();
  const key = ['chat_messages', threadId] as const;
  return useMutation({
    onMutate: async (input: string | SendChatMessageInput) => {
      const message: SendChatMessageInput = typeof input === 'string' ? { body: input } : input;
      const previous = queryClient.getQueryData<ChatMessagesData>(key);
      const attachmentPath = message.attachmentPath ?? null;
      const optimistic: ChatMessageRow = {
        id: `pending-${Date.now()}`,
        senderType,
        body: message.body,
        createdAt: new Date().toISOString(),
        attachmentPath,
        imageUrl: null,
        attachmentKind: attachmentPath?.match(/\.(mp4|mov|m4v|webm)(?:$|\?)/i) ? 'video' : attachmentPath ? 'image' : null,
        readAt: null,
        editedAt: null,
        deletedAt: null,
        replyToMessageId: message.replyToMessageId ?? null,
        reactions: [],
      };

      queryClient.setQueryData<ChatMessagesData>(key, (current) => {
        if (!current) return current;
        return {
          ...current,
          pages: current.pages.map((page, index) => index === 0
            ? { ...page, messages: [optimistic, ...page.messages] }
            : page),
        };
      });
      return { previous };
    },
    mutationFn: async (input: string | SendChatMessageInput) => {
      const message: SendChatMessageInput = typeof input === 'string' ? { body: input } : input;
      const { error } = await supabase
        .from('chat_messages')
        .insert({
          thread_id: threadId!,
          sender_type: senderType,
          sender_id: userId!,
          body: message.body,
          attachment_path: message.attachmentPath ?? null,
          reply_to_message_id: message.replyToMessageId ?? null,
        });
      if (error) throw error;

      if (kind === 'ai') {
        const { error: fnError } = await supabase.functions.invoke('chat-ai-reply', {
          body: { thread_id: threadId },
        });
        if (fnError) throw fnError;
      } else {
        void supabase.functions.invoke('dispatch-push', {
          body: { mode: 'chat', threadId, senderType, preview: message.body || 'Đã gửi một ảnh' },
        });
      }
    },
    onError: (_error, _input, context) => {
      if (context?.previous) queryClient.setQueryData(key, context.previous);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: key });
    },
  });
}

export async function editChatMessage(messageId: string, body: string): Promise<void> {
  const { error } = await supabase.from('chat_messages').update({ body, edited_at: new Date().toISOString() }).eq('id', messageId);
  if (error) throw error;
}

export async function deleteChatMessage(messageId: string): Promise<void> {
  const { error } = await supabase.from('chat_messages').update({ deleted_at: new Date().toISOString() }).eq('id', messageId);
  if (error) throw error;
}

export async function toggleChatReaction(messageId: string, userId: string, emoji: string, currentReaction?: { id: string; emoji: string }): Promise<void> {
  if (currentReaction?.emoji === emoji) {
    const { error } = await supabase.from('chat_message_reactions').delete().eq('id', currentReaction.id);
    if (error) throw error;
    return;
  }

  // The live RLS policy deliberately permits a user to insert/delete their
  // own reaction. Replacing an existing one with `upsert` follows the UPDATE
  // path and is rejected by that policy, so replace it through the permitted
  // delete + insert operations instead.
  if (currentReaction) {
    const { error: deleteError } = await supabase
      .from('chat_message_reactions')
      .delete()
      .eq('id', currentReaction.id);
    if (deleteError) throw deleteError;
  }
  const { error: insertError } = await supabase
    .from('chat_message_reactions')
    .insert({ message_id: messageId, user_id: userId, emoji });
  if (insertError) throw insertError;
}

export async function uploadChatAttachment(userId: string, threadId: string, uri: string, mimeType?: string | null): Promise<string> {
  const extension = uri.split('.').pop()?.split('?')[0]?.toLowerCase() || (mimeType?.startsWith('video/') ? 'mp4' : 'jpg');
  const path = `${userId}/${threadId}/${Date.now()}.${extension}`;
  const response = await fetch(uri);
  const bytes = await response.arrayBuffer();
  const contentType = mimeType ?? (extension === 'png' ? 'image/png' : extension === 'webp' ? 'image/webp' : extension === 'mov' ? 'video/quicktime' : extension === 'mp4' || extension === 'm4v' ? 'video/mp4' : 'image/jpeg');
  const { error } = await supabase.storage.from('chat-attachments').upload(path, bytes, { contentType });
  if (error) throw error;
  return path;
}

/** Kept for existing callers outside the human specialist chat. */
export const uploadChatImage = uploadChatAttachment;

export async function markSpecialistMessagesRead(threadId: string): Promise<void> {
  const { error } = await supabase
    .from('chat_messages')
    .update({ read_at: new Date().toISOString() })
    .eq('thread_id', threadId)
    .eq('sender_type', 'specialist')
    .is('read_at', null);
  if (error) throw error;
}

/** Admin/cskh-side counterpart — marks the patient's messages as read once
 * staff opens the thread (RLS's "staff mark user messages read" policy). */
export async function markUserMessagesRead(threadId: string): Promise<void> {
  const { error } = await supabase
    .from('chat_messages')
    .update({ read_at: new Date().toISOString() })
    .eq('thread_id', threadId)
    .eq('sender_type', 'user')
    .is('read_at', null);
  if (error) throw error;
}

/** The patient a given `kind: 'human'` thread belongs to — used by the
 * admin thread screen's header, which (unlike the patient's own screen)
 * doesn't already know who it's talking to. */
export function useChatThreadPatient(threadId: string | undefined) {
  return useQuery({
    queryKey: ['chat_thread_patient', threadId],
    queryFn: async (): Promise<{ userId: string; fullName: string; avatarUrl: string | null }> => {
      const { data: thread, error } = await supabase.from('chat_threads').select('user_id').eq('id', threadId!).single();
      if (error) throw error;
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('full_name, avatar_url')
        .eq('id', thread.user_id)
        .maybeSingle();
      if (profileError) throw profileError;
      return { userId: thread.user_id, fullName: profile?.full_name ?? 'Người dùng', avatarUrl: profile?.avatar_url ?? null };
    },
    enabled: !!threadId,
  });
}

export interface AdminChatThreadRow {
  threadId: string;
  userId: string;
  fullName: string;
  avatarUrl: string | null;
  lastMessage: string;
  lastMessageAt: string;
  unreadCount: number;
}

/** All active patient↔specialist threads, for the admin/cskh "Chat" list —
 * `chat_threads`/`chat_messages`/`profiles` RLS already grants staff
 * (`current_web_roles()` returning 'admin'/'cskh') read access to every
 * row, not just their own, so this is a plain unfiltered query. Threads
 * with no messages yet (a patient opened the screen but never sent
 * anything — `useChatThread` creates the row eagerly) are left out; there's
 * nothing useful to show for them yet. */
export function useAdminChatThreads() {
  const queryClient = useQueryClient();
  const channelId = useRef(`admin_chat_threads_${Math.random().toString(36).slice(2)}`);
  const key = ['admin_chat_threads'] as const;

  useEffect(() => {
    const channel = supabase
      .channel(channelId.current)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chat_messages' }, () => {
        queryClient.invalidateQueries({ queryKey: key });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  return useQuery({
    queryKey: key,
    queryFn: async (): Promise<AdminChatThreadRow[]> => {
      const { data: threads, error } = await supabase.from('chat_threads').select('id, user_id').eq('kind', 'human');
      if (error) throw error;
      if (!threads.length) return [];
      const threadIds = threads.map((t) => t.id);
      const { data: messages, error: messagesError } = await supabase
        .from('chat_messages')
        .select('thread_id, sender_type, body, attachment_path, created_at, read_at')
        .in('thread_id', threadIds)
        .order('created_at', { ascending: false });
      if (messagesError) throw messagesError;
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url')
        .in('id', threads.map((t) => t.user_id));
      if (profilesError) throw profilesError;
      const profileById = new Map((profiles ?? []).map((p) => [p.id, p]));

      const lastMessageByThread = new Map<string, (typeof messages)[number]>();
      const unreadByThread = new Map<string, number>();
      for (const message of messages ?? []) {
        if (!lastMessageByThread.has(message.thread_id)) lastMessageByThread.set(message.thread_id, message);
        if (message.sender_type === 'user' && !message.read_at) {
          unreadByThread.set(message.thread_id, (unreadByThread.get(message.thread_id) ?? 0) + 1);
        }
      }

      return threads
        .filter((thread) => lastMessageByThread.has(thread.id))
        .map((thread) => {
          const last = lastMessageByThread.get(thread.id)!;
          const profile = profileById.get(thread.user_id);
          return {
            threadId: thread.id,
            userId: thread.user_id,
            fullName: profile?.full_name ?? 'Người dùng',
            avatarUrl: profile?.avatar_url ?? null,
            lastMessage: last.body || (last.attachment_path ? 'Đã gửi tệp đính kèm' : ''),
            lastMessageAt: last.created_at,
            unreadCount: unreadByThread.get(thread.id) ?? 0,
          };
        })
        .sort((a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime());
    },
    refetchInterval: 30000,
  });
}

/**
 * Product rule: the TheraHOME specialist is always shown as available.
 *
 * No shared Realtime Presence channel is needed here.  A fixed channel name
 * can be reused while Fast Refresh is active, causing Supabase to reject
 * callbacks registered after the channel has subscribed.
 */
export function useSpecialistPresence(): boolean {
  return true;
}

export interface AISuggestedReply {
  id: string;
  text: string;
}

const FALLBACK_AI_SUGGESTIONS: AISuggestedReply[] = [
  { id: 'fallback-1', text: 'Tôi bị đau khi tập' },
  { id: 'fallback-2', text: 'Đổi lịch nhắc tập' },
  { id: 'fallback-3', text: 'Lộ trình của tôi thế nào?' },
];

/** Admin-curated suggestion chips shown in the empty AI chat state. Falls
 * back to a small hardcoded list so the UI never shows nothing (e.g. before
 * the DB has any active rows). */
export function useAISuggestedReplies() {
  return useQuery({
    queryKey: ['ai_suggested_replies'],
    queryFn: async (): Promise<AISuggestedReply[]> => {
      const { data, error } = await supabase
        .from('ai_suggested_replies')
        .select('id, text')
        .eq('active', true)
        .order('sort_order', { ascending: true });
      if (error) throw error;
      return data.length ? data : FALLBACK_AI_SUGGESTIONS;
    },
    placeholderData: FALLBACK_AI_SUGGESTIONS,
    staleTime: 5 * 60 * 1000,
  });
}
