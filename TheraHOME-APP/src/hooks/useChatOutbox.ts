import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { create } from 'zustand';
import { requestAIReply, sendChatMessageRequest, type ChatKind, type ChatMessageRow, type SendChatMessageInput } from '@/hooks/useChat';
import { useChatConnected } from '@/lib/chatConnection';

/**
 * The queue a chat message sits in until the server has it.
 *
 * The screens used to send optimistically straight into the react-query
 * cache and roll that back on failure, which meant a failed send deleted the
 * user's own bubble — the typed text, and any photo they had picked, gone,
 * with only an alert to say so. Everything the user composed now lives here
 * instead, survives the failure, and can be sent again with one tap.
 *
 * Module-level so a send that is still in flight is not abandoned when the
 * screen unmounts, and so a queued message is still queued when the user
 * comes back to the thread.
 */
export interface ChatOutboxEntry {
  id: string;
  threadId: string;
  senderType: 'user' | 'specialist';
  input: SendChatMessageInput;
  status: 'sending' | 'failed';
  createdAt: string;
  /** Automatic retries spent on reconnect. Capped so a message failing for a
   * reason the network cannot fix does not retry forever in the background. */
  autoAttempts: number;
}

const MAX_AUTO_ATTEMPTS = 2;

interface ChatOutboxState {
  entries: ChatOutboxEntry[];
  add: (entry: ChatOutboxEntry) => void;
  patch: (id: string, patch: Partial<ChatOutboxEntry>) => void;
  remove: (id: string) => void;
}

const useChatOutboxStore = create<ChatOutboxState>((set) => ({
  entries: [],
  add: (entry) => set((state) => ({ entries: [...state.entries, entry] })),
  patch: (id, patch) =>
    set((state) => ({ entries: state.entries.map((entry) => (entry.id === id ? { ...entry, ...patch } : entry)) })),
  remove: (id) => set((state) => ({ entries: state.entries.filter((entry) => entry.id !== id) })),
}));

let sequence = 0;

/** Shapes a queued entry like any other message so one bubble component can
 * render both, rather than each screen growing a second code path. */
function toRow(entry: ChatOutboxEntry): ChatMessageRow {
  return {
    id: entry.id,
    senderType: entry.senderType,
    body: entry.input.body,
    createdAt: entry.createdAt,
    attachmentPath: null,
    imageUrl: entry.input.attachmentLocalUri ?? null,
    attachmentKind: entry.input.attachmentKind ?? null,
    readAt: null,
    editedAt: null,
    deletedAt: null,
    replyToMessageId: entry.input.replyToMessageId ?? null,
    reactions: [],
    outboxId: entry.id,
    sendStatus: entry.status,
  };
}

export function useChatOutbox(
  threadId: string | undefined,
  userId: string | undefined,
  kind: ChatKind,
  senderType: 'user' | 'specialist' = 'user',
) {
  const queryClient = useQueryClient();
  const entries = useChatOutboxStore((state) => state.entries);
  const add = useChatOutboxStore((state) => state.add);
  const patch = useChatOutboxStore((state) => state.patch);
  const remove = useChatOutboxStore((state) => state.remove);
  const connected = useChatConnected();
  const wasConnected = useRef(connected);
  // The assistant answering is a separate job from the message going out —
  // the question is already saved by the time this turns true.
  const [aiReplying, setAiReplying] = useState(false);
  const [aiFailed, setAiFailed] = useState(false);

  const mine = useMemo(
    () => entries.filter((entry) => entry.threadId === threadId),
    [entries, threadId],
  );

  const run = useCallback(
    async (entry: ChatOutboxEntry) => {
      if (!threadId || !userId) return;
      patch(entry.id, { status: 'sending' });
      try {
        await sendChatMessageRequest({ threadId, userId, kind, senderType, input: entry.input });
        remove(entry.id);
        // The row is on the server now; realtime usually beats this, but a
        // refetch is what makes the queued bubble swap for the real one even
        // when the socket is the thing that was broken.
        await queryClient.invalidateQueries({ queryKey: ['chat_messages', threadId] });
      } catch {
        patch(entry.id, { status: 'failed' });
        return;
      }
      if (kind !== 'ai') return;
      setAiFailed(false);
      setAiReplying(true);
      try {
        await requestAIReply(threadId);
        await queryClient.invalidateQueries({ queryKey: ['chat_messages', threadId] });
      } catch {
        // The question is saved either way — this only means no answer came
        // back, which is its own retry, not a resend.
        setAiFailed(true);
      } finally {
        setAiReplying(false);
      }
    },
    [threadId, userId, kind, senderType, patch, remove, queryClient],
  );

  const retryAIReply = useCallback(async () => {
    if (!threadId) return;
    setAiFailed(false);
    setAiReplying(true);
    try {
      await requestAIReply(threadId);
      await queryClient.invalidateQueries({ queryKey: ['chat_messages', threadId] });
    } catch {
      setAiFailed(true);
    } finally {
      setAiReplying(false);
    }
  }, [threadId, queryClient]);

  const send = useCallback(
    (input: SendChatMessageInput) => {
      if (!threadId || !userId) return;
      sequence += 1;
      const entry: ChatOutboxEntry = {
        id: `outbox-${Date.now()}-${sequence}`,
        threadId,
        senderType,
        input,
        status: 'sending',
        createdAt: new Date().toISOString(),
        autoAttempts: 0,
      };
      add(entry);
      void run(entry);
    },
    [threadId, userId, senderType, add, run],
  );

  const retry = useCallback(
    (id: string) => {
      const entry = useChatOutboxStore.getState().entries.find((item) => item.id === id);
      // A manual retry clears the automatic budget: the user asking again is
      // a fresh decision, not a continuation of the background attempts.
      if (entry) void run({ ...entry, autoAttempts: 0 });
    },
    [run],
  );

  const discard = useCallback((id: string) => remove(id), [remove]);

  // Coming back online is the moment a message that failed because the
  // network was gone can actually go out, which is what the offline notice
  // promises the user will happen.
  useEffect(() => {
    const reconnected = connected && !wasConnected.current;
    wasConnected.current = connected;
    if (!reconnected) return;
    for (const entry of useChatOutboxStore.getState().entries) {
      if (entry.threadId !== threadId || entry.status !== 'failed') continue;
      if (entry.autoAttempts >= MAX_AUTO_ATTEMPTS) continue;
      patch(entry.id, { autoAttempts: entry.autoAttempts + 1 });
      void run({ ...entry, autoAttempts: entry.autoAttempts + 1 });
    }
  }, [connected, threadId, patch, run]);

  /** Newest first, to sit at the head of an inverted list. */
  const rows = useMemo(
    () => mine.map(toRow).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [mine],
  );

  return {
    rows,
    send,
    retry,
    discard,
    /** True while at least one message of this thread is still going out. */
    sending: mine.some((entry) => entry.status === 'sending'),
    /** AI threads only: the assistant is composing an answer. */
    aiReplying,
    /** AI threads only: the answer never arrived and can be asked for again. */
    aiFailed,
    retryAIReply,
  };
}
