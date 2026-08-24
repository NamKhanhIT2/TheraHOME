"use client";

// Real data: chat_threads / chat_messages (kind='human'), replying as
// sender_type='specialist' — the missing piece the mobile app's own
// CLAUDE.md flagged ("no specialist client exists yet"). Also tracks
// Presence on the specialist-presence channel while this screen is
// mounted, so the mobile app's useSpecialistPresence() indicator lights up
// for real. chat_messages is already in the supabase_realtime publication.
import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { supabase } from "@/lib/supabase";
import { deleteSpecialistMessage, editSpecialistMessage, fetchChatThreads, markThreadMessagesRead, sendSpecialistMessage, toggleSpecialistReaction, uploadSpecialistChatImage } from "@/lib/db";
import type { ChatMessage, ChatThread } from "@/lib/adminMockData";
import { Avatar } from "@/components/ui/primitives";
import { Icon } from "@/components/ui/Icon";
import { pushToast } from "@/components/ui/Toast";

export function ChatView() {
  const [threads, setThreads] = useState<ChatThread[] | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [attachment, setAttachment] = useState<File | null>(null);
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
  const [editing, setEditing] = useState<ChatMessage | null>(null);
  const [actionMessage, setActionMessage] = useState<ChatMessage | null>(null);
  const [showEmoji, setShowEmoji] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const activeIdRef = useRef<string | null>(null);
  useEffect(() => {
    activeIdRef.current = activeId;
  }, [activeId]);

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
      .on("postgres_changes", { event: "*", schema: "public", table: "chat_messages" }, () => reload())
      .subscribe();
    const reactionsChannel = supabase.channel("cskh-chat-reactions").on("postgres_changes", { event: "*", schema: "public", table: "chat_message_reactions" }, () => reload()).subscribe();

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

  const list = threads ? (filter === "unread" ? threads.filter((t) => t.unread) : threads) : [];
  const active = threads?.find((t) => t.id === activeId);

  useEffect(() => {
    if (!activeId) return;
    markThreadMessagesRead(activeId).then(reload).catch(() => pushToast("Không thể cập nhật trạng thái đã xem"));
  }, [activeId]);

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
      setAttachment(null);
      setReplyTo(null);
      setEditing(null);
      reload();
    } catch {
      pushToast("Không thể gửi tin nhắn");
    } finally {
      setSending(false);
    }
  }

  async function react(message: ChatMessage, emoji: string) {
    if (!message.id) return;
    try {
      await toggleSpecialistReaction(message.id, emoji, message.reactions?.find((reaction) => reaction.userId === currentUserId));
      setActionMessage(null);
      reload();
    } catch { pushToast("Không thể thả cảm xúc"); }
  }

  function removeMessage(message: ChatMessage) {
    if (!message.id) return;
    if (!window.confirm("Xoá tin nhắn này?")) return;
    deleteSpecialistMessage(message.id).then(reload).catch(() => pushToast("Không thể xoá tin nhắn"));
    setActionMessage(null);
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
        <div style={{ flex: 1, overflowY: "auto" }}>
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
                  <div style={{ fontWeight: 700, fontSize: 13.5, color: "var(--text-primary)" }}>{t.user}</div>
                  <div style={{ fontSize: 11, color: "var(--text-muted)", whiteSpace: "nowrap" }}>{t.time}</div>
                </div>
                <div style={{ fontSize: 12, color: "var(--text-secondary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {t.messages[t.messages.length - 1].text}
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
            <div style={{ fontWeight: 700, fontSize: 14.5, color: "var(--text-primary)" }}>{active.user}</div>
          </div>
          <div style={{ flex: 1, overflowY: "auto", padding: 20, display: "flex", flexDirection: "column", gap: 10 }}>
            {active.messages.map((m, i) => {
              const replied = active.messages.find((candidate) => candidate.id === m.replyToMessageId);
              const isLatestAdmin = m.from === "admin" && !active.messages.slice(i + 1).some((candidate) => candidate.from === "admin");
              return (
              <div key={m.id ?? i} style={{ alignSelf: m.from === "admin" ? "flex-end" : "flex-start", maxWidth: "65%" }}>
                <div onContextMenu={(event) => { event.preventDefault(); setActionMessage(m); }} style={{ position: "relative", background: m.from === "admin" ? "var(--color-primary)" : "var(--bg-card-alt)", color: m.from === "admin" ? "#fff" : "var(--text-primary)", borderRadius: 12, padding: "10px 14px", fontSize: 13.5 }}>
                  {m.replyToMessageId ? <div style={{ borderLeft: "3px solid currentColor", opacity: 0.7, paddingLeft: 8, marginBottom: 7, fontSize: 12 }}>{replied?.deletedAt ? "Tin nhắn đã xoá" : replied?.text || (replied?.imageUrl ? "Ảnh" : "Tin nhắn được trả lời")}</div> : null}
                  {m.deletedAt ? <i style={{ opacity: 0.7 }}>Tin nhắn đã được xoá</i> : <>{m.imageUrl ? m.attachmentKind === "video" ? <video src={m.imageUrl} controls style={{ display: "block", width: "min(320px, 100%)", borderRadius: 8, marginBottom: m.text ? 8 : 0 }} /> : <Image src={m.imageUrl} alt="Ảnh đính kèm" width={320} height={240} unoptimized style={{ display: "block", width: "min(320px, 100%)", height: "auto", borderRadius: 8, marginBottom: m.text ? 8 : 0 }} /> : null}{m.text || null}</>}
                  {m.reactions?.length ? <span style={{ position: "absolute", right: 4, bottom: -15, background: "#fff", color: "#222", border: "1px solid var(--divider)", borderRadius: 12, padding: "1px 6px", fontSize: 12 }}>{Array.from(new Set(m.reactions.map((reaction) => reaction.emoji))).join(" ")} {m.reactions.length}</span> : null}
                </div>
                {m.time ? <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: m.reactions?.length ? 16 : 3, textAlign: m.from === "admin" ? "right" : "left" }}>{m.time}{m.editedAt ? " · Đã chỉnh sửa" : ""}{isLatestAdmin ? ` · ${m.readAt ? "Đã xem" : "Đã gửi"}` : ""}</div> : null}
              </div>
            );})}
          </div>
          {editing || replyTo ? <div style={{ padding: "8px 16px", borderLeft: "3px solid var(--color-primary)", background: "var(--bg-card-alt)", display: "flex", justifyContent: "space-between" }}><div><b style={{ fontSize: 12, color: "var(--color-primary)" }}>{editing ? "Chỉnh sửa tin nhắn" : "Đang trả lời"}</b><div style={{ fontSize: 12 }}>{(editing ?? replyTo)?.text || "Ảnh"}</div></div><button onClick={() => { setEditing(null); setReplyTo(null); if (editing) setDraft(""); }} style={{ border: 0, background: "none", cursor: "pointer" }}>×</button></div> : null}
          {showEmoji ? <div style={{ padding: "8px 16px", display: "flex", gap: 14 }}>{["😀", "😂", "🥰", "👍", "🙏", "❤️", "🎉", "💪"].map((emoji) => <button key={emoji} onClick={() => setDraft((value) => value + emoji)} style={{ border: 0, background: "none", fontSize: 22, cursor: "pointer" }}>{emoji}</button>)}</div> : null}
          <div style={{ display: "flex", gap: 10, padding: 16, borderTop: "1px solid var(--divider)", position: "relative" }}>
            {actionMessage ? <div style={{ position: "absolute", bottom: 70, left: 16, zIndex: 2, background: "#fff", boxShadow: "var(--shadow-card)", borderRadius: 14, padding: 10 }}><div style={{ display: "flex", gap: 8 }}>{["👍", "❤️", "😂", "😮", "😢", "🙏"].map((emoji) => <button key={emoji} onClick={() => void react(actionMessage, emoji)} style={{ border: 0, background: "none", fontSize: 22, cursor: "pointer" }}>{emoji}</button>)}</div><button onClick={() => { setReplyTo(actionMessage); setEditing(null); setActionMessage(null); }} style={{ display: "block", border: 0, background: "none", padding: 8, cursor: "pointer" }}>Trả lời</button>{actionMessage.from === "admin" && !actionMessage.deletedAt ? <><button onClick={() => { setEditing(actionMessage); setReplyTo(null); setDraft(actionMessage.text); setActionMessage(null); }} style={{ display: "block", border: 0, background: "none", padding: 8, cursor: "pointer" }}>Chỉnh sửa</button><button onClick={() => removeMessage(actionMessage)} style={{ display: "block", border: 0, background: "none", color: "#d33", padding: 8, cursor: "pointer" }}>Xoá</button></> : null}</div> : null}
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
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && send()}
              placeholder="Nhắn tin hỗ trợ..."
              style={{ flex: 1, border: "1px solid var(--border-input)", borderRadius: 999, padding: "10px 16px", fontFamily: "var(--font-family)", fontSize: 13.5 }}
            />
            <button onClick={send} disabled={sending} style={{ width: 40, height: 40, borderRadius: "50%", border: "none", background: "var(--color-primary)", display: "flex", alignItems: "center", justifyContent: "center", cursor: sending ? "default" : "pointer", flexShrink: 0, opacity: sending ? 0.6 : 1 }}>
              <Icon name="send" size={16} color="#fff" />
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
