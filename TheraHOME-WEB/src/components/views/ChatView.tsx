"use client";

// Real data: chat_threads / chat_messages (kind='human'), replying as
// sender_type='specialist' — the missing piece the mobile app's own
// CLAUDE.md flagged ("no specialist client exists yet"). Also tracks
// Presence on the specialist-presence channel while this screen is
// mounted, so the mobile app's useSpecialistPresence() indicator lights up
// for real. chat_messages is already in the supabase_realtime publication.
import { Fragment, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import Image from "next/image";
import { supabase } from "@/lib/supabase";
import { deleteSpecialistMessage, editSpecialistMessage, fetchChatThreads, fetchThreadMessages, markThreadMessagesRead, searchChatThreadIds, sendSpecialistMessage, toggleSpecialistReaction, uploadSpecialistChatImage } from "@/lib/db";
import type { ChatMessage, ChatThread } from "@/lib/adminMockData";
import { Avatar, inputStyle } from "@/components/ui/primitives";

/** Customer's app language + market at a glance, so the specialist answers
 * in the language the customer actually reads (the AI assistant follows the
 * same profiles.language; CSKH is a human, so it needs to be visible). */
const LANG_LABEL: Record<string, string> = { vi: "Tiếng Việt", en: "English", ms: "Bahasa Melayu" };
const MARKET_LABEL: Record<string, string> = { VN: "VN", US: "UK", MALAY: "ML" };
// "US" is the DB code for the UK/EU market; the label shown is "UK".
type ChatMarketFilter = "ALL" | "VN" | "US" | "MALAY";
const CHAT_MARKET_TABS: Array<[ChatMarketFilter, string]> = [
  ["ALL", "Mọi thị trường"],
  ["VN", "VN"],
  ["US", "UK"],
  ["MALAY", "ML"],
];
function LangBadge({ thread, compact = false }: { thread: ChatThread; compact?: boolean }) {
  const lang = thread.language ?? "vi";
  const highlight = lang !== "vi";
  return (
    <span
      title={`Khách đọc app bằng ${LANG_LABEL[lang] ?? lang}${thread.country ? ` · thị trường ${MARKET_LABEL[thread.country] ?? thread.country}` : ""}`}
      style={{
        fontSize: compact ? 10.5 : 11.5,
        fontWeight: 700,
        padding: compact ? "1px 6px" : "2px 8px",
        borderRadius: 999,
        color: highlight ? "#B9860B" : "var(--text-muted)",
        background: highlight ? "rgba(185,134,11,0.12)" : "rgba(138,147,163,0.12)",
        whiteSpace: "nowrap",
      }}
    >
      {LANG_LABEL[lang] ?? lang}{thread.country && !compact ? ` · ${MARKET_LABEL[thread.country] ?? thread.country}` : ""}
    </span>
  );
}
import { Icon } from "@/components/ui/Icon";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { pushToast } from "@/components/ui/Toast";

/** The line under the name in the list. Messenger, Zalo and Telegram all show
 * the same three things here, and the old version showed only the first: the
 * last message's text, marked as yours when you sent it, and described in
 * words when it has no text of its own — a photo-only reply used to leave the
 * row blank, which reads as "nothing happened" when something did. */
function threadPreview(t: ChatThread): string {
  const body = t.lastDeleted
    ? "Tin nhắn đã được xoá"
    : t.lastBody || (t.lastAttachmentKind === "video" ? "[Video]" : t.lastAttachmentKind === "image" ? "[Hình ảnh]" : "");
  return t.lastFrom === "admin" ? `Bạn: ${body}` : body;
}

const menuItemStyle: CSSProperties = {
  display: "block",
  width: "100%",
  textAlign: "left",
  border: 0,
  background: "none",
  padding: "8px 6px",
  cursor: "pointer",
  fontFamily: "var(--font-family)",
  fontSize: 13,
  color: "var(--text-primary)",
};

/** "Hôm nay" / "Hôm qua" / "T2, 6/10" — the divider every chat app puts
 * between days, so a conversation spanning weeks does not read as one
 * unbroken afternoon. */
function dayLabel(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const startOf = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const days = Math.round((startOf(today) - startOf(d)) / 86400000);
  if (days === 0) return "Hôm nay";
  if (days === 1) return "Hôm qua";
  if (days < 7) return d.toLocaleDateString("vi-VN", { weekday: "long", day: "numeric", month: "numeric" });
  return d.toLocaleDateString("vi-VN", { day: "numeric", month: "numeric", year: "numeric" });
}
function sameDay(a?: string, b?: string): boolean {
  if (!a || !b) return false;
  return new Date(a).toDateString() === new Date(b).toDateString();
}

/** Tallest the composer grows before it scrolls instead — about six lines. */
const COMPOSER_MAX_H = 132;

export function ChatView() {
  const [threads, setThreads] = useState<ChatThread[] | null>(null);
  /** Only the thread being read — the list no longer carries everybody's
   * messages, which is the whole point of the change. Stored WITH the id it
   * belongs to and read back through it, so a slow response for the thread
   * you just left can never paint itself into the one you just opened. */
  const [loaded, setLoaded] = useState<{ threadId: string; items: ChatMessage[] } | null>(null);
  const [searchHits, setSearchHits] = useState<Set<string> | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "unread">("all");
  // Market filter (2026-09-06): `country` already rides along on every
  // thread, so a specialist who handles one market can work just that inbox
  // instead of scanning the badges. Threads whose customer never confirmed a
  // country have none, and are only shown under "Tất cả".
  const [marketFilter, setMarketFilter] = useState<ChatMarketFilter>("ALL");
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [attachment, setAttachment] = useState<File | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ChatMessage | null>(null);
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
  const [editing, setEditing] = useState<ChatMessage | null>(null);
  const [actionMessage, setActionMessage] = useState<ChatMessage | null>(null);
  const [showEmoji, setShowEmoji] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const draftRef = useRef<HTMLTextAreaElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  /** Whether the reader is parked at the bottom of the conversation. Decides
   * if an arriving message should pull the view down with it. */
  const nearBottomRef = useRef(true);
  const activeIdRef = useRef<string | null>(null);
  useEffect(() => {
    activeIdRef.current = activeId;
  }, [activeId]);

  function reloadMessages(threadId: string | null) {
    if (!threadId) return;
    fetchThreadMessages(threadId)
      .then((items) => setLoaded({ threadId, items }))
      .catch(() => pushToast("Không thể tải tin nhắn"));
  }

  function reload() {
    fetchChatThreads()
      .then((ts) => {
        setThreads(ts);
        if (!activeIdRef.current && ts.length) setActiveId(ts[0].id);
      })
      .catch(() => pushToast("Không thể tải danh sách chat"));
  }

  useEffect(() => {
    reload();
    void supabase.auth.getUser().then(({ data }) => setCurrentUserId(data.user?.id ?? null));

    const messagesChannel = supabase
      .channel("cskh-chat-messages")
      .on("postgres_changes", { event: "*", schema: "public", table: "chat_messages" }, (payload) => {
        reload();
        // Only re-read the open conversation when the change belongs to it;
        // a message in someone else's thread changes the list, not this pane.
        const row = (payload.new ?? payload.old) as { thread_id?: string } | null;
        if (!row?.thread_id || row.thread_id === activeIdRef.current) reloadMessages(activeIdRef.current);
      })
      .subscribe();
    // A reaction changes a bubble, never the list's preview or unread count.
    const reactionsChannel = supabase.channel("cskh-chat-reactions").on("postgres_changes", { event: "*", schema: "public", table: "chat_message_reactions" }, () => reloadMessages(activeIdRef.current)).subscribe();

    const presenceChannel = supabase.channel("specialist-presence");
    presenceChannel.subscribe((status) => {
      if (status === "SUBSCRIBED") presenceChannel.track({ role: "specialist" });
    });

    return () => {
      supabase.removeChannel(messagesChannel);
      supabase.removeChannel(reactionsChannel);
      supabase.removeChannel(presenceChannel);
    };
  }, []);

  // Message bodies are searched too, not just names: "ai hỏi về gối?" is the
  // question a specialist actually has, and the customer's name is the one
  // thing they do not know when they ask it.
  const needle = search.trim().toLowerCase();
  const list = (threads ?? []).filter(
    (t) =>
      (filter !== "unread" || t.unread) &&
      (marketFilter === "ALL" || t.country === marketFilter) &&
      (!needle ||
        t.user.toLowerCase().includes(needle) ||
        t.lastBody.toLowerCase().includes(needle) ||
        (searchHits?.has(t.id) ?? false)),
  );
  const active = threads?.find((t) => t.id === activeId);
  const messages = loaded?.threadId === activeId ? loaded.items : [];

  // Also depends on `active.unread`, which is the fix: this used to run only
  // when you SWITCHED threads, so a message arriving while you were reading
  // that very thread left its blue dot on. Marking read clears the flag, so
  // the effect settles after one pass instead of looping.
  useEffect(() => {
    if (!activeId || !active?.unread) return;
    markThreadMessagesRead(activeId).then(reload).catch(() => pushToast("Không thể cập nhật trạng thái đã xem"));
  }, [activeId, active?.unread]);

  // Searching message bodies has to happen in Postgres now: the browser only
  // holds the open conversation. Debounced, and every setState sits inside
  // the timer so none of it runs synchronously during the effect.
  useEffect(() => {
    const term = search.trim();
    let cancelled = false;
    const timer = setTimeout(() => {
      if (cancelled) return;
      if (term.length < 2) {
        setSearchHits(null);
        return;
      }
      searchChatThreadIds(term)
        .then((ids) => { if (!cancelled) setSearchHits(new Set(ids)); })
        .catch(() => { if (!cancelled) setSearchHits(new Set()); });
    }, 250);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [search]);

  // Load the conversation when the reader moves to another thread.
  useEffect(() => {
    reloadMessages(activeId);
  }, [activeId]);

  // Pin to the newest message. Opening a thread jumps straight to the bottom;
  // after that, arrivals only pull the view down while the reader is already
  // there — yanking someone who scrolled up to read history is worse than not
  // following at all. There was no scrolling of any kind before this, so a
  // 48-message thread opened on its oldest message every time.
  const lastMessageId = messages[messages.length - 1]?.id ?? "";
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
    nearBottomRef.current = true;
  }, [activeId]);
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || !nearBottomRef.current) return;
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [lastMessageId, messages.length]);

  // A picked file used to be visible only as a tint on the paperclip and its
  // name in a tooltip — no way to see WHAT was attached, and no way to change
  // your mind short of sending it. Revoked on change so the blobs do not pile
  // up over a long shift.
  const attachmentUrl = useMemo(() => (attachment ? URL.createObjectURL(attachment) : null), [attachment]);
  useEffect(() => {
    if (!attachmentUrl) return;
    return () => URL.revokeObjectURL(attachmentUrl);
  }, [attachmentUrl]);

  function clearAttachment() {
    setAttachment(null);
    // Without this, picking the SAME file again fires no change event and the
    // attachment silently never comes back.
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  // The composer grows with the text instead of hiding it in a one-line box.
  useEffect(() => {
    const el = draftRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, COMPOSER_MAX_H)}px`;
  }, [draft]);

  // Any click outside the message menu closes it. Deferred by a tick so the
  // click that opened it is not the one that shuts it again.
  useEffect(() => {
    if (!actionMessage) return;
    const close = () => setActionMessage(null);
    const timer = setTimeout(() => document.addEventListener("click", close), 0);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("click", close);
    };
  }, [actionMessage]);

  function openThread(id: string) {
    setActiveId(id);
    setReplyTo(null);
    setEditing(null);
    setActionMessage(null);
  }
  async function send() {
    if ((!draft.trim() && !attachment) || !active || sending) return;
    setSending(true);
    try {
      if (editing?.id) await editSpecialistMessage(editing.id, draft.trim());
      else {
        const attachmentPath = attachment ? await uploadSpecialistChatImage(active.userId, active.id, attachment) : null;
        await sendSpecialistMessage(active.id, draft.trim(), attachmentPath, replyTo?.id);
      }
      setDraft("");
      clearAttachment();
      setReplyTo(null);
      setEditing(null);
      reload();
      reloadMessages(active.id);
    } catch {
      pushToast("Không thể gửi tin nhắn");
    } finally {
      setSending(false);
    }
  }

  // Reactions and deletes had no guard at all; a double tap toggled the
  // reaction straight back off and a double delete raced two writes.
  const [msgBusy, setMsgBusy] = useState<string | null>(null);
  async function react(message: ChatMessage, emoji: string) {
    if (!message.id || msgBusy) return;
    setMsgBusy(message.id);
    try {
      await toggleSpecialistReaction(message.id, emoji, message.reactions?.find((reaction) => reaction.userId === currentUserId));
      setActionMessage(null);
      reloadMessages(activeIdRef.current);
    } catch {
      pushToast("Không thể thả cảm xúc");
    } finally {
      setMsgBusy(null);
    }
  }

  async function removeMessage(message: ChatMessage) {
    if (!message.id || msgBusy) return;
    setDeleteTarget(null);
    setMsgBusy(message.id);
    setActionMessage(null);
    try {
      await deleteSpecialistMessage(message.id);
      reload();
      reloadMessages(activeIdRef.current);
    } catch {
      pushToast("Không thể xoá tin nhắn");
    } finally {
      setMsgBusy(null);
    }
  }

  if (!threads) return <div style={{ color: "var(--text-secondary)" }}>Đang tải...</div>;
  if (!threads.length) return <div style={{ color: "var(--text-secondary)" }}>Chưa có cuộc trò chuyện nào.</div>;

  return (
    <div style={{ display: "flex", gap: 16, height: "calc(100vh - 160px)" }}>
      <div style={{ width: 300, background: "#fff", borderRadius: 16, boxShadow: "var(--shadow-card)", display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <div style={{ display: "flex", gap: 8, padding: 14, borderBottom: "1px solid var(--divider)" }}>
          {([["all", "Tất cả"], ["unread", "Chưa đọc"]] as const).map(([k, l]) => (
            <button
              key={k}
              onClick={() => setFilter(k)}
              style={{
                flex: 1,
                border: filter === k ? "none" : "1px solid var(--border-input)",
                background: filter === k ? "var(--color-primary)" : "none",
                color: filter === k ? "#fff" : "var(--text-primary)",
                borderRadius: 999,
                padding: "7px 0",
                fontFamily: "var(--font-family)",
                fontWeight: 600,
                fontSize: 12.5,
                cursor: "pointer",
              }}
            >
              {l}
            </button>
          ))}
        </div>
        <div style={{ padding: "10px 14px 0" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, border: "1px solid var(--border-input)", borderRadius: 10, padding: "7px 10px" }}>
            <Icon name="search" size={14} color="var(--text-muted)" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Tìm tên khách hoặc nội dung..."
              style={{ border: "none", outline: "none", flex: 1, minWidth: 0, fontFamily: "var(--font-family)", fontSize: 12.5 }}
            />
            {search ? (
              <button onClick={() => setSearch("")} aria-label="Xoá tìm kiếm" style={{ border: 0, background: "none", cursor: "pointer", color: "var(--text-muted)", fontSize: 15, lineHeight: 1, padding: 0 }}>×</button>
            ) : null}
          </div>
        </div>
        <div style={{ padding: "10px 14px", borderBottom: "1px solid var(--divider)" }}>
          <select
            value={marketFilter}
            onChange={(e) => setMarketFilter(e.target.value as ChatMarketFilter)}
            style={{ ...inputStyle, width: "100%", padding: "7px 10px", fontSize: 12.5, fontWeight: 600, background: "#fff", cursor: "pointer" }}
          >
            {CHAT_MARKET_TABS.map(([key, label]) => (
              <option key={key} value={key}>{key === "ALL" ? label : `Thị trường ${label}`}</option>
            ))}
          </select>
        </div>
        <div style={{ flex: 1, overflowY: "auto" }}>
          {list.length === 0 ? (
            <div style={{ padding: "28px 16px", textAlign: "center", color: "var(--text-muted)", fontSize: 12.5 }}>
              Không có cuộc trò chuyện nào khớp bộ lọc.
            </div>
          ) : null}
          {list.map((t) => (
            <button
              key={t.id}
              onClick={() => openThread(String(t.id))}
              style={{
                width: "100%",
                display: "flex",
                gap: 10,
                alignItems: "center",
                padding: "12px 14px",
                border: "none",
                borderBottom: "1px solid var(--divider)",
                background: t.id === activeId ? "var(--color-primary-tint-10)" : "none",
                cursor: "pointer",
                textAlign: "left",
              }}
            >
              <Avatar name={t.user} color={t.avatarColor} size={36} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 6 }}>
                  <div style={{ fontWeight: 700, fontSize: 13.5, color: "var(--text-primary)", display: "flex", alignItems: "center", gap: 6 }}>
                    {t.user}
                    {t.language && t.language !== "vi" ? <LangBadge thread={t} compact /> : null}
                  </div>
                  <div style={{ fontSize: 11, color: "var(--text-muted)", whiteSpace: "nowrap" }}>{t.time}</div>
                </div>
                <div style={{ fontSize: 12, color: "var(--text-secondary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {threadPreview(t)}
                </div>
              </div>
              {t.unread ? <div style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--color-primary)", flexShrink: 0 }} /> : null}
            </button>
          ))}
        </div>
      </div>
      {active ? (
        <div style={{ flex: 1, background: "#fff", borderRadius: 16, boxShadow: "var(--shadow-card)", display: "flex", flexDirection: "column", overflow: "hidden" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: 16, borderBottom: "1px solid var(--divider)" }}>
            <Avatar name={active.user} color={active.avatarColor} size={36} />
            <div style={{ fontWeight: 700, fontSize: 14.5, color: "var(--text-primary)", display: "flex", alignItems: "center", gap: 8 }}>
              {active.user}
              <LangBadge thread={active} />
            </div>
          </div>
          <div
            ref={scrollRef}
            onScroll={(e) => {
              const el = e.currentTarget;
              nearBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
            }}
            style={{ flex: 1, overflowY: "auto", overflowX: "hidden", padding: "20px 28px", display: "flex", flexDirection: "column", gap: 10 }}
          >
            {messages.map((m, i) => {
              const replied = messages.find((candidate) => candidate.id === m.replyToMessageId);
              const isLatestAdmin = m.from === "admin" && !messages.slice(i + 1).some((candidate) => candidate.from === "admin");
              const showDay = !!m.createdAt && !sameDay(m.createdAt, messages[i - 1]?.createdAt);
              return (
              <Fragment key={m.id ?? i}>
              {showDay ? (
                <div style={{ alignSelf: "center", margin: "6px 0 2px", padding: "3px 12px", borderRadius: 999, background: "var(--bg-card-alt)", color: "var(--text-muted)", fontSize: 11.5, fontWeight: 600 }}>
                  {dayLabel(m.createdAt!)}
                </div>
              ) : null}
              <div className="chat-msg" style={{ position: "relative", alignSelf: m.from === "admin" ? "flex-end" : "flex-start", maxWidth: "65%" }}>
                {/* pre-wrap so the line breaks Shift+Enter now produces are
                    actually shown instead of collapsing into one paragraph. */}
                <div onContextMenu={(event) => { event.preventDefault(); setActionMessage(m); }} style={{ position: "relative", background: m.from === "admin" ? "var(--color-primary)" : "var(--bg-card-alt)", color: m.from === "admin" ? "#fff" : "var(--text-primary)", borderRadius: 12, padding: "10px 14px", fontSize: 13.5, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                  {m.replyToMessageId ? <div style={{ borderLeft: "3px solid currentColor", opacity: 0.7, paddingLeft: 8, marginBottom: 7, fontSize: 12 }}>{replied?.deletedAt ? "Tin nhắn đã xoá" : replied?.text || (replied?.imageUrl ? "Ảnh" : "Tin nhắn được trả lời")}</div> : null}
                  {m.deletedAt ? <i style={{ opacity: 0.7 }}>Tin nhắn đã được xoá</i> : <>{m.imageUrl ? m.attachmentKind === "video" ? <video src={m.imageUrl} controls style={{ display: "block", width: "min(320px, 100%)", borderRadius: 8, marginBottom: m.text ? 8 : 0 }} /> : <Image src={m.imageUrl} alt="Ảnh đính kèm" width={320} height={240} unoptimized style={{ display: "block", width: "min(320px, 100%)", height: "auto", borderRadius: 8, marginBottom: m.text ? 8 : 0 }} /> : null}{m.text || null}</>}
                  {m.reactions?.length ? <span style={{ position: "absolute", right: 4, bottom: -15, background: "#fff", color: "#222", border: "1px solid var(--divider)", borderRadius: 12, padding: "1px 6px", fontSize: 12 }}>{Array.from(new Set(m.reactions.map((reaction) => reaction.emoji))).join(" ")} {m.reactions.length}</span> : null}
                </div>

                {/* Reply / edit / delete / react were reachable ONLY by
                    right-clicking the bubble, with nothing on screen saying
                    so. This is the affordance Messenger uses: a quiet ⋯ that
                    appears on hover or keyboard focus. Right-click still
                    works for anyone who already knew. */}
                <button
                  className="chat-msg-more"
                  onClick={(event) => { event.stopPropagation(); setActionMessage(actionMessage?.id === m.id ? null : m); }}
                  aria-label="Tuỳ chọn tin nhắn"
                  style={{ position: "absolute", top: 2, ...(m.from === "admin" ? { left: -27 } : { right: -27 }), width: 24, height: 24, borderRadius: "50%", border: "1px solid var(--divider)", background: "#fff", display: "grid", placeItems: "center", cursor: "pointer", padding: 0 }}
                >
                  <Icon name="more-horizontal" size={14} color="var(--text-muted)" />
                </button>

                {/* The menu opens AT the message. It used to be pinned just
                    above the composer, so right-clicking the first message of
                    a long thread threw the menu to the far bottom of the
                    screen, nowhere near what was clicked. */}
                {actionMessage?.id === m.id ? (
                  <div
                    onClick={(event) => event.stopPropagation()}
                    style={{ position: "absolute", bottom: "100%", marginBottom: 6, ...(m.from === "admin" ? { right: 0 } : { left: 0 }), zIndex: 3, background: "#fff", boxShadow: "var(--shadow-card)", borderRadius: 14, padding: 10, minWidth: 150 }}
                  >
                    <div style={{ display: "flex", gap: 8 }}>
                      {["👍", "❤️", "😂", "😮", "😢", "🙏"].map((emoji) => (
                        <button key={emoji} onClick={() => void react(m, emoji)} style={{ border: 0, background: "none", fontSize: 20, cursor: "pointer", padding: 0 }}>{emoji}</button>
                      ))}
                    </div>
                    <button onClick={() => { setReplyTo(m); setEditing(null); setActionMessage(null); }} style={menuItemStyle}>Trả lời</button>
                    {m.from === "admin" && !m.deletedAt ? (
                      <>
                        <button onClick={() => { setEditing(m); setReplyTo(null); setDraft(m.text); setActionMessage(null); }} style={menuItemStyle}>Chỉnh sửa</button>
                        <button onClick={() => { setDeleteTarget(m); setActionMessage(null); }} style={{ ...menuItemStyle, color: "#d33" }}>Xoá</button>
                      </>
                    ) : null}
                  </div>
                ) : null}

                {m.time ? <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: m.reactions?.length ? 16 : 3, textAlign: m.from === "admin" ? "right" : "left" }}>{m.time}{m.editedAt ? " · Đã chỉnh sửa" : ""}{isLatestAdmin ? ` · ${m.readAt ? "Đã xem" : "Đã gửi"}` : ""}</div> : null}
              </div>
              </Fragment>
            );})}
          </div>
          {editing || replyTo ? <div style={{ padding: "8px 16px", borderLeft: "3px solid var(--color-primary)", background: "var(--bg-card-alt)", display: "flex", justifyContent: "space-between" }}><div><b style={{ fontSize: 12, color: "var(--color-primary)" }}>{editing ? "Chỉnh sửa tin nhắn" : "Đang trả lời"}</b><div style={{ fontSize: 12 }}>{(editing ?? replyTo)?.text || "Ảnh"}</div></div><button onClick={() => { setEditing(null); setReplyTo(null); if (editing) setDraft(""); }} style={{ border: 0, background: "none", cursor: "pointer" }}>×</button></div> : null}
          {attachment ? (
            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 16px", background: "var(--bg-card-alt)" }}>
              {attachmentUrl && attachment.type.startsWith("image/") ? (
                <Image src={attachmentUrl} alt="" width={44} height={44} unoptimized style={{ width: 44, height: 44, objectFit: "cover", borderRadius: 8 }} />
              ) : (
                <span style={{ width: 44, height: 44, borderRadius: 8, background: "var(--s1)", display: "grid", placeItems: "center", flexShrink: 0 }}>
                  <Icon name="film" size={18} color="var(--text-muted)" />
                </span>
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{attachment.name}</div>
                <div style={{ fontSize: 11.5, color: "var(--text-muted)" }}>{(attachment.size / 1048576).toFixed(1)} MB</div>
              </div>
              <button onClick={clearAttachment} aria-label="Bỏ tệp đính kèm" style={{ border: 0, background: "none", cursor: "pointer", color: "var(--text-muted)", fontSize: 18, lineHeight: 1, padding: 4 }}>×</button>
            </div>
          ) : null}
          {showEmoji ? <div style={{ padding: "8px 16px", display: "flex", gap: 14 }}>{["😀", "😂", "🥰", "👍", "🙏", "❤️", "🎉", "💪"].map((emoji) => <button key={emoji} onClick={() => setDraft((value) => value + emoji)} style={{ border: 0, background: "none", fontSize: 22, cursor: "pointer" }}>{emoji}</button>)}</div> : null}
          <div style={{ display: "flex", alignItems: "flex-end", gap: 10, padding: 16, borderTop: "1px solid var(--divider)", position: "relative" }}>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,video/mp4,video/quicktime,video/webm"
              hidden
              onChange={(event) => setAttachment(event.target.files?.[0] ?? null)}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={sending}
              title={attachment?.name ?? "Đính kèm ảnh"}
              style={{ width: 40, height: 40, borderRadius: "50%", border: "1px solid var(--border-input)", background: attachment ? "var(--color-primary-tint-10)" : "#fff", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 }}
            >
              <Icon name="image" size={18} color="var(--color-primary)" />
            </button>
            <button onClick={() => setShowEmoji((value) => !value)} style={{ width: 40, height: 40, borderRadius: "50%", border: "1px solid var(--border-input)", background: "#fff", fontSize: 20, cursor: "pointer" }}>☺</button>
            {/* A textarea, not an input: the old one-line box made a reply with
                a second line impossible to type at all. Enter sends and
                Shift+Enter breaks the line, as in Messenger, Zalo and
                Telegram. isComposing matters here — a Telex/VNI keyboard is
                mid-composition on many keystrokes, and sending on that Enter
                would cut a Vietnamese word in half. */}
            <textarea
              ref={draftRef}
              value={draft}
              rows={1}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key !== "Enter" || e.shiftKey || e.nativeEvent.isComposing) return;
                e.preventDefault();
                void send();
              }}
              placeholder="Nhắn tin hỗ trợ... (Shift+Enter để xuống dòng)"
              style={{ flex: 1, minWidth: 0, border: "1px solid var(--border-input)", borderRadius: 20, padding: "10px 16px", fontFamily: "var(--font-family)", fontSize: 13.5, lineHeight: 1.45, resize: "none", maxHeight: COMPOSER_MAX_H, overflowY: "auto" }}
            />
            <button onClick={send} disabled={sending} style={{ width: 40, height: 40, borderRadius: "50%", border: "none", background: "var(--color-primary)", display: "flex", alignItems: "center", justifyContent: "center", cursor: sending ? "default" : "pointer", flexShrink: 0, opacity: sending ? 0.6 : 1 }}>
              <Icon name="send" size={16} color="#fff" />
            </button>
          </div>
        </div>
      ) : null}

      {/* window.confirm before this — the one browser dialog left in a console
          that confirms everything else in its own modal. */}
      {deleteTarget ? (
        <ConfirmModal
          title="Xoá tin nhắn"
          message="Tin nhắn sẽ hiện là “Tin nhắn đã được xoá” với cả hai bên. Không khôi phục được."
          busy={msgBusy === deleteTarget.id}
          onConfirm={() => void removeMessage(deleteTarget)}
          onCancel={() => setDeleteTarget(null)}
        />
      ) : null}
    </div>
  );
}
